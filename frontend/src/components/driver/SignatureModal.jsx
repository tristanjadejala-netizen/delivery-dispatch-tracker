import { useEffect, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

function dataUrlIsEmpty(dataUrl) {
  return !dataUrl || typeof dataUrl !== "string" || dataUrl.length < 50;
}

/**
 * Bottom-sheet modal signature capture.
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - onSave: (signatureDataUrl: string) => void
 */
export default function SignatureModal({ open, onClose, onSave }) {
  const sigRef = useRef(null);
  const [err, setErr] = useState("");

  const canvasProps = useMemo(
    () => ({
      className: "drvSigCanvas",
    }),
    []
  );

  useEffect(() => {
    if (!open) return;
    setErr("");
    // prevent background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const clear = () => {
    try {
      sigRef.current?.clear();
      setErr("");
    } catch {}
  };

  const save = () => {
    setErr("");
    try {
      if (!sigRef.current || sigRef.current.isEmpty()) {
        setErr("Please add a signature first.");
        return;
      }
      const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
      if (dataUrlIsEmpty(dataUrl)) {
        setErr("Signature looks empty. Please try again.");
        return;
      }
      onSave?.(dataUrl);
      onClose?.();
    } catch {
      setErr("Could not save signature.");
    }
  };

  return (
    <div className="drvModalBackdrop" role="dialog" aria-modal="true">
      <div className="drvModal">
        <div className="drvModalHeader">
          <h3>Capture Signature</h3>
          <button className="drvModalClose" onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="drvSigFrame">
          <SignatureCanvas
            ref={sigRef}
            penColor="#0f172a"
            backgroundColor="rgba(255,255,255,1)"
            canvasProps={canvasProps}
          />
        </div>

        {err ? <div className="drvFormError">{err}</div> : null}

        <div className="drvBtnRow">
          <button type="button" className="drvBtn drvBtn--ghost drvBtn--full" onClick={clear}>
            Clear
          </button>
          <button type="button" className="drvBtn drvBtn--primary drvBtn--full" onClick={save}>
            Save Signature
          </button>
        </div>
      </div>
    </div>
  );
}
