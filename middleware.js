// middleware.js  (project root, next to package.json)
//
// Keeps /portal from flashing its shell to someone who isn't signed in.
// This is a cheap presence check only — middleware runs on the Edge runtime
// where Node's crypto isn't available, so the cookie's signature can't be
// verified here. Every API route still calls getSession(), which does verify
// it, so a forged cookie gets you an empty page and nothing else.

import { NextResponse } from "next/server";

const SESSION_COOKIE = "ayc_session";

export function middleware(request) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/portal") && !hasSession) {
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
  matcher: ["/portal/:path*", "/login"],
};