"use client";
// ^ Required in Next.js App Router — this component uses useState/useCallback
// and browser-only APIs (navigator.geolocation), so it must render on the
// client, not the server.

import React, { useState, useCallback, useEffect, useRef } from "react";
import MapPicker from "./MapPicker";
import { useRouter } from "next/navigation";

/**
 * MemberProfileForm
 * ------------------
 * Personal, residence, business and family details for one member.
 *
 * ON LOCATIONSs
 * Four addresses on this page can carry a pin: the member's home, their
 * business, and the spouse's home and business. Rendering four 360px maps
 * at once buried the form and made every one of them fetch its own tiles,
 * so each map now sits behind a "Set location on map" button (see
 * LocationField) and opens only when it is wanted. The status line and the
 * "Use current location" shortcut stay visible either way.
 *
 * Coordinates are never displayed. Members see "Location set" or "No
 * location set yet"; the numbers live in form state and travel with the
 * save payload.
 *
 * ON RELATIVES
 * The spouse and each child are separate member records on the backend, not
 * fields on this one. Their `memberId` is carried invisibly through the form
 * so the save route can update the right record — without it, everything
 * typed into those sections was quietly discarded on save.
 */

// Strips anything that isn't a digit and caps the length — used on every
// mobile/phone number field so letters, symbols, spaces etc. can't be typed
// or pasted in.
const digitsOnly = (value, maxLen = 10) => value.replace(/\D/g, "").slice(0, maxLen);

const emptyChild = () => ({
  // Blank for a child who isn't on the backend yet.
  memberId: "",
  name: "",
  dob: "",
  education: "",
  mobile: "",
  additionalInfo: "",
});

const initialFormState = {
  member: {
    name: "",
    husbandFatherName: "",
    surname: "",
    dob: "",
    education: "",
    mobile: "",
    altMobile: "",
    photo: null,
    isInBoard: false,
    boardDesignation: "",
    isMarried: true,
    profession: "", // "" | "Housewife" | "Business" | "Service"
  },
  // The member's own home. This is what the backend stores as home_address
  // + area_location + city + pincode + residence_latitude/longitude — it is
  // separate from any business address, and the form had no room for it
  // before, so a saved home address could never be seen or edited here.
  residence: {
    address: "",
    area: "",
    city: "",
    pinCode: "",
    lat: "",
    lng: "",
  },
  service: {
    company: "",
    sector: "",
    designation: "",
  },
  business: {
    // Carried so a save updates this business instead of filing a new one
    // every time.
    businessId: "",
    name: "",
    description: "",
    address1: "",
    address2: "",
    area: "",
    city: "",
    pinCode: "",
    natureOfBusiness: "",
    subCategory: "",
    officePhone: "",
    email: "",
    website: "",
    lat: "",
    lng: "",
  },
  ancestry: {
    place: "",
    state: "",
    gotra: "",
  },
  wife: {
    // The spouse's own member record id — needed to save anything here.
    memberId: "",
    name: "",
    fatherName: "",
    profession: "",
    mobile: "",
    altContact: "",
    dob: "",
    education: "",
    anniversary: "",
    photo: null,
    couplePhoto: null,
    residence: {
      sameAsHusband: true,
      address: "",
      area: "",
      city: "",
      pinCode: "",
      lat: "",
      lng: "",
    },
    business: {
      businessId: "",
      name: "",
      description: "",
      sameAsHusband: false,
      address: "",
      area: "",
      city: "",
      pinCode: "",
      natureOfBusiness: "",
      officePhone: "",
      email: "",
      website: "",
      lat: "",
      lng: "",
    },
  },
  children: [emptyChild()],
};

function deepMerge(base, overrides) {
  if (!overrides) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  Object.keys(overrides).forEach((key) => {
    const value = overrides[key];
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof File)) {
      out[key] = deepMerge(base[key] || {}, value);
    } else {
      out[key] = value;
    }
  });
  return out;
}

export default function MemberProfileForm({
  apiEndpoint = "/api/members",
  authToken = "",
  initialValues = null,
  onSaved = () => {},
}) {
  
  const [form, setForm] = useState(
    initialValues ? deepMerge(initialFormState, initialValues) : initialFormState
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const router = useRouter();
  // initialValues arrives after the first render (the portal fetches it) and
  // again after every save. useState reads a prop once and never again, so
  // without this the form kept showing whatever it was built with — which
  // after a save meant stale or blank fields even though the server had the
  // right data. The ref stops it looping on an identical payload.
  const seededRef = useRef(null);
  useEffect(() => {
    if (!initialValues) return;
    const stamp = JSON.stringify(initialValues);
    if (seededRef.current === stamp) return;
    seededRef.current = stamp;
    setForm(deepMerge(initialFormState, initialValues));
  }, [initialValues]);

  // Banners sit at the top of a long page; without this the member presses
  // Save at the bottom and sees nothing happen at all.
  const scrollToTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---- generic setters -----------------------------------------------

  const setMember = useCallback((patch) => {
    setForm((f) => ({ ...f, member: { ...f.member, ...patch } }));
  }, []);

  const setResidence = useCallback((patch) => {
    setForm((f) => ({ ...f, residence: { ...f.residence, ...patch } }));
  }, []);

  const setBusiness = useCallback((patch) => {
    setForm((f) => ({ ...f, business: { ...f.business, ...patch } }));
  }, []);

  const setAncestry = useCallback((patch) => {
    setForm((f) => ({ ...f, ancestry: { ...f.ancestry, ...patch } }));
  }, []);

  const setService = useCallback((patch) => {
    setForm((f) => ({ ...f, service: { ...f.service, ...patch } }));
  }, []);

  const setWife = useCallback((patch) => {
    setForm((f) => ({ ...f, wife: { ...f.wife, ...patch } }));
  }, []);

  const setWifeResidence = useCallback((patch) => {
    setForm((f) => ({
      ...f,
      wife: { ...f.wife, residence: { ...f.wife.residence, ...patch } },
    }));
  }, []);

  const setWifeBusiness = useCallback((patch) => {
    setForm((f) => ({
      ...f,
      wife: { ...f.wife, business: { ...f.wife.business, ...patch } },
    }));
  }, []);

  const setChild = useCallback((index, patch) => {
    setForm((f) => {
      const children = f.children.map((c, i) => (i === index ? { ...c, ...patch } : c));
      return { ...f, children };
    });
  }, []);

  const addChild = useCallback(() => {
    setForm((f) => (f.children.length >= 4 ? f : { ...f, children: [...f.children, emptyChild()] }));
  }, []);

  const removeChild = useCallback((index) => {
    setForm((f) => ({ ...f, children: f.children.filter((_, i) => i !== index) }));
  }, []);

  // ---- "same as husband" address copy ---------------------------------
  // Copies from the member's HOME, not their business — "same as husband"
  // on a residence field means the same house.

  const toggleResidenceSameAsHusband = (checked) => {
    if (checked) {
      setWifeResidence({
        sameAsHusband: true,
        address: form.residence.address,
        area: form.residence.area,
        city: form.residence.city,
        pinCode: form.residence.pinCode,
        lat: form.residence.lat,
        lng: form.residence.lng,
      });
    } else {
      setWifeResidence({ sameAsHusband: false });
    }
  };

  const toggleWifeBusinessSameAsHusband = (checked) => {
    if (checked) {
      setWifeBusiness({
        sameAsHusband: true,
        address: form.business.address1,
        area: form.business.area,
        city: form.business.city,
        pinCode: form.business.pinCode,
        lat: form.business.lat,
        lng: form.business.lng,
      });
    } else {
      setWifeBusiness({ sameAsHusband: false });
    }
  };

  // ---- geolocation ------------------------------------------------------

  const captureLocation = (setter, disabled) => {
    if (disabled) return;
    if (!navigator.geolocation) {
      setSaveError("Geolocation is not supported in this browser.");
      scrollToTop();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setter({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        });
      },
      () => {
        setSaveError("Could not get current location (permission denied or unavailable).");
        scrollToTop();
      },
      {
        // Without this, the browser often takes the fast path — resolving
        // location from Wi-Fi/cell-tower/IP data instead of the device's
        // actual GPS chip, which can be off by kilometres. This forces it
        // to wait for a real GPS fix instead, and maximumAge: 0 stops it
        // from returning an old cached position from earlier in the session.
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // ---- validation ---------------------------------------------------

  const validate = () => {
    const e = {};
    const req = (val, key) => {
      if (!val || String(val).trim() === "") e[key] = "Required";
    };
    const reqMobile = (val, key) => {
      if (!val || String(val).trim() === "") e[key] = "Required";
      else if (String(val).length !== 10) e[key] = "Enter a valid 10-digit number";
    };

    req(form.member.name, "member.name");
    req(form.member.husbandFatherName, "member.husbandFatherName");
    req(form.member.surname, "member.surname");
    req(form.member.dob, "member.dob");
    reqMobile(form.member.mobile, "member.mobile");
    if (form.member.isInBoard) req(form.member.boardDesignation, "member.boardDesignation");

    req(form.residence.address, "residence.address");
    req(form.member.profession, "member.profession");

    if (form.member.profession === "Business") {
      req(form.business.name, "business.name");
      req(form.business.address1, "business.address1");
      req(form.business.city, "business.city");
    }

    if (form.member.profession === "Service") {
      req(form.service.company, "service.company");
      req(form.service.designation, "service.designation");
    }

    if (form.member.isMarried) {
      req(form.wife.name, "wife.name");
      req(form.wife.fatherName, "wife.fatherName");
      reqMobile(form.wife.mobile, "wife.mobile");
      req(form.wife.residence.address, "wife.residence.address");
      if (form.wife.profession && form.wife.profession !== "housewife") {
        req(form.wife.business.address, "wife.business.address");
      }
      form.children.forEach((c, i) => {
        if (c.name || c.dob || c.education || c.mobile || c.additionalInfo) {
          req(c.name, `children.${i}.name`);
        }
      });
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const errFor = (key) => errors[key] || "";

  // ---- submit / API call --------------------------------------------

  function buildFormData() {
    const fd = new FormData();

    const { photo, ...memberRest } = form.member;
    fd.append("member", JSON.stringify(memberRest));
    if (photo) fd.append("memberPhoto", photo);

    fd.append("residence", JSON.stringify(form.residence));

    // Only the section matching the chosen profession is sent.
    // (`profession` itself already travels inside the "member" JSON above.)
    if (form.member.profession === "Business") {
      fd.append("business", JSON.stringify(form.business));
    }
    if (form.member.profession === "Service") {
      fd.append("service", JSON.stringify(form.service));
    }

    fd.append("ancestry", JSON.stringify(form.ancestry));

    if (form.member.isMarried) {
      const { photo: wifePhoto, couplePhoto, ...wifeRest } = form.wife;
      fd.append("wife", JSON.stringify(wifeRest));
      if (wifePhoto) fd.append("wifePhoto", wifePhoto);
      if (couplePhoto) fd.append("couplePhoto", couplePhoto);
      fd.append("children", JSON.stringify(form.children));
    }

    return fd;
  }

  /**
   * The member portal's endpoint takes JSON and already has the photos (they
   * upload on their own as soon as they're picked), so files only need the
   * multipart path used by the office's create-a-member route.
   */
  const usesJson = apiEndpoint.includes("/member/me");

  async function saveMember() {
    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: usesJson
        ? { "Content-Type": "application/json" }
        : authToken
        ? { Authorization: `Bearer ${authToken}` }
        : undefined,
      body: usesJson
        ? JSON.stringify({
            member: form.member,
            residence: form.residence,
            business: form.business,
            service: form.service,
            ancestry: form.ancestry,
            wife: form.member.isMarried ? form.wife : null,
            children: form.member.isMarried ? form.children : [],
          })
        : buildFormData(),
    });

    if (!res.ok) {
      let message = `Save failed (HTTP ${res.status})`;
      const raw = await res.text();
      try {
        const data = JSON.parse(raw);
        if (data?.message) message = data.message;
      } catch (_) {
        // Not JSON — most likely means the request never reached our own
        // API route (e.g. wrong path, route file missing/misnamed, or the
        // dev server needs a restart after adding a new route file) and
        // the framework's own 404/500 HTML page came back instead.
        if (raw) message = `Save failed (HTTP ${res.status}): ${raw.slice(0, 200)}`;
      }
      throw new Error(message);
    }
    return res.json().catch(() => ({}));
  }

  const handleSubmit = async () => {
    setSaveError("");
    setSaveNotice("");
    if (!validate()) {
      setSaveError("Please fill in the required fields highlighted below.");
      scrollToTop();
      return;
    }
    setSaving(true);
    try {
      const result = await saveMember();
      // The portal route reports what it could and couldn't save — a child
      // with no record yet, for instance. Showing its own message beats a
      // blanket "saved" that quietly wasn't true for part of the form.
      setSaveNotice(result?.message || "Saved successfully.");
      scrollToTop();
      onSaved(result);
    } catch (err) {
      setSaveError(err.message || "Something went wrong while saving.");
      scrollToTop();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(initialValues ? deepMerge(initialFormState, initialValues) : initialFormState);
    setErrors({});
    setSaveError("");
    setSaveNotice("");
    scrollToTop();
  };

  return (
    <div className="mpf-outer">
      <div className="mpf-page">
        <style>{css}</style>

        <header className="mpf-doc-head">
  <div className="mpf-doc-head-top">
    <div>
      <h1>Member profile form</h1>
      <p>Save a member&apos;s full profile — personal, business and family details.</p>
    </div>
    <button
      type="button"
      className="mpf-create-event-btn"
      onClick={() => router.push("/create-event")}
    >
      + Create Event
    </button>
  </div>
  <div className="mpf-legend">
    <span className="mpf-req">*</span> indicates a mandatory field
  </div>
</header>

        {saveError && <div className="mpf-banner mpf-banner-error">{saveError}</div>}
        {saveNotice && <div className="mpf-banner mpf-banner-success">{saveNotice}</div>}

        {/* 1. Member details */}
        <section className="mpf-card">
          <h2>1. Member details</h2>
          <div className="mpf-grid">
            <Field label="Member's name" required error={errFor("member.name")}>
              <input
                type="text"
                value={form.member.name}
                onChange={(e) => setMember({ name: e.target.value })}
              />
            </Field>
            <Field label="Husband's father's name" required error={errFor("member.husbandFatherName")}>
              <input
                type="text"
                value={form.member.husbandFatherName}
                onChange={(e) => setMember({ husbandFatherName: e.target.value })}
              />
            </Field>
            <Field label="Surname" required error={errFor("member.surname")}>
              <input
                type="text"
                value={form.member.surname}
                onChange={(e) => setMember({ surname: e.target.value })}
              />
            </Field>
            <DatePickerField
              label="Date of birth"
              required
              error={errFor("member.dob")}
              value={form.member.dob}
              onChange={(v) => setMember({ dob: v })}
            />
            <Field label="Education">
              <input
                type="text"
                value={form.member.education}
                onChange={(e) => setMember({ education: e.target.value })}
              />
            </Field>
            <Field label="Mobile number" required error={errFor("member.mobile")}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={form.member.mobile}
                onChange={(e) => setMember({ mobile: digitsOnly(e.target.value) })}
              />
            </Field>
            <Field label="Alternate mobile">
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={form.member.altMobile}
                onChange={(e) => setMember({ altMobile: digitsOnly(e.target.value) })}
              />
            </Field>
            <Field label="Individual photo">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setMember({ photo: e.target.files?.[0] || null })}
              />
            </Field>
          </div>

          <div className="mpf-grid" style={{ marginTop: 10 }}>
            <Field label="Profession" required error={errFor("member.profession")}>
              <select
                value={form.member.profession}
                onChange={(e) => setMember({ profession: e.target.value })}
              >
                <option value="">Select profession</option>
                <option value="Housewife">Housewife</option>
                <option value="Business">Business</option>
                <option value="Service">Service</option>
              </select>
            </Field>
          </div>

          <label className="mpf-inline-toggle">
            <input
              type="checkbox"
              checked={form.member.isInBoard}
              onChange={(e) => setMember({ isInBoard: e.target.checked })}
            />
            Is in board
          </label>
          {form.member.isInBoard && (
            <div className="mpf-grid" style={{ marginTop: 10 }}>
              <Field label="Board designation" required error={errFor("member.boardDesignation")}>
                <select
                  value={form.member.boardDesignation}
                  onChange={(e) => setMember({ boardDesignation: e.target.value })}
                >
                  <option value="">Select designation</option>
                  <option value="Chairman & Managing Director">Chairman &amp; Managing Director</option>
                  <option value="Directors">Directors</option>
                  <option value="Senior Director">Senior Director</option>
                  <option value="Secretary">Secretary</option>
                  <option value="Joint Secretary">Joint Secretary</option>
                  <option value="President">President</option>
                  <option value="Vice President">Vice President</option>
                  <option value="IPP - Immediate Past President">IPP - Immediate Past President</option>
                  <option value="Executive Director">Executive Director</option>
                  <option value="Treasurer">Treasurer</option>
                </select>
              </Field>
            </div>
          )}

          <label className="mpf-inline-toggle">
            <input
              type="checkbox"
              checked={form.member.isMarried}
              onChange={(e) => setMember({ isMarried: e.target.checked })}
            />
            Married
          </label>
        </section>

        {/* 2. Residence — the member's own home */}
        <section className="mpf-card">
          <h2>2. Residence</h2>
          <div className="mpf-grid">
            <Field label="Home address" required full error={errFor("residence.address")}>
              <input
                type="text"
                value={form.residence.address}
                onChange={(e) => setResidence({ address: e.target.value })}
              />
            </Field>
            <Field label="Area">
              <input
                type="text"
                value={form.residence.area}
                onChange={(e) => setResidence({ area: e.target.value })}
              />
            </Field>
            <Field label="City">
              <input
                type="text"
                value={form.residence.city}
                onChange={(e) => setResidence({ city: e.target.value })}
              />
            </Field>
            <Field label="Pin code">
              <input
                type="text"
                value={form.residence.pinCode}
                onChange={(e) => setResidence({ pinCode: e.target.value })}
              />
            </Field>

            <LocationField
              label="Home location"
              lat={form.residence.lat}
              lng={form.residence.lng}
              onSelect={(lat, lng) => setResidence({ lat, lng })}
              onUseCurrent={() => captureLocation(setResidence, false)}
            />
          </div>
        </section>

        {/* 3. Business — shown only when profession is Business */}
        {form.member.profession === "Business" && (
          <section className="mpf-card">
            <h2>3. Business</h2>
            <div className="mpf-grid">
              <Field label="Business name" required full error={errFor("business.name")}>
                <input
                  type="text"
                  value={form.business.name}
                  onChange={(e) => setBusiness({ name: e.target.value })}
                />
              </Field>
              <Field label="Business description" full>
                <input
                  type="text"
                  value={form.business.description}
                  onChange={(e) => setBusiness({ description: e.target.value })}
                />
              </Field>
              <Field label="Office address 1" required error={errFor("business.address1")}>
                <input
                  type="text"
                  value={form.business.address1}
                  onChange={(e) => setBusiness({ address1: e.target.value })}
                />
              </Field>
              <Field label="Office address 2">
                <input
                  type="text"
                  value={form.business.address2}
                  onChange={(e) => setBusiness({ address2: e.target.value })}
                />
              </Field>
              <Field label="Area">
                <input
                  type="text"
                  value={form.business.area}
                  onChange={(e) => setBusiness({ area: e.target.value })}
                />
              </Field>
              <Field label="City" required error={errFor("business.city")}>
                <input
                  type="text"
                  value={form.business.city}
                  onChange={(e) => setBusiness({ city: e.target.value })}
                />
              </Field>
              <Field label="Pin code">
                <input
                  type="text"
                  value={form.business.pinCode}
                  onChange={(e) => setBusiness({ pinCode: e.target.value })}
                />
              </Field>
              <Field label="Nature of business">
                <input
                  type="text"
                  value={form.business.natureOfBusiness}
                  onChange={(e) => setBusiness({ natureOfBusiness: e.target.value })}
                />
              </Field>
              <Field label="Sub category">
                <input
                  type="text"
                  value={form.business.subCategory}
                  onChange={(e) => setBusiness({ subCategory: e.target.value })}
                />
              </Field>
              <Field label="Office phone">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  value={form.business.officePhone}
                  onChange={(e) => setBusiness({ officePhone: digitsOnly(e.target.value, 12) })}
                />
              </Field>
              <Field label="Email ID">
                <input
                  type="text"
                  value={form.business.email}
                  onChange={(e) => setBusiness({ email: e.target.value })}
                />
              </Field>
              <Field label="Website" full>
                <input
                  type="text"
                  value={form.business.website}
                  onChange={(e) => setBusiness({ website: e.target.value })}
                />
              </Field>

              <LocationField
                label="Business location"
                lat={form.business.lat}
                lng={form.business.lng}
                onSelect={(lat, lng) => setBusiness({ lat, lng })}
                onUseCurrent={() => captureLocation(setBusiness, false)}
              />
            </div>
          </section>
        )}

        {/* 3. Service — shown only when profession is Service */}
        {form.member.profession === "Service" && (
          <section className="mpf-card">
            <h2>3. Service</h2>
            <div className="mpf-grid mpf-cols-3">
              <Field label="Company" required error={errFor("service.company")}>
                <input
                  type="text"
                  value={form.service.company}
                  onChange={(e) => setService({ company: e.target.value })}
                />
              </Field>
              <Field label="Sector">
                <input
                  type="text"
                  value={form.service.sector}
                  onChange={(e) => setService({ sector: e.target.value })}
                />
              </Field>
              <Field label="Designation" required error={errFor("service.designation")}>
                <input
                  type="text"
                  value={form.service.designation}
                  onChange={(e) => setService({ designation: e.target.value })}
                />
              </Field>
            </div>
          </section>
        )}

        {/* 4. Ancestry */}
        <section className="mpf-card">
          <h2>4. Ancestry</h2>
          <div className="mpf-grid mpf-cols-3">
            <Field label="Ancestral place">
              <input
                type="text"
                value={form.ancestry.place}
                onChange={(e) => setAncestry({ place: e.target.value })}
              />
            </Field>
            <Field label="Ancestral state">
              <input
                type="text"
                value={form.ancestry.state}
                onChange={(e) => setAncestry({ state: e.target.value })}
              />
            </Field>
            <Field label="Gotra">
              <input
                type="text"
                value={form.ancestry.gotra}
                onChange={(e) => setAncestry({ gotra: e.target.value })}
              />
            </Field>
          </div>
        </section>

        {/* 5. Wife's details */}
        {form.member.isMarried && (
          <section className="mpf-card">
            <h2>
              5. Wife&apos;s details{" "}
              <span className="mpf-toggle-hint">
                {form.wife.memberId
                  ? "— shown only if member is married"
                  : "— no linked record yet, so changes here cannot be saved"}
              </span>
            </h2>

            <h3 className="mpf-sub">5a. Personal</h3>
            <div className="mpf-grid">
              <Field label="Name" required error={errFor("wife.name")}>
                <input
                  type="text"
                  value={form.wife.name}
                  onChange={(e) => setWife({ name: e.target.value })}
                />
              </Field>
              <Field label="Wife's father's name" required error={errFor("wife.fatherName")}>
                <input
                  type="text"
                  value={form.wife.fatherName}
                  onChange={(e) => setWife({ fatherName: e.target.value })}
                />
              </Field>
              <Field label="Profession">
                <select
                  value={form.wife.profession}
                  onChange={(e) => setWife({ profession: e.target.value })}
                >
                  <option value="">Select</option>
                  <option value="housewife">Housewife</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Mobile number" required error={errFor("wife.mobile")}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.wife.mobile}
                  onChange={(e) => setWife({ mobile: digitsOnly(e.target.value) })}
                />
              </Field>
              <Field label="Alternate contact">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.wife.altContact}
                  onChange={(e) => setWife({ altContact: digitsOnly(e.target.value) })}
                />
              </Field>
              <DatePickerField
                label="Date of birth"
                value={form.wife.dob}
                onChange={(v) => setWife({ dob: v })}
              />
              <Field label="Education">
                <input
                  type="text"
                  value={form.wife.education}
                  onChange={(e) => setWife({ education: e.target.value })}
                />
              </Field>
              <DatePickerField
                label="Marriage anniversary"
                value={form.wife.anniversary}
                onChange={(v) => setWife({ anniversary: v })}
              />
              <Field label="Wife's photo">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setWife({ photo: e.target.files?.[0] || null })}
                />
              </Field>
              <Field label="Couple photo">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setWife({ couplePhoto: e.target.files?.[0] || null })}
                />
              </Field>
            </div>

            <h3 className="mpf-sub">5b. Residence</h3>
            <div className="mpf-grid">
              <Field label="Residence address" required full error={errFor("wife.residence.address")}>
                <div className="mpf-address-row">
                  <input
                    type="text"
                    disabled={form.wife.residence.sameAsHusband}
                    value={form.wife.residence.address}
                    onChange={(e) => setWifeResidence({ address: e.target.value })}
                  />
                  <label className="mpf-same-as">
                    <input
                      type="checkbox"
                      checked={form.wife.residence.sameAsHusband}
                      onChange={(e) => toggleResidenceSameAsHusband(e.target.checked)}
                    />
                    Same as Husband
                  </label>
                </div>
              </Field>
              <Field label="Residence area">
                <input
                  type="text"
                  disabled={form.wife.residence.sameAsHusband}
                  value={form.wife.residence.area}
                  onChange={(e) => setWifeResidence({ area: e.target.value })}
                />
              </Field>
              <Field label="Residence city">
                <input
                  type="text"
                  disabled={form.wife.residence.sameAsHusband}
                  value={form.wife.residence.city}
                  onChange={(e) => setWifeResidence({ city: e.target.value })}
                />
              </Field>
              <Field label="Residence pin code">
                <input
                  type="text"
                  disabled={form.wife.residence.sameAsHusband}
                  value={form.wife.residence.pinCode}
                  onChange={(e) => setWifeResidence({ pinCode: e.target.value })}
                />
              </Field>

              <LocationField
                label="Residence location"
                lat={form.wife.residence.lat}
                lng={form.wife.residence.lng}
                disabled={form.wife.residence.sameAsHusband}
                onSelect={(lat, lng) => setWifeResidence({ lat, lng })}
                onUseCurrent={() => captureLocation(setWifeResidence, form.wife.residence.sameAsHusband)}
              />
            </div>

            {form.wife.profession && form.wife.profession !== "housewife" && (
              <>
                <h3 className="mpf-sub">
                  5c. Business <span className="mpf-toggle-hint">— shown only if profession is not Housewife</span>
                </h3>
                <div className="mpf-grid">
                  <Field label="Business name" full>
                    <input
                      type="text"
                      value={form.wife.business.name}
                      onChange={(e) => setWifeBusiness({ name: e.target.value })}
                    />
                  </Field>
                  <Field label="Business description" full>
                    <input
                      type="text"
                      value={form.wife.business.description}
                      onChange={(e) => setWifeBusiness({ description: e.target.value })}
                    />
                  </Field>

                  <Field label="Office address" required full error={errFor("wife.business.address")}>
                    <div className="mpf-address-row">
                      <input
                        type="text"
                        disabled={form.wife.business.sameAsHusband}
                        value={form.wife.business.address}
                        onChange={(e) => setWifeBusiness({ address: e.target.value })}
                      />
                      <label className="mpf-same-as">
                        <input
                          type="checkbox"
                          checked={form.wife.business.sameAsHusband}
                          onChange={(e) => toggleWifeBusinessSameAsHusband(e.target.checked)}
                        />
                        Same as Husband
                      </label>
                    </div>
                  </Field>

                  <Field label="Area">
                    <input
                      type="text"
                      disabled={form.wife.business.sameAsHusband}
                      value={form.wife.business.area}
                      onChange={(e) => setWifeBusiness({ area: e.target.value })}
                    />
                  </Field>
                  <Field label="City">
                    <input
                      type="text"
                      disabled={form.wife.business.sameAsHusband}
                      value={form.wife.business.city}
                      onChange={(e) => setWifeBusiness({ city: e.target.value })}
                    />
                  </Field>
                  <Field label="Pin code">
                    <input
                      type="text"
                      disabled={form.wife.business.sameAsHusband}
                      value={form.wife.business.pinCode}
                      onChange={(e) => setWifeBusiness({ pinCode: e.target.value })}
                    />
                  </Field>
                  <Field label="Nature of business">
                    <input
                      type="text"
                      value={form.wife.business.natureOfBusiness}
                      onChange={(e) => setWifeBusiness({ natureOfBusiness: e.target.value })}
                    />
                  </Field>
                  <Field label="Office phone">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      value={form.wife.business.officePhone}
                      onChange={(e) => setWifeBusiness({ officePhone: digitsOnly(e.target.value, 12) })}
                    />
                  </Field>
                  <Field label="Email ID">
                    <input
                      type="text"
                      value={form.wife.business.email}
                      onChange={(e) => setWifeBusiness({ email: e.target.value })}
                    />
                  </Field>
                  <Field label="Website" full>
                    <input
                      type="text"
                      value={form.wife.business.website}
                      onChange={(e) => setWifeBusiness({ website: e.target.value })}
                    />
                  </Field>

                  <LocationField
                    label="Business location"
                    lat={form.wife.business.lat}
                    lng={form.wife.business.lng}
                    disabled={form.wife.business.sameAsHusband}
                    onSelect={(lat, lng) => setWifeBusiness({ lat, lng })}
                    onUseCurrent={() => captureLocation(setWifeBusiness, form.wife.business.sameAsHusband)}
                  />
                </div>
              </>
            )}
          </section>
        )}

        {/* 6. Children */}
        {form.member.isMarried && (
          <section className="mpf-card">
            <h2>
              6. Children <span className="mpf-toggle-hint">— shown only if member is married</span>
            </h2>
            <div className="mpf-note">
              Same field set repeats per child, up to 4. Children already on the record can be
              edited here; a brand-new child has to be added by the club office, because each
              child is a member record of their own.
            </div>

            {form.children.map((child, i) => (
              <div className="mpf-repeat-block" key={child.memberId || i}>
                <div className="mpf-repeat-label-row">
                  <span className="mpf-repeat-label">
                    Child {i + 1}
                    {!child.memberId && child.name ? " — not yet on record" : ""}
                  </span>
                  {form.children.length > 1 && (
                    <button type="button" className="mpf-remove" onClick={() => removeChild(i)}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="mpf-grid">
                  <Field label="Name" required error={errFor(`children.${i}.name`)}>
                    <input
                      type="text"
                      value={child.name}
                      onChange={(e) => setChild(i, { name: e.target.value })}
                    />
                  </Field>
                  <DatePickerField
                    label="Date of birth"
                    value={child.dob}
                    onChange={(v) => setChild(i, { dob: v })}
                  />
                  <Field label="Education">
                    <input
                      type="text"
                      value={child.education}
                      onChange={(e) => setChild(i, { education: e.target.value })}
                    />
                  </Field>
                  <Field label="Mobile number">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={child.mobile}
                      onChange={(e) => setChild(i, { mobile: digitsOnly(e.target.value) })}
                    />
                  </Field>
                  <Field label="Additional info" full>
                    <input
                      type="text"
                      value={child.additionalInfo}
                      onChange={(e) => setChild(i, { additionalInfo: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ))}

            {form.children.length < 4 && (
              <button type="button" className="mpf-ghost" onClick={addChild}>
                + Add another child
              </button>
            )}
          </section>
        )}

        <div className="mpf-actions">
          <button type="button" className="mpf-cancel" onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="mpf-save" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- small presentational helpers ------------------------------------

function Field({ label, required, full, error, children }) {
  return (
    <div
      className={
        "mpf-field" +
        (full ? " mpf-field-full" : "") +
        (error ? " mpf-field-error" : "")
      }
    >
      <label>
        {label}
        {required && <span className="mpf-req"> *</span>}
      </label>
      {children}
      {error && <span className="mpf-field-error-text">{error}</span>}
    </div>
  );
}

/**
 * Status line, a "Use current location" shortcut, and a map that stays shut
 * until asked for.
 *
 * Four of these appear on a full profile. Rendering every map immediately
 * turned the page into a wall of tiles and made each one fetch its own
 * imagery on load, so the map is mounted only once the button is pressed —
 * which also means a member who never touches locations never pays for a
 * single map.
 *
 * The coordinates themselves are deliberately never rendered. They live in
 * form state and travel with the save payload.
 */
function LocationField({ label = "Location", lat, lng, disabled, onSelect, onUseCurrent }) {
  const [open, setOpen] = useState(false);
  const hasLocation = !!(lat && lng);

  return (
    <div className="mpf-loc">
      <div className="mpf-geo-row">
        <div className="mpf-geo-status">
          <span className={"mpf-geo-dot" + (hasLocation ? " mpf-geo-dot-set" : "")} aria-hidden="true" />
          <span className="mpf-geo-status-text">
            {label}: {hasLocation ? "📍 set" : "not set yet"}
          </span>
        </div>
        <div className="mpf-geo-actions">
          <button
            type="button"
            className="mpf-geo-btn"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Hide map" : hasLocation ? "Change on map" : "Set on map"}
          </button>
          <button type="button" className="mpf-geo-btn" disabled={disabled} onClick={onUseCurrent}>
            Use current location
          </button>
        </div>
      </div>

      {open && !disabled && (
        <div className="mpf-loc-map">
          <MapPicker initialLat={lat} initialLng={lng} onLocationSelect={onSelect} />
          <p className="mpf-location-hint">
            &quot;Use current location&quot; is approximate on laptops (no GPS chip) —
            for an exact spot, click or drag the pin.
          </p>
        </div>
      )}
    </div>
  );
}

// ---- custom calendar date picker ---------------------------------------
// Renders its own dropdown calendar instead of relying on the browser's
// native <input type="date"> UI (which on some setups shows no visible
// calendar icon/button, leaving people unable to pick a date with the
// mouse at all). Stores/returns the same "YYYY-MM-DD" string either way,
// so setMember({ dob }) etc. don't need to change.

const DP_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DP_WEEKDAYS = ["S","M","T","W","T","F","S"];

function pad2(n) { return String(n).padStart(2, "0"); }

function isoToDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function buildCalendarWeeks(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function DatePickerField({ label, value, onChange, required, error }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const parsed = value ? new Date(value) : null;
  const [viewYear, setViewYear] = useState((parsed && !isNaN(parsed)) ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed && !isNaN(parsed)) ? parsed.getMonth() : today.getMonth());
  const wrapRef = useRef(null);

  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  function pick(day) {
    const iso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
    onChange(iso);
    setOpen(false);
  }

  function goPrev() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else { setViewMonth((m) => m - 1); }
  }
  function goNext() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else { setViewMonth((m) => m + 1); }
  }

  const weeks = buildCalendarWeeks(viewYear, viewMonth);

  return (
    <div
      className={"mpf-field" + (error ? " mpf-field-error" : "")}
      ref={wrapRef}
      style={{ position: "relative" }}
    >
      <label>
        {label}
        {required && <span className="mpf-req"> *</span>}
      </label>
      <button
        type="button"
        className="mpf-date-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: value ? "var(--text)" : "var(--text-muted)" }}>
          {value ? isoToDisplay(value) : "DD/MM/YYYY"}
        </span>
        <span aria-hidden="true">📅</span>
      </button>
      {error && <span className="mpf-field-error-text">{error}</span>}

      {open && (
        <div className="mpf-date-popover">
          <div className="mpf-date-popover-head">
            <button type="button" onClick={goPrev} className="mpf-date-nav">‹</button>
            <span>{DP_MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={goNext} className="mpf-date-nav">›</button>
          </div>
          <div className="mpf-date-weekrow">
            {DP_WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          {weeks.map((week, wi) => (
            <div className="mpf-date-weekrow" key={wi}>
              {week.map((day, di) => {
                if (day === null) return <span key={di} className="mpf-date-cell" />;
                const iso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
                const isSelected = iso === value;
                return (
                  <button
                    type="button"
                    key={di}
                    className={"mpf-date-cell mpf-date-day" + (isSelected ? " mpf-date-day-selected" : "")}
                    onClick={() => pick(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- styles -----------------------------------------------------------

const css = `
  .mpf-outer {
    --border: #B9B6AC;
    --border-light: #D8D5CB;
    --surface: #FAF9F5;
    --card: #FFFFFF;
    --text: #2B2A27;
    --text-muted: #7A776E;
    --accent: #B3413A;
    width: 100%;
    background: var(--surface);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .mpf-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 16px 80px;
  }
  .mpf-page * { box-sizing: border-box; }
  .mpf-doc-head { margin-bottom: 24px; }
  .mpf-doc-head h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
  .mpf-doc-head p { margin: 0; color: var(--text-muted); font-size: 13px; }
  .mpf-legend { font-size: 12px; color: var(--text-muted); margin-top: 10px; }
  .mpf-req { color: var(--accent); font-weight: 600; }

  .mpf-banner { border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
  .mpf-banner-error { background: #F7E3E1; color: #7A2E28; border: 1px solid #E3B3AE; }
  .mpf-banner-success { background: #E4F0E1; color: #2E5C2A; border: 1px solid #B9D9B2; }

  .mpf-card {
    background: var(--card);
    border: 1px solid var(--border-light);
    border-radius: 10px;
    padding: 20px 22px;
    margin-bottom: 16px;
  }
  .mpf-card h2 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
  .mpf-toggle-hint { font-size: 11px; font-weight: 400; color: var(--text-muted); margin-left: 8px; }
  .mpf-sub {
    font-size: 12.5px; font-weight: 600; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.03em;
    margin: 18px 0 10px; padding-top: 12px; border-top: 1px dashed var(--border-light);
  }

  .mpf-inline-toggle { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 13px; }
  .mpf-inline-toggle input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--accent); }

  .mpf-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px 16px; margin-top: 12px; }
  .mpf-cols-3 { grid-template-columns: repeat(3, minmax(0,1fr)); }

  @media (max-width: 900px) {
    .mpf-grid, .mpf-cols-3 { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 560px) {
    .mpf-grid, .mpf-cols-3 { grid-template-columns: 1fr; }
  }
  .mpf-field { display: flex; flex-direction: column; gap: 4px; }
  .mpf-field-full { grid-column: 1 / -1; }
  .mpf-field label { font-size: 12px; color: var(--text-muted); }
  .mpf-field input[type="text"], .mpf-field input[type="date"], .mpf-field input[type="file"], .mpf-field select {
    height: 34px; border: 1px solid var(--border); border-radius: 6px; padding: 0 10px;
    font-size: 13px; background: var(--card); color: var(--text); width: 100%;
  }
  .mpf-field input[type="file"] { padding: 6px 10px; font-size: 12px; }
  .mpf-field input:focus, .mpf-field select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .mpf-field input:disabled, .mpf-field select:disabled { background: #F0EFEA; color: var(--text-muted); }
  .mpf-field-error-text { font-size: 11px; color: var(--accent); font-weight: 600; }
  .mpf-field-error input[type="text"],
  .mpf-field-error input[type="date"],
  .mpf-field-error input[type="file"],
  .mpf-field-error select {
    border-color: var(--accent) !important;
    border-width: 1.5px !important;
    background: #FDF3F2;
  }
    .mpf-doc-head-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.mpf-create-event-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.mpf-create-event-btn:hover { opacity: 0.9; }

  .mpf-address-row { display: flex; align-items: flex-end; gap: 10px; }
  .mpf-address-row input { flex: 1; }
  .mpf-same-as { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; white-space: nowrap; font-size: 12.5px; color: var(--text); }
  .mpf-same-as input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--accent); }

  /* Collapsible location block */
  .mpf-loc { grid-column: 1 / -1; margin-top: 4px; }
  .mpf-loc-map { margin-top: 10px; }
  .mpf-geo-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; flex-wrap: wrap;
    background: #F7F6F2; border: 1px solid var(--border-light);
    border-radius: 8px; padding: 10px 12px;
  }
  .mpf-geo-status { display: flex; align-items: center; gap: 8px; }
  .mpf-geo-dot { width: 8px; height: 8px; border-radius: 4px; background: var(--border); flex-shrink: 0; }
  .mpf-geo-dot-set { background: #2E6B3E; }
  .mpf-geo-status-text { font-size: 12.5px; color: var(--text-muted); }
  .mpf-geo-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .mpf-geo-btn { height: 32px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); font-size: 12px; color: var(--text); cursor: pointer; white-space: nowrap; }
  .mpf-geo-btn:disabled { color: var(--text-muted); cursor: not-allowed; }

  .mpf-note { font-size: 12px; color: var(--text-muted); margin-top: 10px; font-style: italic; }
  .mpf-location-hint { font-size: 11.5px; color: var(--text-muted); margin: 6px 0 0; font-style: italic; }

  .mpf-repeat-block { border: 1px dashed var(--border); border-radius: 8px; padding: 14px 16px; margin-top: 8px; }
  .mpf-repeat-label-row { display: flex; align-items: center; justify-content: space-between; }
  .mpf-repeat-label { font-size: 11.5px; color: var(--text-muted); margin-bottom: 8px; }
  .mpf-remove { border: none; background: none; color: var(--accent); font-size: 12px; cursor: pointer; }

  .mpf-ghost { margin-top: 14px; height: 34px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); font-size: 13px; color: var(--text); cursor: pointer; }
  .mpf-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
  .mpf-actions button { height: 38px; padding: 0 18px; border-radius: 6px; font-size: 13.5px; cursor: pointer; border: none; }
  .mpf-cancel { background: var(--card); border: 1px solid var(--border) !important; color: var(--text); }
  .mpf-save { background: var(--text); color: #fff; font-weight: 600; }
  .mpf-actions button:disabled { opacity: 0.6; cursor: not-allowed; }

  .mpf-date-trigger {
    height: 34px; width: 100%; border: 1px solid var(--border); border-radius: 6px;
    padding: 0 10px; background: var(--card); font-size: 13px; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between;
    font-family: inherit; color: var(--text);
  }
  .mpf-date-trigger:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .mpf-field-error .mpf-date-trigger { border-color: var(--accent); border-width: 1.5px; background: #FDF3F2; }

  .mpf-date-popover {
    position: absolute; top: 100%; left: 0; margin-top: 6px; z-index: 20;
    background: var(--card); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px; width: 240px; box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  }
  .mpf-date-popover-head {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 12.5px; font-weight: 600; color: var(--text); margin-bottom: 8px;
  }
  .mpf-date-nav {
    border: none; background: none; font-size: 16px; cursor: pointer;
    color: var(--text); width: 24px; height: 24px; border-radius: 4px;
  }
  .mpf-date-nav:hover { background: #F0EFEA; }
  .mpf-date-weekrow { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .mpf-date-weekrow span { width: 28px; text-align: center; font-size: 10.5px; color: var(--text-muted); }
  .mpf-date-cell {
    width: 28px; height: 28px; border: none; background: none; border-radius: 6px;
    font-size: 12px; color: var(--text); cursor: pointer; display: inline-flex;
    align-items: center; justify-content: center;
  }
  .mpf-date-day:hover { background: #F0EFEA; }
  .mpf-date-day-selected { background: var(--accent); color: #fff; font-weight: 700; }
`;
