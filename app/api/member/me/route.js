// app/api/member/me/route.js
//
// GET  → the logged-in member's saved details, shaped for MemberProfileForm.
// POST → saves whatever they changed.
//
// The member id comes from the signed session cookie, never from the
// request body — otherwise anyone could read or overwrite another member's
// profile just by changing an id in devtools.

import { frappePost, FRAPPE_METHODS } from "@/lib/frappe";
import { clearSessionCookie, getSession } from "@/lib/session";

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

  try {
    const body = await request.json();
    const payload = mapFormToPayload(body, session.memberId);
    const result = await frappePost(FRAPPE_METHODS.updateMember, payload);
    return Response.json(result ?? { ok: true });
  } catch (err) {
    return Response.json(
      { message: err.message || "Could not save your details." },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Field mapping
//
// ⚠️ These names follow the pattern the rest of this backend uses and the
// mobile app's src/api/members.ts. Log one real get_member_details response
// (it comes back in `raw` above) and correct anything that doesn't line up —
// a wrong key here shows up as an empty field, not an error, so it's easy to
// miss.
// ---------------------------------------------------------------------------

function str(value) {
  return value == null ? "" : String(value);
}

/** Frappe's member record → the shape MemberProfileForm's initialValues wants. */
export function mapMemberToForm(m = {}) {
  const [ancestorPlace = "", ancestorState = ""] = str(m.ancestors)
    .split(",")
    .map((part) => part.trim());

  const isMarried = Boolean(m.wife_member_id || m.spouse_name || m.is_married);

  return {
    member: {
      name: str(m.full_name || m.member_name),
      husbandFatherName: str(m.husband_father_name || m.father_name),
      surname: str(m.surname),
      dob: str(m.dob),
      education: str(m.education),
      mobile: str(m.mobile_no || m.mobile),
      altMobile: str(m.alternate_mobile_no),
      isInBoard: Boolean(m.is_board_member || m.is_in_board),
      boardDesignation: str(m.board_designation),
      isMarried,
      profession: str(m.profession),
    },
    service: {
      company: str(m.company),
      sector: str(m.sector),
      designation: str(m.designation),
    },
    business: {
      name: str(m.business_name),
      description: str(m.business_description),
      address1: str(m.office_address || m.home_address),
      address2: str(m.office_address_2),
      area: str(m.area_location),
      city: str(m.city),
      pinCode: str(m.pincode),
      natureOfBusiness: str(m.nature_of_business),
      officePhone: str(m.office_phone_no),
      email: str(m.email),
      website: str(m.website),
      lat: str(m.latitude),
      lng: str(m.longitude),
    },
    ancestry: {
      place: str(m.ancestors_place || ancestorPlace),
      state: str(m.ancestors_state || ancestorState),
      gotra: str(m.gotra),
    },
    wife: isMarried
      ? {
          name: str(m.spouse_name),
          fatherName: str(m.spouse_father_name),
          profession: str(m.spouse_profession),
          mobile: str(m.spouse_mobile_no),
          altContact: str(m.spouse_alt_contact),
          dob: str(m.spouse_dob),
          education: str(m.spouse_education),
          anniversary: str(m.anniversary),
          residence: {
            // Nothing is pre-ticked here: the copy-from-husband checkbox
            // would overwrite a saved spouse address the moment the form
            // mounts.
            sameAsHusband: false,
            address: str(m.spouse_home_address),
            area: str(m.spouse_area),
            city: str(m.spouse_city),
            pinCode: str(m.spouse_pincode),
            lat: str(m.spouse_latitude),
            lng: str(m.spouse_longitude),
          },
        }
      : undefined,
    children: Array.isArray(m.children) && m.children.length
      ? m.children.map((c) => ({
          name: str(c.name || c.child_name),
          dob: str(c.dob),
          education: str(c.education),
          mobile: str(c.mobile_no || c.mobile),
          additionalInfo: str(c.additional_info),
        }))
      : undefined,
    photos: {
      member: str(m.photo),
      spouse: str(m.spouse_photo),
      couple: str(m.couple_photo),
    },
  };
}

/** The form's JSON → the flat payload the update method expects. */
function mapFormToPayload(form = {}, memberId) {
  const member = form.member ?? {};
  const business = form.business ?? {};
  const service = form.service ?? {};
  const ancestry = form.ancestry ?? {};
  const wife = form.wife ?? null;
  const children = Array.isArray(form.children) ? form.children : [];

  const payload = {
    member_id: memberId,

    full_name: member.name,
    husband_father_name: member.husbandFatherName,
    surname: member.surname,
    dob: member.dob,
    education: member.education,
    mobile_no: member.mobile,
    alternate_mobile_no: member.altMobile,
    is_board_member: member.isInBoard ? 1 : 0,
    board_designation: member.isInBoard ? member.boardDesignation : "",
    is_married: member.isMarried ? 1 : 0,
    profession: member.profession,

    ancestors_place: ancestry.place,
    ancestors_state: ancestry.state,
    gotra: ancestry.gotra,
  };

  if (member.profession === "Business") {
    Object.assign(payload, {
      business_name: business.name,
      business_description: business.description,
      office_address: business.address1,
      office_address_2: business.address2,
      area_location: business.area,
      city: business.city,
      pincode: business.pinCode,
      nature_of_business: business.natureOfBusiness,
      office_phone_no: business.officePhone,
      email: business.email,
      website: business.website,
      latitude: business.lat,
      longitude: business.lng,
    });
  }

  if (member.profession === "Service") {
    Object.assign(payload, {
      company: service.company,
      sector: service.sector,
      designation: service.designation,
    });
  }

  if (member.isMarried && wife) {
    Object.assign(payload, {
      spouse_name: wife.name,
      spouse_father_name: wife.fatherName,
      spouse_profession: wife.profession,
      spouse_mobile_no: wife.mobile,
      spouse_alt_contact: wife.altContact,
      spouse_dob: wife.dob,
      spouse_education: wife.education,
      anniversary: wife.anniversary,
      spouse_home_address: wife.residence?.address,
      spouse_area: wife.residence?.area,
      spouse_city: wife.residence?.city,
      spouse_pincode: wife.residence?.pinCode,
      spouse_latitude: wife.residence?.lat,
      spouse_longitude: wife.residence?.lng,
    });

    const realChildren = children.filter((c) => c?.name?.trim());
    if (realChildren.length) payload.children = JSON.stringify(realChildren);
  }

  // Frappe treats an explicit null as "clear this field", so undefined keys
  // are dropped rather than sent — a field the form didn't touch keeps
  // whatever is already saved.
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
}