// lib/paths.js
//
// Prod serves the app under a sub-path (e.g. /aycapp) via next.config.mjs
// basePath. Next prefixes <Link>, router and redirects itself, but not raw
// fetch() URLs or plain asset src strings — wrap those with withBase().

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Prefixes app-relative URLs ("/api/...") with basePath; absolute URLs pass through. */
export function withBase(path) {
  return path.startsWith("/") ? `${BASE_PATH}${path}` : path;
}
