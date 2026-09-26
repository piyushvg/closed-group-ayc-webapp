"use client";

// components/AppHeader.jsx
//
// AYC logo sits on the left of every page. When a member is signed in it
// also carries their number, a sign-out button, and — for board members
// only — the link to create an event.
//
// The link is hidden from everyone else, but hiding is not the protection:
// app/api/event/route.js rejects non-board members regardless of what the
// UI shows.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AppHeader({ mobileNo = "" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isBoardMember, setIsBoardMember] = useState(false);

  // The session cookie is httpOnly, so the browser can't read it directly —
  // this asks the server who it is talking to.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setIsBoardMember(Boolean(d?.isBoardMember));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="ayc-header">
      <style>{css}</style>

      <div className="ayc-header-inner">
        <div className="ayc-brand">
          <Image src="/ayc-logo.png" alt="AYC" width={40} height={40} priority />
          <span className="ayc-brand-name">AYC</span>
        </div>

        {mobileNo ? (
          <div className="ayc-header-right">
            {isBoardMember && pathname !== "/create-event" && (
              <Link href="/create-event" className="ayc-action">
                Create event
              </Link>
            )}
            {pathname !== "/portal" && (
              <Link href="/portal" className="ayc-action">
                My profile
              </Link>
            )}
            <span className="ayc-header-user">+91 {mobileNo}</span>
            <button type="button" className="ayc-signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

const css = `
  .ayc-header {
    background: #FFFFFF;
    border-bottom: 1px solid #D8D5CB;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .ayc-header-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .ayc-brand { display: flex; align-items: center; gap: 10px; }
  .ayc-brand-name { font-size: 15px; font-weight: 700; color: #2B2A27; letter-spacing: 0.04em; }
  .ayc-header-right { display: flex; align-items: center; gap: 12px; }
  .ayc-header-user { font-size: 12.5px; color: #7A776E; }
  .ayc-action {
    font-size: 12.5px; font-weight: 600; color: #B3413A; text-decoration: none;
    white-space: nowrap;
  }
  .ayc-action:hover { text-decoration: underline; }
  .ayc-signout {
    height: 32px; padding: 0 12px; border-radius: 6px;
    border: 1px solid #B9B6AC; background: #FFFFFF;
    font-size: 12.5px; color: #2B2A27; cursor: pointer;
  }

  @media (max-width: 560px) {
    .ayc-header-user { display: none; }
    .ayc-header-right { gap: 10px; }
  }
`;