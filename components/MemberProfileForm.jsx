"use client";
// ^ Required in Next.js App Router — this component uses useState/useCallback
// and browser-only APIs (navigator.geolocation), so it must render on the
// client, not the server.

import React, { useState, useCallback } from "react";

/**
 * MemberProfileForm
 * ------------------
 * React conversion of the "Member Profile Form" wireframe.
 *
 * WHAT'S WIRED UP:
 *  - All fields from the wireframe as controlled state
 *  - Conditional sections: Board designation, Wife's section (married),
 *    Wife's business (profession !== housewife), "Same as Husband" address copy
 *  - Children repeater (add / remove, capped at 4)
 *  - Geolocation capture button (📍 Use current location) for each address block
 *  - Lat/Lng fields that a parent Map-picker component can prefill via the
 *    `initialValues` prop (see MAP INTEGRATION note near the bottom)
 *  - Basic required-field validation
 *  - Submit handler that POSTs to an API (multipart/form-data, so photo
 *    files travel with the rest of the payload)
 *
 * HOW TO WIRE THE SAVE API:
 *  Pass `apiEndpoint` (e.g. "/api/members") and optionally `authToken`.
 *  On submit, this component builds a FormData object and POSTs it.
 *  Adjust `buildFormData()` / `saveMember()` below to match your backend's
 *  exact field names if they differ.
 */

// Strips anything that isn't a digit and caps the length — used on every
// mobile/phone number field so letters, symbols, spaces etc. can't be typed
// or pasted in.
const digitsOnly = (value, maxLen = 10) => value.replace(/\D/g, "").slice(0, maxLen);

const emptyChild = () => ({
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
  },
  business: {
    name: "",
    description: "",
    address1: "",
    address2: "",
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
  ancestry: {
    place: "",
    state: "",
    gotra: "",
  },
  wife: {
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
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ---- generic setters -----------------------------------------------

  const setMember = useCallback((patch) => {
    setForm((f) => ({ ...f, member: { ...f.member, ...patch } }));
  }, []);

  const setBusiness = useCallback((patch) => {
    setForm((f) => ({ ...f, business: { ...f.business, ...patch } }));
  }, []);

  const setAncestry = useCallback((patch) => {
    setForm((f) => ({ ...f, ancestry: { ...f.ancestry, ...patch } }));
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

  const toggleResidenceSameAsHusband = (checked) => {
    if (checked) {
      setWifeResidence({
        sameAsHusband: true,
        address: form.business.address1,
        area: form.business.area,
        city: form.business.city,
        pinCode: form.business.pinCode,
        lat: form.business.lat,
        lng: form.business.lng,
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
  // MAP INTEGRATION NOTE:
  // Once you drop in a real map picker, replace/augment this handler so that
  // choosing a point on the map calls the matching setter (setBusiness,
  // setWifeResidence, setWifeBusiness) with { lat, lng }. This button-based
  // browser geolocation capture can stay as a "use my current location" shortcut
  // alongside the map, or be removed once the map is the only entry point.
  const captureLocation = (setter, disabled) => {
    if (disabled) return;
    if (!navigator.geolocation) {
      setSaveError("Geolocation is not supported in this browser.");
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

    req(form.business.name, "business.name");
    req(form.business.address1, "business.address1");
    req(form.business.city, "business.city");

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

    fd.append("business", JSON.stringify(form.business));
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

  async function saveMember() {
    const fd = buildFormData();
    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: fd,
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
    setSaveSuccess(false);
    if (!validate()) {
      setSaveError("Please fill in the required fields highlighted below.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveMember();
      setSaveSuccess(true);
      onSaved(result);
    } catch (err) {
      setSaveError(err.message || "Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(initialFormState);
    setErrors({});
    setSaveError("");
    setSaveSuccess(false);
  };

  return (
    <div className="mpf-page">
      <style>{css}</style>

      <header className="mpf-doc-head">
        <h1>Member profile form</h1>
        <p>Save a member's full profile — personal, business and family details.</p>
        <div className="mpf-legend">
          <span className="mpf-req">*</span> indicates a mandatory field
        </div>
      </header>

      {saveError && <div className="mpf-banner mpf-banner-error">{saveError}</div>}
      {saveSuccess && <div className="mpf-banner mpf-banner-success">Member saved successfully.</div>}

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
          <Field label="Date of birth (DD/MM/YY)" required error={errFor("member.dob")}>
            <input
              type="text"
              placeholder="DD/MM/YY"
              value={form.member.dob}
              onChange={(e) => setMember({ dob: e.target.value })}
            />
          </Field>
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
              <input
                type="text"
                value={form.member.boardDesignation}
                onChange={(e) => setMember({ boardDesignation: e.target.value })}
              />
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

      {/* 2. Business */}
      <section className="mpf-card">
        <h2>2. Business</h2>
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

          <GeoRow
            lat={form.business.lat}
            lng={form.business.lng}
            onLat={(v) => setBusiness({ lat: v })}
            onLng={(v) => setBusiness({ lng: v })}
            onUseCurrent={() => captureLocation(setBusiness, false)}
          />
        </div>
      </section>

      {/* 3. Ancestry */}
      <section className="mpf-card">
        <h2>3. Ancestry</h2>
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

      {/* 4. Wife's details */}
      {form.member.isMarried && (
        <section className="mpf-card">
          <h2>
            4. Wife's details <span className="mpf-toggle-hint">— shown only if member is married</span>
          </h2>

          <h3 className="mpf-sub">4a. Personal</h3>
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
            <Field label="Date of birth">
              <input
                type="text"
                value={form.wife.dob}
                onChange={(e) => setWife({ dob: e.target.value })}
              />
            </Field>
            <Field label="Education">
              <input
                type="text"
                value={form.wife.education}
                onChange={(e) => setWife({ education: e.target.value })}
              />
            </Field>
            <Field label="Marriage anniversary">
              <input
                type="text"
                value={form.wife.anniversary}
                onChange={(e) => setWife({ anniversary: e.target.value })}
              />
            </Field>
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

          <h3 className="mpf-sub">4b. Residence</h3>
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

            <GeoRow
              lat={form.wife.residence.lat}
              lng={form.wife.residence.lng}
              disabled={form.wife.residence.sameAsHusband}
              onLat={(v) => setWifeResidence({ lat: v })}
              onLng={(v) => setWifeResidence({ lng: v })}
              onUseCurrent={() => captureLocation(setWifeResidence, form.wife.residence.sameAsHusband)}
            />
          </div>

          {form.wife.profession && form.wife.profession !== "housewife" && (
            <>
              <h3 className="mpf-sub">
                4c. Business <span className="mpf-toggle-hint">— shown only if profession is not Housewife</span>
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

                <GeoRow
                  lat={form.wife.business.lat}
                  lng={form.wife.business.lng}
                  disabled={form.wife.business.sameAsHusband}
                  onLat={(v) => setWifeBusiness({ lat: v })}
                  onLng={(v) => setWifeBusiness({ lng: v })}
                  onUseCurrent={() => captureLocation(setWifeBusiness, form.wife.business.sameAsHusband)}
                />
              </div>
            </>
          )}
        </section>
      )}

      {/* 5. Children */}
      {form.member.isMarried && (
        <section className="mpf-card">
          <h2>
            5. Children <span className="mpf-toggle-hint">— shown only if member is married</span>
          </h2>
          <div className="mpf-note">Same field set repeats per child, up to 4</div>

          {form.children.map((child, i) => (
            <div className="mpf-repeat-block" key={i}>
              <div className="mpf-repeat-label-row">
                <span className="mpf-repeat-label">Child {i + 1}</span>
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
                <Field label="Date of birth">
                  <input
                    type="text"
                    value={child.dob}
                    onChange={(e) => setChild(i, { dob: e.target.value })}
                  />
                </Field>
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
          {saving ? "Saving…" : "Save member"}
        </button>
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

function GeoRow({ lat, lng, disabled, onLat, onLng, onUseCurrent }) {
  return (
    <div className="mpf-geo-row">
      <Field label="Latitude">
        <input
          type="text"
          placeholder="e.g. 23.0225"
          disabled={disabled}
          value={lat}
          onChange={(e) => onLat(e.target.value)}
        />
      </Field>
      <Field label="Longitude">
        <input
          type="text"
          placeholder="e.g. 72.5714"
          disabled={disabled}
          value={lng}
          onChange={(e) => onLng(e.target.value)}
        />
      </Field>
      <button type="button" className="mpf-geo-btn" disabled={disabled} onClick={onUseCurrent}>
        📍 Use current location
      </button>
    </div>
  );
}

// ---- styles (ported from the wireframe) -------------------------------

const css = `
  .mpf-page {
    --border: #B9B6AC;
    --border-light: #D8D5CB;
    --surface: #FAF9F5;
    --card: #FFFFFF;
    --text: #2B2A27;
    --text-muted: #7A776E;
    --accent: #B3413A;
    max-width: 760px;
    margin: 0 auto;
    background: var(--surface);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
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

  .mpf-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px 16px; margin-top: 12px; }
  .mpf-cols-3 { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .mpf-field { display: flex; flex-direction: column; gap: 4px; }
  .mpf-field-full { grid-column: 1 / -1; }
  .mpf-field label { font-size: 12px; color: var(--text-muted); }
  .mpf-field input[type="text"], .mpf-field input[type="file"], .mpf-field select {
    height: 34px; border: 1px solid var(--border); border-radius: 6px; padding: 0 10px;
    font-size: 13px; background: var(--card); color: var(--text); width: 100%;
  }
  .mpf-field input[type="file"] { padding: 6px 10px; font-size: 12px; }
  .mpf-field input:focus, .mpf-field select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .mpf-field input:disabled, .mpf-field select:disabled { background: #F0EFEA; color: var(--text-muted); }
  .mpf-field-error-text { font-size: 11px; color: var(--accent); font-weight: 600; }
  .mpf-field-error input[type="text"],
  .mpf-field-error input[type="file"],
  .mpf-field-error select {
    border-color: var(--accent) !important;
    border-width: 1.5px !important;
    background: #FDF3F2;
  }

  .mpf-address-row { display: flex; align-items: flex-end; gap: 10px; }
  .mpf-address-row .mpf-field { flex: 1; }
  .mpf-same-as { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; white-space: nowrap; font-size: 12.5px; color: var(--text); }
  .mpf-same-as input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--accent); }

  .mpf-geo-row { display: flex; align-items: flex-end; gap: 10px; grid-column: 1 / -1; }
  .mpf-geo-row .mpf-field { flex: 1; }
  .mpf-geo-btn { height: 34px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); font-size: 12px; color: var(--text); cursor: pointer; }
  .mpf-geo-btn:disabled { color: var(--text-muted); cursor: not-allowed; }

  .mpf-note { font-size: 12px; color: var(--text-muted); margin-top: 10px; font-style: italic; }

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
`;