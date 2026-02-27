import { useEffect, useMemo, useRef, useState } from "react";

function fileToObjectUrl(file) {
  if (!file) return "";
  try {
    return URL.createObjectURL(file);
  } catch {
    return "";
  }
}

/**
 * Photo capture modal (mobile-first): uses <input capture>.
 * Props:
 * - open: boolean
 * - title?: string
 * - onClose: () => void
 * - onSave: (file: File) => void
 */
export default function PhotoCaptureModal({ open, title = "Take Customer Photo", onClose, onSave }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");

  const previewUrl = useMemo(() => fileToObjectUrl(file), [file]);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setFile(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const onPick = (f) => {
    setErr("");
    if (!f) return;
    if (!String(f.type || "").startsWith("image/")) {
      setErr("Please capture an image.");
      return;
    }
    setFile(f);
  };

  const retake = () => {
    setErr("");
    setFile(null);
    try {
      if (inputRef.current) inputRef.current.value = "";
    } catch {}
  };

  const save = () => {
    if (!file) {
      setErr("Please take a photo first.");
      return;
    }
    onSave?.(file);
    onClose?.();
  };

  return (
    <div className="drvModalBackdrop" role="dialog" aria-modal="true">
      <div className="drvModal">
        <div className="drvModalHeader">
          <h3>{title}</h3>
          <button className="drvModalClose" onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>

        {!file ? (
          <div className="drvPhotoPick">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onPick(e.target.files?.[0] || null)}
            />
            <p className="drvSub" style={{ marginTop: 10 }}>
              This will open your phone camera. Take a clear photo of the customer (or recipient) for POD.
            </p>
          </div>
        ) : (
          <div className="drvPhotoPreview">
            {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
            <img src={previewUrl} alt="Captured photo preview" />
            <div className="drvBtnRow" style={{ marginTop: 10 }}>
              <button type="button" className="drvBtn drvBtn--ghost drvBtn--full" onClick={retake}>
                Retake
              </button>
              <button type="button" className="drvBtn drvBtn--primary drvBtn--full" onClick={save}>
                Save Photo
              </button>
            </div>
          </div>
        )}

        {err ? <div className="drvFormError">{err}</div> : null}
      </div>
    </div>
  );
}
