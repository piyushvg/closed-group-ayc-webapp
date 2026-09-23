// lib/firebase.js
//
// Firebase phone auth, web side. The mobile app already authenticates this
// way (Firebase sends the OTP, the app swaps the resulting ID token for a
// member session via verify_firebase_otp), so the web uses the same Firebase
// project — one OTP flow, one member record, no second source of truth.
//
// ⚠️ SETUP REQUIRED — add these to .env.local from
// Firebase console → Project settings → General → Your apps → Web app.
// If there's no web app registered yet, add one (it's free, same project):
//
//   NEXT_PUBLIC_FIREBASE_API_KEY=...
//   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
//   NEXT_PUBLIC_FIREBASE_APP_ID=...
//
// Also: Firebase console → Authentication → Sign-in method → Phone must be
// enabled, and the domain the site runs on (localhost + the live domain)
// must be listed under Authentication → Settings → Authorized domains.
//
// Install: npm install firebase

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// getApps() guard keeps Next's fast refresh from initialising twice.
const app = getApps().length ? getApp() : initializeApp(config);

export const firebaseAuth = getAuth(app);

export function isFirebaseConfigured() {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}