// app/api/auth/session/route.js
//
// Lets a client component ask who it is talking to. The cookie itself is
// httpOnly and signed, so the browser cannot read it — this route reads it
// server-side and returns only the harmless parts.

import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return Response.json({ signedIn: false }, { status: 200 });
  }

  return Response.json({
    signedIn: true,
    memberId: session.memberId,
    mobileNo: session.mobileNo ?? "",
    isBoardMember: Boolean(session.isBoardMember),
  });
}