// lib/frappe.js
//
// One place that knows how to talk to Frappe. Every call attaches the
// Authorization header server-side, so the API key/secret never reaches the
// browser — the same reason app/api/members/route.js proxies instead of
// letting the form call Frappe directly.

const BASE_URL = process.env.FRAPPE_BASE_URL;
const API_KEY = process.env.FRAPPE_API_KEY;
const API_SECRET = process.env.FRAPPE_API_SECRET;

const PREFIX = "/api/method/community_circle_app.community_circle.api";

export const FRAPPE_METHODS = {
  verifyOtp: `${PREFIX}.auth.verify_firebase_otp`,
  getMemberDetails: `${PREFIX}.members_api.get_member_details`,

  // Confirmed against the mobile app's src/api/members.ts. This lives under
  // update_member, NOT members_api — an earlier guess pointed at
  // members_api.update_member_profile, which does not exist. It also doubles
  // as the create/update business endpoint; there is no separate one.
  updateMember: `${PREFIX}.update_member.update_member`,

  // Who is allowed to create events. Same method the mobile app's
  // Board Members screen uses.
  getBoardMembers: `${PREFIX}.board_member_api.get_board_members`,

  createEvent: `${PREFIX}.event_api.create_event`,

  // Two-step photo flow, same as the mobile app's src/api/photo.ts.
  uploadFile: "/api/method/upload_file",
  linkPhoto: `${PREFIX}.upload_photo.upload_member_photo`,
};

export function assertFrappeEnv() {
  if (!BASE_URL || !API_KEY || !API_SECRET) {
    throw new Error(
      "Server is missing FRAPPE_BASE_URL / FRAPPE_API_KEY / FRAPPE_API_SECRET env vars."
    );
  }
}

function authHeader() {
  return `token ${API_KEY}:${API_SECRET}`;
}

function unwrap(text, status, path) {
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    // Non-JSON almost always means the method path is wrong and Frappe's
    // HTML error page came back.
    throw new Error(`Backend returned non-JSON (HTTP ${status}) for ${path}`);
  }
  return data;
}

/**
 * POSTs JSON to a whitelisted Frappe method and unwraps `message`.
 * Frappe puts real errors in the body, not the status text, so those are
 * dug out here rather than leaving callers with "HTTP 417".
 */
export async function frappePost(path, body) {
  assertFrappeEnv();

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });

  const data = unwrap(await res.text(), res.status, path);

  if (!res.ok) {
    throw new Error(extractFrappeError(data) || `Backend returned HTTP ${res.status}`);
  }
  return data.message ?? data;
}

/** GET variant — some whitelisted methods only accept GET. */
export async function frappeGet(path, params) {
  assertFrappeEnv();

  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });

  const data = unwrap(await res.text(), res.status, path);

  if (!res.ok) {
    throw new Error(extractFrappeError(data) || `Backend returned HTTP ${res.status}`);
  }
  return data.message ?? data;
}

/** Same as frappePost but sends multipart — used for the raw file upload. */
export async function frappeUpload(path, formData) {
  assertFrappeEnv();

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader() },
    body: formData,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractFrappeError(data) || `Upload failed (HTTP ${res.status})`);
  }
  return data.message ?? data;
}

/**
 * True if this member sits on the board. Used to decide who may create
 * events. Failures deliberately return false rather than throwing — if the
 * board list cannot be read, nobody gets event-creation rights, which is the
 * safe direction to fail in.
 */
export async function isBoardMember(memberId) {
  if (!memberId) return false;
  try {
    const result = await frappeGet(FRAPPE_METHODS.getBoardMembers);
    const list = result?.board_members ?? [];
    return list.some((b) => b?.member_id === memberId);
  } catch (err) {
    console.error("[frappe] board member lookup failed:", err.message);
    return false;
  }
}

export function extractFrappeError(data) {
  if (!data) return "";
  if (typeof data.message === "string" && data.message.trim()) return data.message;

  if (data._server_messages) {
    try {
      const parsed = JSON.parse(data._server_messages);
      const first = Array.isArray(parsed) ? parsed[0] : null;
      const inner = typeof first === "string" ? JSON.parse(first) : first;
      if (inner?.message) return inner.message;
    } catch {
      // fall through
    }
  }

  if (typeof data.exception === "string" && data.exception.trim()) return data.exception;
  if (typeof data.exc === "string" && data.exc.trim()) {
    const lines = data.exc.trim().split("\n");
    return lines[lines.length - 1];
  }
  return "";
}