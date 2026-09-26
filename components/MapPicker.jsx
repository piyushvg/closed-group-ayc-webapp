"use client";

import { useEffect, useId, useRef, useState } from "react";

// This is the static Mappls "Key" from the dashboard (NOT an OAuth
// access_token — despite the env var's name, carried over as-is so the
// .env doesn't need renaming). It works directly with the
// apis.mappls.com/advancedmaps/api/{KEY}/map_sdk endpoint below, no token
// exchange needed. The Client ID/Secret pair from the same dashboard is
// NOT used here — those are only for server-side OAuth REST calls
// (geocoding/routing), and must never be shipped to the browser.
const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_ACCESS_TOKEN;

// Default centre: Nagpur.
const DEFAULT_LAT = 21.1458;
const DEFAULT_LNG = 79.0882;

// Waits until a DOM element with this id actually exists (and is
// connected to the document) before resolving — Mappls' Map() constructor
// looks the container up by id internally, and if the script's onload
// fires a beat before React has committed/painted the div (common with
// Next.js dev's Strict Mode double-effect), it fails with
// "Map Container div not found". Polling via requestAnimationFrame is
// cheap and self-corrects regardless of the exact cause.
function waitForContainer(id, attemptsLeft = 30) {
  return new Promise((resolve, reject) => {
    function check(remaining) {
      const el = document.getElementById(id);
      if (el && el.isConnected) {
        resolve(el);
        return;
      }
      if (remaining <= 0) {
        reject(new Error(`Map container #${id} never appeared in the DOM`));
        return;
      }
      requestAnimationFrame(() => check(remaining - 1));
    }
    check(attemptsLeft);
  });
}

/**
 * Renders an interactive Mappls map. Click anywhere (or drag the marker)
 * to set a location — calls onLocationSelect(lat, lng) every time it changes.
 *
 * The coordinates are never displayed by this component; whoever uses it
 * decides what to show. Both the member profile and the event form show a
 * status line rather than the numbers.
 */
export default function MapPicker({ initialLat, initialLng, onLocationSelect }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  // Mappls' Map() constructor wants the container's id *string*, not a DOM
  // element reference — passing the element itself silently fails with
  // "Map container not defined!!" and leaves `map` unusable. useId() gives
  // a stable, unique id per instance (so multiple MapPickers on one page
  // never clash); colons in React's id format aren't valid in every
  // context, so they're swapped for dashes.
  const containerId = `mappls-map-${useId().replace(/:/g, "-")}`;

  const lat = Number(initialLat) || DEFAULT_LAT;
  const lng = Number(initialLng) || DEFAULT_LNG;

  useEffect(() => {
    let cancelled = false;

    if (!MAPPLS_KEY) {
      setError("NEXT_PUBLIC_MAPPLS_ACCESS_TOKEN is not set in .env.local");
      return;
    }

    async function initMap() {
      if (cancelled || !window.mappls) return;

      try {
        await waitForContainer(containerId);
      } catch (e) {
        if (!cancelled) setError(e.message);
        return;
      }
      if (cancelled) return;

      try {
        const map = new window.mappls.Map(containerId, {
          center: [lat, lng],
          zoom: 15,
        });
        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;

          const marker = new window.mappls.Marker({
            map,
            position: { lat, lng },
            draggable: true,
          });
          markerRef.current = marker;
          setLoaded(true);

          map.on("click", (e) => {
            // Different SDK builds spell this differently; a wrong guess
            // here throws inside the handler and the pin simply never moves.
            const ll = e.lngLat || e.lnglat || e.latlng;
            if (!ll) return;
            const pos = { lat: ll.lat, lng: ll.lng };
            marker.setPosition(pos);
            onLocationSelect?.(pos.lat, pos.lng);
          });

          marker.addListener("dragend", () => {
            const pos = marker.getPosition();
            onLocationSelect?.(pos.lat, pos.lng);
          });
        });
      } catch (e) {
        if (!cancelled) setError(e?.message || "Mappls failed to initialise");
      }
    }

    if (window.mappls) {
      initMap();
    } else {
      const existing = document.getElementById("mappls-sdk-script");
      if (existing) {
        existing.addEventListener("load", initMap);
      } else {
        const script = document.createElement("script");
        script.id = "mappls-sdk-script";
        script.src = `https://apis.mappls.com/advancedmaps/api/${MAPPLS_KEY}/map_sdk?layer=vector&v=3.0`;
        script.async = true;
        script.onload = initMap;
        script.onerror = () =>
          setError("Mappls SDK script failed to load — check the key and its domain restrictions.");
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: 360, borderRadius: 12, overflow: "hidden", border: "1px solid #ede9e3" }}>
      {!loaded && !error && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "#f5f3ef", color: "#8a8078", fontSize: 14,
        }}>
          Loading map…
        </div>
      )}
      {error && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 6,
          alignItems: "center", justifyContent: "center",
          background: "#f5f3ef", color: "#d9534f", fontSize: 13, textAlign: "center", padding: 16,
        }}>
          <strong>Could not load the map.</strong>
          <span style={{ fontSize: 11.5, color: "#8a8078" }}>{error}</span>
        </div>
      )}
      <div ref={mapDivRef} id={containerId} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}