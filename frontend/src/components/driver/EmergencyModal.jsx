import { useEffect, useMemo, useState } from "react";

const OPTIONS = [
  { value: "TIRE_FLAT", label: "Tire got flat" },
  { value: "ACCIDENT", label: "Accident / minor incident" },
  { value: "VEHICLE_ISSUE", label: "Vehicle issue" },
  { value: "HEAVY_TRAFFIC", label: "Heavy traffic" },
  { value: "WRONG_ADDRESS", label: "Wrong address / cannot locate pickup" },
  { value: "CUSTOMER_UNREACHABLE", label: "Customer unreachable" },
  { value: "OTHER", label: "Other" },
];

/**
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - onSubmit: ({ type, message }) => Promise<void>
 * - busy?: boolean
 */
export default function EmergencyModal({ open, onClose, onSubmit, busy = false }) {
  const [type, setType] = useState("TIRE_FLAT");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");

  const needsMessage = useMemo(() => type === "OTHER", [type]);

  useEffect(() => {
    if (!open) return;
    setType("TIRE_FLAT");
    setMessage("");
    setErr("");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setErr("");
    const msg = message.trim();
    if (needsMessage && !msg) {
      setErr("Please enter a short message.");
      return;
    }
    try {
      await onSubmit?.({ type, message: msg || null });
      onClose?.();
    } catch (e) {
      setErr(e?.message || "Failed to send emergency update.");
    }
  };

  return (
    <div className="drvModalBackdrop" role="dialog" aria-modal="true">
      <div className="drvModal">
        <div className="drvModalHeader">
          <h3>Emergency Update</h3>
          <button className="drvModalClose" onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="drvField">
          <label>Reason *</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="drvField">
          <label>Message {needsMessage ? "*" : "(optional)"}</label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={needsMessage ? "Type what happened…" : "Add more details (optional)…"}
          />
        </div>

        {err ? <div className="drvFormError">{err}</div> : null}

        <button className="drvBtn drvBtn--danger drvBtn--full" onClick={submit} disabled={busy} type="button">
          {busy ? "Sending…" : "Notify Customer"}
        </button>
      </div>
    </div>
  );
}
