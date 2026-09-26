"use client";
// ^ Required in Next.js App Router — uses useState and browser-only APIs
// (navigator.geolocation).

import React, { useState } from "react";
<<<<<<< HEAD
import MapPicker from './MapPicker';
import { withBase } from "@/lib/paths";
=======
import MapPicker from "./MapPicker";
>>>>>>> fonts_bugs_clear

/**
 * CreateEventForm
 * ----------------
 * Styled to match MemberProfileForm.jsx (same card look, same
 * required-field red-highlight behaviour).
 *
 * Location works the same way as it does on a member's profile: the pin is
 * the interface, and the coordinates are never shown. Organizers see
 * "Location set" or "No location set yet"; the numbers travel to the backend
 * with the rest of the payload.
 *
 * Posts to /api/event, which verifies board membership server-side before
 * forwarding to Frappe's event_api.create_event.
 */

const emptyForm = () => ({
  event_name: "",
  description: "",
  event_datetime: "", // datetime-local value, e.g. "2026-12-15T18:00"
  venue: "",
  google_map_location: "",
  organizers: "",
  latitude: "",
  longitude: "",
});

export default function CreateEventForm({ apiEndpoint = "/api/event", onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null); // { type: "error"|"success", text }

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const errFor = (key) => errors[key] || "";

  const hasLocation = Boolean(form.latitude && form.longitude);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setBanner({ type: "error", text: "Geolocation is not supported in this browser." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        });
      },
      () => {
        setBanner({ type: "error", text: "Couldn't read your location — check browser permission." });
      },
      {
        // Without this the browser takes the fast path and resolves location
        // from Wi-Fi or IP data, which on a laptop can be kilometres out.
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const validate = () => {
    const e = {};
    const req = (val, key) => {
      if (!val || String(val).trim() === "") e[key] = "Required";
    };
    req(form.event_name, "event_name");
    req(form.event_datetime, "event_datetime");
    req(form.venue, "venue");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setBanner(null);

    if (!validate()) {
      setBanner({ type: "error", text: "Please fill in the required fields highlighted below." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(withBase(apiEndpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: form.event_name,
          description: form.description,
          event_datetime: form.event_datetime,
          venue: form.venue,
          google_map_location: form.google_map_location,
          organizers: form.organizers,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
        }),
      });

      if (!res.ok) {
        let message = `Save failed (HTTP ${res.status})`;
        const raw = await res.text();
        try {
          const data = JSON.parse(raw);
          if (data?.message) message = data.message;
        } catch (_) {
          if (raw) message = `Save failed (HTTP ${res.status}): ${raw.slice(0, 200)}`;
        }
        throw new Error(message);
      }

      const data = await res.json();
      setBanner({ type: "success", text: "Event created successfully." });
      setForm(emptyForm());
      onSaved?.(data.message ?? data);
    } catch (err) {
      setBanner({ type: "error", text: err.message || "Something went wrong while saving." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cef-outer">
      <div className="cef-page">
        <style>{CSS}</style>

        <header className="cef-head">
          <h1>Create event</h1>
          <p>Add a new community event with date, venue and location.</p>
          <div className="cef-legend"><span className="cef-req">*</span> indicates a mandatory field</div>
        </header>

        {banner && <div className={`cef-banner cef-banner-${banner.type}`}>{banner.text}</div>}

        <form onSubmit={handleSubmit}>
          <section className="cef-card">
            <div className="cef-grid">
              <Field label="Event name" required full error={errFor("event_name")}>
                <input
                  type="text"
                  value={form.event_name}
                  onChange={(e) => set({ event_name: e.target.value })}
                />
              </Field>

              <Field label="Description" full>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </Field>

              <Field label="Date & time" required error={errFor("event_datetime")}>
                <input
                  type="datetime-local"
                  value={form.event_datetime}
                  onChange={(e) => set({ event_datetime: e.target.value })}
                />
              </Field>

              <Field label="Venue" required error={errFor("venue")}>
                <input
                  type="text"
                  value={form.venue}
                  onChange={(e) => set({ venue: e.target.value })}
                />
              </Field>

              <Field label="Organizers" full>
                <input
                  type="text"
                  value={form.organizers}
                  onChange={(e) => set({ organizers: e.target.value })}
                />
              </Field>

              <Field label="Google Maps link" full>
                <input
                  type="url"
                  placeholder="https://maps.google.com/?q=..."
                  value={form.google_map_location}
                  onChange={(e) => set({ google_map_location: e.target.value })}
                />
              </Field>

              <div className="cef-field-full">
                <label className="cef-map-label">Event location</label>
                <MapPicker
                  initialLat={form.latitude}
                  initialLng={form.longitude}
                  onLocationSelect={(lat, lng) =>
                    set({ latitude: String(lat), longitude: String(lng) })
                  }
                />
              </div>

              {/* Deliberately no latitude/longitude boxes. Organizers pick the
                  spot visually; the numbers live in state and travel with the
                  save, exactly as they do on a member's profile. */}
              <div className="cef-geo-row">
                <div className="cef-geo-status">
                  <span className={"cef-geo-dot" + (hasLocation ? " cef-geo-dot-set" : "")} aria-hidden="true" />
                  <span className="cef-geo-status-text">
                    {hasLocation ? "📍 Location set" : "No location set yet"}
                  </span>
                </div>
                <button type="button" className="cef-geo-btn" onClick={captureLocation}>
                  Use current location
                </button>
              </div>

              <p className="cef-location-hint">
                &quot;Use current location&quot; is approximate on laptops (no GPS chip) —
                for an exact spot, click or drag the pin on the map above.
              </p>
            </div>
          </section>

          <div className="cef-actions">
            <button type="button" className="cef-cancel" onClick={() => setForm(emptyForm())}>
              Reset
            </button>
            <button type="submit" className="cef-save" disabled={saving}>
              {saving ? "Saving…" : "Create event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, full, error, children }) {
  return (
    <div
      className={
        "cef-field" +
        (full ? " cef-field-full" : "") +
        (error ? " cef-field-error" : "")
      }
    >
      <label>
        {label}
        {required && <span className="cef-req"> *</span>}
      </label>
      {children}
      {error && <span className="cef-field-error-text">{error}</span>}
    </div>
  );
}

const CSS = `
  .cef-outer {
    --border: #B9B6AC; --border-light: #D8D5CB; --surface: #FAF9F5;
    --card: #FFFFFF; --text: #2B2A27; --text-muted: #7A776E; --accent: #B3413A;
    width: 100%;
    background: var(--surface);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .cef-page { max-width: 1100px; margin: 0 auto; padding: 32px 16px 80px; }
  .cef-head { margin-bottom: 20px; }
  .cef-head h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
  .cef-head p { margin: 0; color: var(--text-muted); font-size: 13px; }
  .cef-legend { font-size: 12px; color: var(--text-muted); margin-top: 10px; }
  .cef-req { color: var(--accent); font-weight: 600; }

  .cef-banner { border-radius: 8px; padding: 12px 16px; font-size: 13px; margin-bottom: 16px; }
  .cef-banner-error { background: #FBEAE8; color: var(--accent); border: 1px solid #EBC7C2; }
  .cef-banner-success { background: #EAF3EA; color: #2E6B3E; border: 1px solid #C9E0C9; }

  .cef-card { background: var(--card); border: 1px solid var(--border-light); border-radius: 10px; padding: 20px 22px; margin-bottom: 16px; }
  .cef-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px 16px; }
  .cef-field { display: flex; flex-direction: column; gap: 4px; }
  .cef-field-full { grid-column: 1 / -1; }
  .cef-field label, .cef-map-label { font-size: 12px; color: var(--text-muted); }
  .cef-map-label { display: block; margin-bottom: 6px; }
  .cef-field input, .cef-field textarea {
    border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px;
    font-size: 13px; background: var(--card); color: var(--text); width: 100%;
    font-family: inherit;
  }
  .cef-field input { height: 34px; }
  .cef-field input:focus, .cef-field textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .cef-field-error-text { font-size: 11px; color: var(--accent); font-weight: 600; }
  .cef-field-error input, .cef-field-error textarea {
    border-color: var(--accent) !important; border-width: 1.5px !important; background: #FDF3F2;
  }

  .cef-geo-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; grid-column: 1 / -1; margin-top: 10px;
  }
  .cef-geo-status { display: flex; align-items: center; gap: 8px; }
  .cef-geo-dot { width: 8px; height: 8px; border-radius: 4px; background: var(--border); flex-shrink: 0; }
  .cef-geo-dot-set { background: #2E6B3E; }
  .cef-geo-status-text { font-size: 12.5px; color: var(--text-muted); }
  .cef-geo-btn {
    height: 34px; padding: 0 12px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--card); font-size: 12px; color: var(--text); cursor: pointer; white-space: nowrap;
  }
  .cef-location-hint {
    grid-column: 1 / -1; font-size: 11.5px; color: var(--text-muted);
    margin: 6px 0 0; font-style: italic;
  }

  .cef-actions { display: flex; justify-content: flex-end; gap: 10px; }
  .cef-actions button { height: 38px; padding: 0 18px; border-radius: 6px; font-size: 13.5px; cursor: pointer; }
  .cef-cancel { background: var(--card); border: 1px solid var(--border); color: var(--text); }
  .cef-save { background: var(--text); border: none; color: #fff; font-weight: 600; }
  .cef-save:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 900px) {
    .cef-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 560px) {
    .cef-grid { grid-template-columns: 1fr; }
    .cef-page { padding: 20px 12px 60px; }
    .cef-card { padding: 16px; }
    .cef-geo-row { flex-direction: column; align-items: stretch; }
    .cef-geo-btn { width: 100%; }
    .cef-actions { flex-direction: column-reverse; }
    .cef-actions button { width: 100%; }
  }
`;