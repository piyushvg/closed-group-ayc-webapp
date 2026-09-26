// app/api/member/me/route.js
//
// GET  → the logged-in member's saved details, shaped for MemberProfileForm.
// POST → saves whatever they changed.
//
// The member id comes from the signed session cookie, never from the
// request body — otherwise anyone could read or overwrite another member's
// profile just by changing an id in devtools. The spouse's and children's
// ids DO come from the body, but only after being matched against the ids
// this member is actually linked to.

import { frappePost, FRAPPE_METHODS } from "@/lib/frappe";
import { clearSessionCookie, getSession } from "@/lib/session";

// Prints every payload to the terminal before it is sent. Frappe's errors
// ("Value missing for Businesses: Business Name") name a field but not which
// of the several calls produced it, so seeing the exact body is the only way
// to tell the member's own save apart from the spouse's.
const DEBUG = process.env.NODE_ENV !== "production";

function logPayload(label, payload) {
  if (DEBUG) console.log(`[member/me] ${label}:`, JSON.stringify(payload, null, 2));
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    // Cookie present but invalid (old SESSION_SECRET, expired, edited): wipe
    // it, or middleware keeps bouncing /login back to /portal.
    await clearSessionCookie();
    return Response.json({ message: "Not signed in." }, { status: 401 });
  }

  try {
    const member = await frappePost(FRAPPE_METHODS.getMemberDetails, {
      member_id: session.memberId,
    });

    return Response.json({
      memberId: session.memberId,
      raw: member,
      form: mapMemberToForm(member),
    });
  } catch (err) {
    return Response.json(
      { message: err.message || "Could not load your details." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    // Cookie present but invalid (old SESSION_SECRET, expired, edited): wipe
    // it, or middleware keeps bouncing /login back to /portal.
    await clearSessionCookie();
    return Response.json({ message: "Not signed in." }, { status: 401 });
  }

  // Tracks which call is in flight, so a Frappe error can say whose record
  // it came from instead of leaving everyone guessing.
  let step = "profile";

  try {
    const body = await request.json();

    // Re-read the record so related ids can be verified rather than trusted.
    const current = await frappePost(FRAPPE_METHODS.getMemberDetails, {
      member_id: session.memberId,
    });
    const linkedIds = new Set(
      (Array.isArray(current?.relatives) ? current.relatives : [])
        .map((r) => r?.member_id)
        .filter(Boolean)
    );

    const saved = [];
    const skipped = [];

    // --- 1. The member's own record -------------------------------------
    step = "your profile";
    const memberPayload = mapFormToPayload(body, session.memberId);
    logPayload("member payload", memberPayload);
    await frappePost(FRAPPE_METHODS.updateMember, memberPayload);
    saved.push("profile");

    // --- 2. The spouse ---------------------------------------------------
    // The spouse is NOT a set of fields on this record — it is a separate
    // member (MEM-000002 and the like) linked through `relatives` with
    // relation_type "Spouse". Saving their details means calling the same
    // endpoint again with THEIR member_id. Until this existed, everything
    // typed into the wife's section was simply dropped on save.
    const spouseId = body?.wife?.memberId;
    if (body?.member?.isMarried && spouseId) {
      if (linkedIds.has(spouseId)) {
        step = "spouse details";
        const spousePayload = mapRelativeToPayload(body.wife, spouseId);
        logPayload("spouse payload", spousePayload);
        await frappePost(FRAPPE_METHODS.updateMember, spousePayload);
        saved.push("spouse");
      } else {
        skipped.push("spouse (not linked to this member)");
      }
    } else if (body?.member?.isMarried) {
      // No spouse record exists yet — update_member can only edit people who
      // already exist, so the office has to create the spouse first.
      skipped.push("spouse (no linked record yet — ask the office to add them)");
    }

    // --- 3. Children -----------------------------------------------------
    // Same story: each child is their own member record.
    const children = Array.isArray(body?.children) ? body.children : [];
    for (const child of children) {
      if (!child?.name?.trim()) continue;

      if (child.memberId && linkedIds.has(child.memberId)) {
        step = `child ${child.name}`;
        const childPayload = mapRelativeToPayload(child, child.memberId);
        logPayload(`child payload (${child.name})`, childPayload);
        await frappePost(FRAPPE_METHODS.updateMember, childPayload);
        saved.push(`child ${child.name}`);
      } else if (!child.memberId) {
        skipped.push(`${child.name} (new children must be added by the office)`);
      }
    }

    return Response.json({
      ok: true,
      saved,
      skipped,
      message: skipped.length
        ? `Saved. Not saved: ${skipped.join("; ")}.`
        : "Saved successfully.",
    });
  } catch (err) {
    const detail = err.message || "Could not save your details.";
    if (DEBUG) console.error(`[member/me] failed while saving ${step}:`, detail);
    return Response.json(
      { message: `While saving ${step}: ${detail}` },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Field mapping
//
// These names come from a real get_member_details response, not from guesses.
// Four things about that response drive the shape below:
//
//   1. The record is mostly FLAT, but `businesses` is an array, `relatives`
//      is an array, and `spouse` is a nested copy of a whole member record.
//   2. Coordinates are `residence_latitude` / `residence_longitude` and
//      `business_latitude` / `business_longitude` — NOT latitude/longitude.
//   3. Phone numbers come back as "+91-8788830969". The form strips them to
//      ten digits for typing, and Frappe's Phone field refuses to save
//      anything without a country code, so the prefix goes back on.
//   4. Spouse and children are separate member records, reachable only by
//      their own member_id.
// ---------------------------------------------------------------------------

function str(value) {
  return value == null ? "" : String(value);
}

/** "+91-8788830969" → "8788830969". Keeps the last ten digits. */
function phone(value) {
  const digits = str(value).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * "8788830969" → "+91-8788830969".
 *
 * Frappe rejects a bare number with "Please select a country code for field
 * mobile_no". Numbers that already carry a code are left alone.
 */
function withCountryCode(value) {
  const raw = str(value).trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `+91-${digits}` : `+${digits}`;
}

/** The form's Profession dropdown only accepts these three values. */
function professionFor(record) {
  const raw = str(record.profession).trim();
  if (/^housewife$/i.test(raw)) return "Housewife";
  if (/^business$/i.test(raw)) return "Business";
  if (/^service$/i.test(raw)) return "Service";
  // Nothing usable stored, but the member clearly runs something.
  if (Array.isArray(record.businesses) && record.businesses.length) return "Business";
  return "";
}

/** One entry from a `businesses` array → the form's business block. */
function mapBusiness(b = {}) {
  return {
    // Carried so a save updates this business instead of creating a fourth.
    businessId: str(b.business_id),
    name: str(b.business_name),
    description: str(b.description),
    address1: str(b.office_address),
    address2: "",
    area: str(b.office_area),
    city: str(b.city),
    pinCode: str(b.pincode),
    natureOfBusiness: str(b.category),
    subCategory: str(b.sub_category),
    officePhone: phone(b.office_phone_no),
    email: "",
    website: str(b.website),
    lat: str(b.business_latitude),
    lng: str(b.business_longitude),
  };
}

/** Frappe's member record → the shape MemberProfileForm's initialValues wants. */
export function mapMemberToForm(m = {}) {
  const businesses = Array.isArray(m.businesses) ? m.businesses : [];
  const spouse = m.spouse && typeof m.spouse === "object" ? m.spouse : null;
  const spouseBusinesses = Array.isArray(spouse?.businesses) ? spouse.businesses : [];

  // The relatives array mixes spouse and children; only the children belong
  // in the form's repeater.
  const relatives = Array.isArray(m.relatives) ? m.relatives : [];
  const children = relatives.filter((r) =>
    /^(son|daughter|child)$/i.test(str(r.relation_type))
  );

  const isMarried = Boolean(spouse?.member_id);

  return {
    member: {
      name: str(m.full_name),
      husbandFatherName: str(m.fathers_full_name),
      surname: str(m.surname),
      dob: str(m.dob),
      education: str(m.education),
      mobile: phone(m.mobile_no),
      altMobile: phone(m.alternate_mobile_no || m.alternate_contact_no),
      // No board fields exist on this doctype yet.
      isInBoard: false,
      boardDesignation: "",
      isMarried,
      profession: professionFor(m),
    },

    // The backend has no company/sector/designation fields, so Service stays
    // empty until they are added. Left in place so the form still renders.
    service: { company: "", sector: "", designation: "" },

    business: mapBusiness(businesses[0]),

    ancestry: {
      place: str(m.ancestors_place),
      state: str(m.ancestors_state),
      gotra: str(m.gotra),
    },

    wife: isMarried
      ? {
          // Needed on save — the spouse is updated through their own record.
          memberId: str(spouse.member_id),
          name: str(spouse.full_name),
          fatherName: str(spouse.fathers_full_name),
          profession: spouseBusinesses.length ? "other" : "",
          mobile: phone(spouse.mobile_no),
          altContact: phone(spouse.alternate_mobile_no || spouse.alternate_contact_no),
          dob: str(spouse.dob),
          education: str(spouse.education),
          anniversary: str(m.anniversary || spouse.anniversary),
          residence: {
            // Never pre-ticked: the copy-from-husband checkbox would wipe a
            // saved spouse address the moment the form mounts.
            sameAsHusband: false,
            address: str(spouse.home_address),
            area: str(spouse.area_location),
            city: str(spouse.city),
            pinCode: str(spouse.pincode),
            lat: str(spouse.residence_latitude),
            lng: str(spouse.residence_longitude),
          },
          business: spouseBusinesses.length
            ? { ...mapBusiness(spouseBusinesses[0]), sameAsHusband: false }
            : undefined,
        }
      : undefined,

    children: children.length
      ? children.map((c) => ({
          memberId: str(c.member_id),
          name: str(c.full_name),
          dob: str(c.dob),
          education: str(c.education),
          mobile: phone(c.mobile_no),
          additionalInfo: str(c.additional_info),
        }))
      : undefined,

    // Home address and its pin live on the member record itself, separate
    // from any business address.
    residence: {
      address: str(m.home_address),
      area: str(m.area_location),
      city: str(m.city),
      pinCode: str(m.pincode),
      lat: str(m.residence_latitude),
      lng: str(m.residence_longitude),
    },

    photos: {
      member: str(m.photo_url),
      spouse: str(spouse?.photo_url),
      couple: "",
    },
  };
}

/** Drops keys Frappe would read as "clear this field". */
function prune(payload, memberId) {
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
      delete payload[key];
    }
  });
  payload.member_id = memberId;
  return payload;
}

/**
 * Business fields, or nothing at all.
 *
 * Frappe answers a half-filled business with "Value missing for Businesses:
 * Business Name" — including when only, say, a category or a phone number
 * reaches it, because that is enough for it to start building a business row
 * that has no name. So either the name goes with the rest, or none of it is
 * sent.
 */
function businessFields(business = {}) {
  const name = str(business.name).trim();
  if (!name) return null;

  return {
    business_id: business.businessId,
    business_name: name,
    description: business.description,
    category: business.natureOfBusiness,
    sub_category: business.subCategory,
    office_phone_no: withCountryCode(business.officePhone),
    website: business.website,
    office_address: business.address1,
    office_area: business.area,
    business_latitude: business.lat,
    business_longitude: business.lng,
  };
}

/** The form's JSON → the flat payload update_member expects. */
function mapFormToPayload(form = {}, memberId) {
  const member = form.member ?? {};
  const ancestry = form.ancestry ?? {};
  const residence = form.residence ?? {};

  const payload = {
    full_name: member.name,
    fathers_full_name: member.husbandFatherName,
    surname: member.surname,
    dob: member.dob,
    education: member.education,
    profession: member.profession,
    mobile_no: withCountryCode(member.mobile),
    alternate_mobile_no: withCountryCode(member.altMobile),
    anniversary: form.wife?.anniversary,

    gotra: ancestry.gotra,
    ancestors_place: ancestry.place,
    ancestors_state: ancestry.state,

    home_address: residence.address,
    area_location: residence.area,
    city: residence.city,
    pincode: residence.pinCode,
    residence_latitude: residence.lat,
    residence_longitude: residence.lng,
  };

  // Business — the same endpoint doubles as add/update business. Sending the
  // business_id is what makes it an update; without it a second save would
  // file a brand-new business every time.
  if (member.profession === "Business") {
    const biz = businessFields(form.business);
    if (biz) Object.assign(payload, biz);
  }

  return prune(payload, memberId);
}

/**
 * The wife or a child block → a payload for THAT person's own member record.
 * Both are relatives, both are edited the same way.
 */
function mapRelativeToPayload(person = {}, personId) {
  const residence = person.residence ?? {};

  const payload = {
    full_name: person.name,
    fathers_full_name: person.fatherName,
    dob: person.dob,
    education: person.education,
    anniversary: person.anniversary,
    additional_info: person.additionalInfo,
    mobile_no: withCountryCode(person.mobile),
    alternate_mobile_no: withCountryCode(person.altContact),

    home_address: residence.address,
    area_location: residence.area,
    city: residence.city,
    pincode: residence.pinCode,
    residence_latitude: residence.lat,
    residence_longitude: residence.lng,
  };

  // The spouse can carry a business of their own, on their own record.
  const biz = businessFields(person.business);
  if (biz) Object.assign(payload, biz);

  return prune(payload, personId);
}