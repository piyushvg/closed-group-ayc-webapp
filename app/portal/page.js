"use client";

// app/portal/page.js
//
// The signed-in member's page. It loads whatever the club already has on
// record, hands it to the existing MemberProfileForm as initialValues, and
// lets them fill in the blanks and save. Photos upload on their own as soon
// as they're picked (see PhotoField).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import PhotoField from "@/components/PhotoField";
import MemberProfileForm from "@/components/MemberProfileForm";

export default function PortalPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/member/me", { cache: "no-store" });

      if (res.status === 401) {
        router.replace("/login");
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not load your details.");

      // Handy while the field mapping is still being confirmed — compare
      // this against mapMemberToForm() in app/api/member/me/route.js.
      if (process.env.NODE_ENV !== "production") {
        console.log("[portal] raw member record:", body.raw);
      }

      setData(body);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const photos = data?.form?.photos ?? {};
  const isMarried = Boolean(data?.form?.member?.isMarried);

  return (
    <div className="portal-outer">
      <style>{css}</style>

      <AppHeader mobileNo={data?.form?.member?.mobile} />

      {loading ? (
        <div className="portal-state">Loading your details…</div>
      ) : error ? (
        <div className="portal-state portal-state-error">
          {error}
          <button type="button" className="portal-retry" onClick={load}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <section className="portal-photos">
            <h2>Photos</h2>
            <p className="portal-photos-hint">
              Take a new photo or pick one from your gallery. Each uploads as soon as
              you choose it.
            </p>

            <div className="portal-photo-row">
              <PhotoField label="Your photo" kind="member" existingUrl={photos.member} />
              {isMarried && (
                <>
                  <PhotoField label="Spouse photo" kind="spouse" existingUrl={photos.spouse} />
                  <PhotoField label="Couple photo" kind="couple" existingUrl={photos.couple} />
                </>
              )}
            </div>
          </section>

          {/* The form is unchanged — it just starts from what's already saved
              and posts back to the member-scoped endpoint instead of the
              create-a-new-member one. */}
          <MemberProfileForm
            apiEndpoint="/api/member/me"
            initialValues={data.form}
            onSaved={load}
          />
        </>
      )}
    </div>
  );
}

const css = `
  .portal-outer {
    min-height: 100vh;
    background: #FAF9F5;
    color: #2B2A27;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .portal-state {
    max-width: 1100px; margin: 0 auto; padding: 48px 16px;
    font-size: 14px; color: #7A776E; text-align: center;
  }
  .portal-state-error { color: #7A2E28; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .portal-retry {
    height: 34px; padding: 0 16px; border-radius: 6px;
    border: 1px solid #B9B6AC; background: #FFFFFF; font-size: 13px; cursor: pointer;
  }

  .portal-photos {
    max-width: 1100px; margin: 0 auto; padding: 28px 16px 0;
  }
  .portal-photos h2 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
  .portal-photos-hint { font-size: 12.5px; color: #7A776E; margin: 0 0 14px; }
  .portal-photo-row {
    display: flex; flex-wrap: wrap; gap: 24px;
    background: #FFFFFF; border: 1px solid #D8D5CB; border-radius: 10px;
    padding: 18px 20px;
  }
`;