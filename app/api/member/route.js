// app/api/members/route.js
//
// This route receives the FormData that MemberProfileForm.jsx builds
// (member/business/ancestry/wife/children as JSON strings, plus photo
// files) and forwards it to the real Frappe backend, attaching the
// Authorization header server-side so the API secret never reaches the
// browser.
//
// ⚠️ TODO — CONFIRM WITH BACKEND BEFORE THIS WORKS:
// We do not yet know the exact whitelisted method for creating a brand-new
// member (with business + wife + children in one call). The Postman
// collection we've seen so far only has "Update Member API" and
// "import members" (bulk .xlsx import) — no obvious single-member "create"
// endpoint. Test in Postman first:
//   1. Try POST to .../members_api.create_member (guess) with a small
//      sample payload — see if it 404s ("no attribute") like our other
//      guesses did, or actually works.
//   2. If it 404s, ask backend: "we need a whitelisted method to register
//      one new member (personal + business + wife + children in one call,
//      multipart so photos travel too) — what's it called, and what field
//      names does it expect?"
// Once confirmed, update FRAPPE_CREATE_MEMBER_PATH below and adjust the
// field mapping in mapToFrappePayload() to match the real field names.

const FRAPPE_BASE_URL = process.env.FRAPPE_BASE_URL;
const FRAPPE_API_KEY = process.env.FRAPPE_API_KEY;
const FRAPPE_API_SECRET = process.env.FRAPPE_API_SECRET;

// 🔴 PLACEHOLDER — replace once backend confirms the real method name.
const FRAPPE_CREATE_MEMBER_PATH =
  "/api/method/community_circle_app.community_circle.api.members_api.create_member";

export async function POST(request) {
  if (!FRAPPE_BASE_URL || !FRAPPE_API_KEY || !FRAPPE_API_SECRET) {
    return Response.json(
      { message: "Server is missing FRAPPE_BASE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET env vars." },
      { status: 500 }
    );
  }

  try {
    const incomingFormData = await request.formData();

    // The browser form sends these as JSON strings inside a multipart body.
    const member = JSON.parse(incomingFormData.get("member") || "{}");
    const business = JSON.parse(incomingFormData.get("business") || "{}");
    const ancestry = JSON.parse(incomingFormData.get("ancestry") || "{}");
    const wife = incomingFormData.has("wife")
      ? JSON.parse(incomingFormData.get("wife"))
      : null;
    const children = incomingFormData.has("children")
      ? JSON.parse(incomingFormData.get("children"))
      : [];

    // Forward as multipart/form-data so photo files travel through too.
    const outgoingFormData = new FormData();

    // NOTE: field names below (full_name, mobile_no, etc.) are GUESSES based
    // on the naming pattern the rest of this backend uses — verify against
    // whatever the real create_member method actually expects.
    outgoingFormData.append("full_name", member.name || "");
    outgoingFormData.append("husband_father_name", member.husbandFatherName || "");
    outgoingFormData.append("surname", member.surname || "");
    outgoingFormData.append("dob", member.dob || "");
    outgoingFormData.append("education", member.education || "");
    outgoingFormData.append("mobile_no", member.mobile || "");
    outgoingFormData.append("alternate_mobile_no", member.altMobile || "");
    outgoingFormData.append("is_board_member", member.isInBoard ? "1" : "0");
    if (member.isInBoard) {
      outgoingFormData.append("board_designation", member.boardDesignation || "");
    }
    outgoingFormData.append("is_married", member.isMarried ? "1" : "0");

    outgoingFormData.append("business_name", business.name || "");
    outgoingFormData.append("business_description", business.description || "");
    outgoingFormData.append("home_address", business.address1 || "");
    outgoingFormData.append("office_address", business.address2 || "");
    outgoingFormData.append("area_location", business.area || "");
    outgoingFormData.append("city", business.city || "");
    outgoingFormData.append("pincode", business.pinCode || "");
    outgoingFormData.append("nature_of_business", business.natureOfBusiness || "");
    outgoingFormData.append("office_phone_no", business.officePhone || "");
    outgoingFormData.append("email", business.email || "");
    outgoingFormData.append("website", business.website || "");
    outgoingFormData.append("latitude", business.lat || "");
    outgoingFormData.append("longitude", business.lng || "");

    outgoingFormData.append("ancestors_place", ancestry.place || "");
    outgoingFormData.append("ancestors_state", ancestry.state || "");
    outgoingFormData.append("gotra", ancestry.gotra || "");

    if (wife) {
      outgoingFormData.append("spouse_name", wife.name || "");
      outgoingFormData.append("spouse_father_name", wife.fatherName || "");
      outgoingFormData.append("spouse_profession", wife.profession || "");
      outgoingFormData.append("spouse_mobile_no", wife.mobile || "");
      outgoingFormData.append("spouse_alt_contact", wife.altContact || "");
      outgoingFormData.append("spouse_dob", wife.dob || "");
      outgoingFormData.append("spouse_education", wife.education || "");
      outgoingFormData.append("anniversary", wife.anniversary || "");
      outgoingFormData.append("spouse_home_address", wife.residence?.address || "");
      outgoingFormData.append("spouse_area", wife.residence?.area || "");
      outgoingFormData.append("spouse_city", wife.residence?.city || "");
      outgoingFormData.append("spouse_pincode", wife.residence?.pinCode || "");
    }

    if (children?.length) {
      outgoingFormData.append("children", JSON.stringify(children));
    }

    // Photo files, if attached
    const memberPhoto = incomingFormData.get("memberPhoto");
    if (memberPhoto) outgoingFormData.append("member_photo", memberPhoto);
    const wifePhoto = incomingFormData.get("wifePhoto");
    if (wifePhoto) outgoingFormData.append("spouse_photo", wifePhoto);
    const couplePhoto = incomingFormData.get("couplePhoto");
    if (couplePhoto) outgoingFormData.append("couple_photo", couplePhoto);

    const frappeResponse = await fetch(`${FRAPPE_BASE_URL}${FRAPPE_CREATE_MEMBER_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `token ${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}`,
      },
      body: outgoingFormData,
    });

    const data = await frappeResponse.json().catch(() => ({}));

    if (!frappeResponse.ok) {
      return Response.json(
        { message: data?.exception || data?.message || `Backend returned HTTP ${frappeResponse.status}` },
        { status: frappeResponse.status }
      );
    }

    return Response.json(data.message ?? data);
  } catch (err) {
    return Response.json({ message: err.message || "Unexpected server error" }, { status: 500 });
  }
}