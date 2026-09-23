// lib/session.js
//
// The member session lives in a signed, httpOnly cookie. Nothing about the
// member — not even the member id — is readable or forgeable from browser
// JavaScript, and the Frappe API key/secret never leaves the server.
//
// Requires SESSION_SECRET in .env.local (any long random string).

import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "ayc_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set in .env.local");
  return value;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Serialises the session and appends an HMAC so it can't be edited client-side. */
export function encodeSession(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the session object, or null if missing / tampered with / expired. */
export function decodeSession(token) {
  if (!token || typeof token !== "string") return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  // Constant-time compare — a plain === leaks timing information.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!session?.memberId) return null;
    if (session.expiresAt && Date.now() > session.expiresAt) return null;
    return session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(session) {
  const withExpiry = { ...session, expiresAt: Date.now() + MAX_AGE_SECONDS * 1000 };
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(withExpiry), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Reads and verifies the session in a route handler or server component. */
export async function getSession() {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}