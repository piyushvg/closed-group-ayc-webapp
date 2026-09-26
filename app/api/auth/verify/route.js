// app/api/auth/verify/route.js
//
// The browser gets a Firebase ID token by completing the phone/OTP flow,
// then posts it here. This route hands it to the same backend method the
// mobile app uses, and on success drops a signed httpOnly session cookie.
//
// The Firebase token is never stored — only the member identity Frappe
// hands back, plus whether that member sits on the board, which is what
// decides who may create events.

import { frappePost, isBoardMember, FRAPPE_METHODS } from "@/lib/frappe";
import { setSessionCookie } from "@/lib/session";

export async function POST(request) {
  try {
    const { firebaseToken } = await request.json();

    if (!firebaseToken) {
      return Response.json({ message: "Missing firebaseToken." }, { status: 400 });
    }

    const result = await frappePost(FRAPPE_METHODS.verifyOtp, {
      firebase_token: firebaseToken,
    });

    const member = result?.member;
    if (!member?.id) {
      // Frappe answered, but this number isn't a registered member.
      return Response.json(
        {
          message:
            result?.message ||
            "This mobile number isn't registered as a member. Please contact the club office.",
        },
        { status: 403 }
      );
    }

    // Looked up once, here, and carried in the signed cookie afterwards.
    const boardMember = await isBoardMember(member.id);

    await setSessionCookie({
      memberId: member.id,
      mobileNo: member.mobile_no,
      memberRole: member.member_role,
      isBoardMember: boardMember,
    });

    return Response.json({
      memberId: member.id,
      mobileNo: member.mobile_no,
      memberRole: member.member_role,
      isBoardMember: boardMember,
    });
  } catch (err) {
    return Response.json(
      { message: err.message || "Could not verify the code. Please try again." },
      { status: 500 }
    );
  }
}