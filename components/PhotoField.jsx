"use client";

// components/PhotoField.jsx
//
// One photo slot with two ways in: the phone camera, or the gallery /
// file browser. On a phone, `capture="environment"` makes the camera open
// straight away instead of the file chooser; on a laptop that attribute is
// ignored and it behaves like a normal file input, so one component covers
// both without sniffing the user agent.
//
// The file is uploaded immediately (not held until Save) so a member who
// fills the form over two sittings doesn't lose the photo they just took.

import { useEffect, useRef, useState } from "react";

export default function PhotoField({
  label,
  kind, // "member" | "spouse" | "couple"
  existingUrl = "",
  onUploaded = () => {},
}) {
  const [preview, setPreview] = useState(existingUrl || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const objectUrlRef = useRef("");

  // A blob: URL stays in memory until it's revoked, so each new preview
  // releases the previous one.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function handleFile(file) {
    if (!file) return;
    setError("");

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setPreview(objectUrlRef.current);

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);

      const res = await fetch("/api/member/photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Upload failed (HTTP ${res.status})`);

      onUploaded(data.fileUrl);
    } catch (err) {
      setError(err.message || "Could not upload that photo.");
      setPreview(existingUrl || "");
    } finally {
      setUploading(false);
      // Reset both inputs so picking the same file twice still fires change.
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div className="pf-wrap">
      <style>{css}</style>

      <label className="pf-label">{label}</label>

      <div className="pf-body">
        <div className="pf-preview">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} />
          ) : (
            <span className="pf-placeholder">No photo</span>
          )}
          {uploading && <div className="pf-uploading">Uploading…</div>}
        </div>

        <div className="pf-buttons">
          <button
            type="button"
            className="pf-btn"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
          >
            Take photo
          </button>
          <button
            type="button"
            className="pf-btn"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
          >
            Choose from gallery
          </button>
        </div>
      </div>

      {error && <span className="pf-error">{error}</span>}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

const css = `
  .pf-wrap { display: flex; flex-direction: column; gap: 6px; }
  .pf-label { font-size: 12px; color: #7A776E; }
  .pf-body { display: flex; align-items: center; gap: 12px; }
  .pf-preview {
    position: relative;
    width: 72px; height: 72px; border-radius: 8px; overflow: hidden;
    border: 1px solid #B9B6AC; background: #F0EFEA;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .pf-preview img { width: 100%; height: 100%; object-fit: cover; }
  .pf-placeholder { font-size: 10.5px; color: #7A776E; }
  .pf-uploading {
    position: absolute; inset: 0; background: rgba(255,255,255,0.82);
    display: flex; align-items: center; justify-content: center;
    font-size: 10.5px; color: #2B2A27; font-weight: 600;
  }
  .pf-buttons { display: flex; flex-direction: column; gap: 6px; }
  .pf-btn {
    height: 32px; padding: 0 12px; border-radius: 6px;
    border: 1px solid #B9B6AC; background: #FFFFFF;
    font-size: 12.5px; color: #2B2A27; cursor: pointer; white-space: nowrap;
  }
  .pf-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .pf-error { font-size: 11px; color: #B3413A; font-weight: 600; }
`;