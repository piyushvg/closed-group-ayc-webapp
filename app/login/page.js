"use client";

// app/login/page.js
//
// Two steps, same as the mobile app: mobile number → OTP → portal.
//
// Firebase sends and checks the code; our backend then turns the resulting
// ID token into a member session. Firebase requires a reCAPTCHA verifier on
// the web (it doesn't on native) — it's rendered invisibly and solves itself
// unless Firebase decides the request looks suspicious.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState("mobile"); // "mobile" | "otp"
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const confirmationRef = useRef(null);
  const recaptchaRef = useRef(null);

  const configured = isFirebaseConfigured();

  // Resend countdown
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  function ensureRecaptcha() {
    if (recaptchaRef.current) return recaptchaRef.current;
    recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, "recaptcha-holder", {
      size: "invisible",
    });
    return recaptchaRef.current;
  }

  async function sendOtp(isResend = false) {
    setError("");

    if (!firebaseAuth) return;

    if (mobile.length !== 10) {
      setError("Please enter your 10-digit mobile number.");
      return;
    }

    setBusy(true);
    try {
      const verifier = ensureRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(
        firebaseAuth,
        `+91${mobile}`,
        verifier
      );
      setStep("otp");
      setSecondsLeft(RESEND_SECONDS);
      if (isResend) setOtp("");
    } catch (err) {
      // A failed attempt burns the verifier — throw it away so the next try
      // builds a fresh one instead of silently failing forever.
      try {
        recaptchaRef.current?.clear();
      } catch {}
      recaptchaRef.current = null;
      setError(friendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setError("");

    if (otp.length !== OTP_LENGTH) {
      setError(`Please enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    if (!confirmationRef.current) {
      setError("That code has expired. Please request a new one.");
      setStep("mobile");
      return;
    }

    setBusy(true);
    try {
      const credential = await confirmationRef.current.confirm(otp);
      const firebaseToken = await credential.user.getIdToken();

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firebaseToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not sign you in.");

      router.replace("/portal");
    } catch (err) {
      setError(friendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-outer">
      <style>{css}</style>

      <div className="login-card">
        <div className="login-brand">
          <Image src="/ayc-logo.png" alt="AYC" width={56} height={56} priority />
          <div>
            <h1>Member portal</h1>
            <p>Sign in with the mobile number registered with the club.</p>
          </div>
        </div>

        {!configured && (
          <div className="login-banner login-banner-error">
            Firebase isn&apos;t configured yet — add the NEXT_PUBLIC_FIREBASE_* values to
            .env.local (see lib/firebase.js).
          </div>
        )}

        {error && <div className="login-banner login-banner-error">{error}</div>}

        {step === "mobile" ? (
          <>
            <label className="login-label">Mobile number</label>
            <div className="login-mobile-row">
              <span className="login-prefix">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="10-digit number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                disabled={busy || !configured}
              />
            </div>

            <button
              type="button"
              className="login-primary"
              onClick={() => sendOtp()}
              disabled={busy || !configured}
            >
              {busy ? "Sending…" : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <label className="login-label">
              Enter the {OTP_LENGTH}-digit code sent to +91 {mobile}
            </label>
            <input
              className="login-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              placeholder="······"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
              onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
              disabled={busy}
            />

            <button type="button" className="login-primary" onClick={verifyOtp} disabled={busy}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>

            <div className="login-secondary-row">
              <button
                type="button"
                className="login-link"
                onClick={() => {
                  setStep("mobile");
                  setOtp("");
                  setError("");
                }}
                disabled={busy}
              >
                Change number
              </button>
              <button
                type="button"
                className="login-link"
                onClick={() => sendOtp(true)}
                disabled={busy || secondsLeft > 0}
              >
                {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
              </button>
            </div>
          </>
        )}

        {/* Firebase mounts its invisible reCAPTCHA here. */}
        <div id="recaptcha-holder" />
      </div>
    </div>
  );
}

function friendlyFirebaseError(err) {
  const code = err?.code || "";
  if (code === "auth/invalid-phone-number") return "That doesn't look like a valid mobile number.";
  if (code === "auth/invalid-verification-code") return "That code isn't right. Please check and try again.";
  if (code === "auth/code-expired") return "That code has expired. Please request a new one.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a few minutes and try again.";
  if (code === "auth/quota-exceeded") return "OTP limit reached for today. Please contact the club office.";
  return err?.message || "Something went wrong. Please try again.";
}

const css = `
  .login-outer {
    --border: #B9B6AC;
    --border-light: #D8D5CB;
    --surface: #FAF9F5;
    --card: #FFFFFF;
    --text: #2B2A27;
    --text-muted: #7A776E;
    --accent: #B3413A;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: var(--surface);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .login-card {
    width: 100%;
    max-width: 420px;
    background: var(--card);
    border: 1px solid var(--border-light);
    border-radius: 12px;
    padding: 28px 26px 24px;
  }
  .login-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
  .login-brand h1 { font-size: 19px; font-weight: 600; margin: 0 0 3px; }
  .login-brand p { font-size: 12.5px; color: var(--text-muted); margin: 0; }

  .login-banner { border-radius: 8px; padding: 10px 13px; font-size: 12.5px; margin-bottom: 16px; }
  .login-banner-error { background: #F7E3E1; color: #7A2E28; border: 1px solid #E3B3AE; }

  .login-label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }

  .login-mobile-row { display: flex; align-items: stretch; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .login-prefix {
    display: flex; align-items: center; padding: 0 11px;
    background: #F0EFEA; color: var(--text-muted); font-size: 13px;
    border-right: 1px solid var(--border);
  }
  .login-mobile-row input {
    flex: 1; height: 40px; border: none; padding: 0 11px;
    font-size: 14px; color: var(--text); background: var(--card); width: 100%;
  }
  .login-mobile-row input:focus { outline: none; }
  .login-mobile-row:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }

  .login-otp {
    width: 100%; height: 46px; border: 1px solid var(--border); border-radius: 6px;
    padding: 0 14px; font-size: 20px; letter-spacing: 0.35em; text-align: center;
    color: var(--text); background: var(--card);
  }
  .login-otp:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

  .login-primary {
    width: 100%; height: 42px; margin-top: 16px; border: none; border-radius: 6px;
    background: var(--text); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .login-primary:disabled { opacity: 0.55; cursor: not-allowed; }

  .login-secondary-row { display: flex; justify-content: space-between; margin-top: 14px; }
  .login-link {
    border: none; background: none; color: var(--accent);
    font-size: 12.5px; cursor: pointer; padding: 0;
  }
  .login-link:disabled { color: var(--text-muted); cursor: not-allowed; }
`;