// middleware.js  (project root, next to package.json)
//
// Keeps signed-out visitors off the member pages. This is a cheap presence
// check only — middleware runs on the Edge runtime where Node's crypto isn't
// available, so the cookie's signature can't be verified here. Every page and
// API route behind it calls getSession(), which does verify it, so a forged
// cookie gets you an empty page and nothing else.
//
// Board membership is NOT checked here — it lives inside the signed cookie
// and is enforced in app/create-event/page.js and app/api/event/route.js.

import { NextResponse } from "next/server";

const SESSION_COOKIE = "ayc_session";

export function middleware(request) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  const isProtected = pathname.startsWith("/portal") || pathname.startsWith("/create-event");

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Already signed in? No reason to show the login form again.
  if (pathname === "/login" && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/portal";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/create-event/:path*", "/login"],
};