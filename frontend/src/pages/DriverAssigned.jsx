import { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ACTIONS = [
  { label: "Picked Up", value: "PICKED_UP" },
  { label: "In Transit", value: "IN_TRANSIT" },
];

const FAIL_REASONS = [
  { label: "Customer unavailable", value: "CUSTOMER_UNAVAILABLE" },
  { label: "Wrong address", value: "WRONG_ADDRESS" },
  { label: "Package damaged", value: "PACKAGE_DAMAGED" },
  { label: "Refused by customer", value: "REFUSED_BY_CUSTOMER" },
  { label: "No contact", value: "NO_CONTACT" },
  { label: "Other", value: "OTHER" },
];

const styles = {
  // NOTE: Page background/padding is handled by DriverLayout.
  page: {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#0b1220",
  },
  container: { maxWidth: 720, margin: "0 auto" },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 1000, letterSpacing: -0.2 },
  subtitle: { marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 700 },

  statRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 12px 26px rgba(11,18,32,0.10)",
  },
  statLabel: { fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 900 },
  statValue: { fontSize: 18, fontWeight: 1000, letterSpacing: -0.2 },

  alert: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#991b1b",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: 900,
  },

  list: { display: "grid", gap: 12 },

  card: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 16px 34px rgba(11,18,32,0.12)",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  ref: { fontWeight: 1000, letterSpacing: -0.2 },
  customer: { fontWeight: 900, color: "#0f172a" },

  badge: (status) => {
    const map = {
      DELIVERED: { fg: "#065f46", bg: "#d1fae5", bd: "#a7f3d0" },
      FAILED: { fg: "#991b1b", bg: "#fee2e2", bd: "#fecaca" },
      IN_TRANSIT: { fg: "#1d4ed8", bg: "#dbeafe", bd: "#bfdbfe" },
      PICKED_UP: { fg: "#1f2937", bg: "#e5e7eb", bd: "#d1d5db" },
      ASSIGNED: { fg: "#0b3b8f", bg: "#dbeafe", bd: "#bfdbfe" },
      PENDING: { fg: "#854d0e", bg: "#fef9c3", bd: "#fde68a" },
      CANCELLED: { fg: "#334155", bg: "#e2e8f0", bd: "#cbd5e1" },
    };
    const c = map[status] || { fg: "#374151", bg: "#f3f4f6", bd: "#e5e7eb" };
    return {
      display: "inline-flex",
      alignItems: "center",
      height: 24,
      padding: "0 10px",
      borderRadius: 999,
      border: `1px solid ${c.bd}`,
      background: c.bg,
      color: c.fg,
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: 0.2,
      whiteSpace: "nowrap",
    };
  },

  route: { marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 700 },

  input: {
    width: "100%",
    height: 40,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    outline: "none",
    background: "rgba(255,255,255,0.96)",
    marginTop: 10,
    fontWeight: 800,
    color: "#0b1220",
  },

  btnRow: { marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  btn: (variant = "ghost", disabled = false) => {
    const base = {
      height: 34,
      padding: "0 12px",
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 1000,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "rgba(255,255,255,0.95)",
      color: "#0f172a",
    };
    if (variant === "primary") {
      return {
        ...base,
        background:
          "linear-gradient(135deg, rgba(0,112,255,0.95) 0%, rgba(11,59,143,0.95) 60%, rgba(255,126,24,0.90) 120%)",
        border: "1px solid rgba(0,112,255,0.20)",
        color: "#fff",
        boxShadow: "0 14px 28px rgba(11,18,32,0.18)",
      };
    }
    if (variant === "danger") {
      return {
        ...base,
        background: "linear-gradient(180deg, rgba(239,68,68,0.95) 0%, rgba(185,28,28,0.95) 100%)",
        border: "1px solid rgba(239,68,68,0.25)",
        color: "#fff",
        boxShadow: "0 14px 28px rgba(11,18,32,0.18)",
      };
    }
    return base;
  },

  section: {
    marginTop: 12,
    borderTop: "1px dashed rgba(15,23,42,0.14)",
    paddingTop: 12,
    display: "grid",
    gap: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: 1000, margin: 0 },

  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  fieldLabel: { fontSize: 12, fontWeight: 1000, color: "#334155", marginBottom: 6 },
  small: { fontSize: 12, color: "#64748b", fontWeight: 700 },

  fileBox: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.96)",
  },

  hint: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
    fontWeight: 700,
  },

  previewImg: {
    width: "100%",
    marginTop: 10,
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
  },

  timelineItem: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.96)",
  },
};

function fmt(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  function pos(e) {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function start(e) {
    e.preventDefault();
    const p = pos(e);
    drawing.current = true;
    last.current = p;
  }

  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    const p = pos(e);

    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";

    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    last.current = p;
  }

  function end(e) {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
    const c = canvasRef.current;
    onChange(c.toDataURL("image/png"));
  }

  function clear() {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    onChange("");
  }

  return (
    <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: 10, background: "rgba(255,255,255,0.96)" }}>
      <div style={{ fontSize: 12, fontWeight: 1000, marginBottom: 8 }}>Signature (draw) — optional</div>
      <canvas
        ref={canvasRef}
        width={520}
        height={160}
        style={{
          width: "100%",
          height: 160,
          borderRadius: 10,
          background: "rgba(248,250,252,1)",
          border: "1px solid rgba(15,23,42,0.12)",
          touchAction: "none",
        }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button
          type="button"
          style={{ height: 34, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.12)", fontWeight: 1000 }}
          onClick={clear}
        >
          Clear
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, fontWeight: 700 }}>
        Works on touch devices. If you don’t need a signature, leave it blank.
      </div>
    </div>
  );
}

export default function DriverAssigned() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Location
  const [loc, setLoc] = useState(null);
  const [locErr, setLocErr] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [locAuto, setLocAuto] = useState(false);

  const [note, setNote] = useState({});
  const [updatingId, setUpdatingId] = useState(null);

  // FAIL state per delivery
  const [failOpen, setFailOpen] = useState({});
  const [failReason, setFailReason] = useState({});
  const [failNotes, setFailNotes] = useState({});
  const [failPhoto, setFailPhoto] = useState({});
  const [failSubmittingId, setFailSubmittingId] = useState(null);
  const [failViewOpen, setFailViewOpen] = useState({});
  const [failView, setFailView] = useState({});

  // POD state per delivery
  const [podOpen, setPodOpen] = useState({});
  const [recipientName, setRecipientName] = useState({});
  const [podNote, setPodNote] = useState({});
  const [podPhoto, setPodPhoto] = useState({});
  const [sigDataUrl, setSigDataUrl] = useState({});
  const [podSubmittingId, setPodSubmittingId] = useState(null);
  const [podViewOpen, setPodViewOpen] = useState({});
  const [podView, setPodView] = useState({});

  // Timeline
  const [timelineOpen, setTimelineOpen] = useState({});
  const [events, setEvents] = useState({});
  const [eventsLoading, setEventsLoading] = useState({});

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/driver/deliveries");
      setRows(data.rows);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load driver deliveries");
    } finally {
      setLoading(false);
    }
  }

  async function loadMyLocation() {
    setLocErr("");
    try {
      const { data } = await api.get("/driver/location");
      setLoc(data);
    } catch (e) {
      setLocErr(e?.response?.data?.message || "Failed to load location");
    }
  }

  async function pushLocationOnce() {
    setLocLoading(true);
    setLocErr("");

    if (!navigator.geolocation) {
      setLocErr("Geolocation is not supported on this device/browser.");
      setLocLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const payload = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          };

          const { data } = await api.post("/driver/location", payload);
          setLoc(data);
        } catch (e) {
          setLocErr(e?.response?.data?.message || "Failed to update location");
        } finally {
          setLocLoading(false);
        }
      },
      (geoErr) => {
        setLocErr(geoErr?.message || "Location permission denied or unavailable.");
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  useEffect(() => {
    load();
    loadMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!locAuto) return;
    const id = setInterval(() => {
      pushLocationOnce();
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locAuto]);

  async function updateStatus(deliveryId, status) {
    setUpdatingId(deliveryId);
    setErr("");
    try {
      await api.post(`/driver/deliveries/${deliveryId}/status`, {
        status,
        note: note[deliveryId] || "",
      });
      await load();
      if (timelineOpen[deliveryId]) await loadEvents(deliveryId);
    } catch (e) {
      setErr(e?.response?.data?.message || "Status update failed");
    } finally {
      setUpdatingId(null);
    }
  }

  function togglePod(deliveryId) {
    setPodOpen((p) => ({ ...p, [deliveryId]: !p[deliveryId] }));
    setFailOpen((p) => ({ ...p, [deliveryId]: false }));
  }

  function toggleFail(deliveryId) {
    setFailOpen((p) => ({ ...p, [deliveryId]: !p[deliveryId] }));
    setPodOpen((p) => ({ ...p, [deliveryId]: false }));
  }

  async function submitFail(deliveryId) {
    const reason = failReason[deliveryId];
    if (!reason) return alert("Please select a failure reason.");

    setFailSubmittingId(deliveryId);
    setErr("");

    try {
      const fd = new FormData();
      fd.append("reason", reason);
      fd.append("notes", failNotes[deliveryId] || "");
      if (failPhoto[deliveryId]) fd.append("photo", failPhoto[deliveryId]);

      await api.post(`/driver/deliveries/${deliveryId}/fail`, fd);

      setFailOpen((p) => ({ ...p, [deliveryId]: false }));
      await load();
      if (timelineOpen[deliveryId]) await loadEvents(deliveryId);
      alert("Marked as FAILED.");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed delivery submit failed");
    } finally {
      setFailSubmittingId(null);
    }
  }

  async function submitPod(deliveryId) {
    const rn = (recipientName[deliveryId] || "").trim();
    if (!rn) return alert("Recipient name is required.");
    if (!podPhoto[deliveryId]) return alert("Photo is required.");

    setPodSubmittingId(deliveryId);
    setErr("");

    try {
      const fd = new FormData();
      fd.append("recipient_name", rn);
      fd.append("note", podNote[deliveryId] || "");
      fd.append("photo", podPhoto[deliveryId]);

      const sig = sigDataUrl[deliveryId];
      if (sig) {
        const blob = await (await fetch(sig)).blob();
        fd.append("signature", blob, `signature-${deliveryId}.png`);
      }

      await api.post(`/driver/deliveries/${deliveryId}/pod`, fd);

      setPodOpen((p) => ({ ...p, [deliveryId]: false }));
      await load();
      if (timelineOpen[deliveryId]) await loadEvents(deliveryId);
      alert("POD submitted!");
    } catch (e) {
      setErr(e?.response?.data?.message || "POD submit failed");
    } finally {
      setPodSubmittingId(null);
    }
  }

  async function loadEvents(deliveryId) {
    setEventsLoading((p) => ({ ...p, [deliveryId]: true }));
    try {
      const { data } = await api.get(`/driver/deliveries/${deliveryId}/events`);
      setEvents((p) => ({ ...p, [deliveryId]: data.rows || [] }));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load timeline");
    } finally {
      setEventsLoading((p) => ({ ...p, [deliveryId]: false }));
    }
  }

  async function loadPod(deliveryId) {
    try {
      const { data } = await api.get(`/driver/deliveries/${deliveryId}/pod`);
      setPodView((p) => ({ ...p, [deliveryId]: data }));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load POD details");
    }
  }

  async function loadFailure(deliveryId) {
    try {
      const { data } = await api.get(`/driver/deliveries/${deliveryId}/failure`);
      setFailView((p) => ({ ...p, [deliveryId]: data }));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load failure details");
    }
  }

  const stats = useMemo(() => {
    const s = { total: rows.length, active: 0, delivered: 0, failed: 0 };
    for (const d of rows) {
      if (d.status === "DELIVERED") s.delivered++;
      else if (d.status === "FAILED") s.failed++;
      else if (["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "PENDING"].includes(d.status)) s.active++;
    }
    return s;
  }, [rows]);

  function canAction(currentStatus, action) {
    const allowedNext = {
      ASSIGNED: ["PICKED_UP"],
      PICKED_UP: ["IN_TRANSIT"],
      IN_TRANSIT: [],
      PENDING: [],
      DELIVERED: [],
      FAILED: [],
      CANCELLED: [],
    };
    return (allowedNext[currentStatus] || []).includes(action);
  }

  function toggleTimeline(deliveryId) {
    setTimelineOpen((p) => ({ ...p, [deliveryId]: !p[deliveryId] }));
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Assigned Deliveries</h2>
            <div style={styles.subtitle}>
              Update status, submit Proof of Delivery (POD), view timeline, and report failed deliveries.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={styles.btn("ghost")} onClick={loadMyLocation}>
              My Location
            </button>

            <button style={styles.btn("primary", locLoading)} disabled={locLoading} onClick={pushLocationOnce}>
              {locLoading ? "Updating..." : "Update Location"}
            </button>

            <button style={styles.btn("ghost")} onClick={() => setLocAuto((v) => !v)}>
              {locAuto ? "Auto: ON" : "Auto: OFF"}
            </button>

            <button style={styles.btn("primary", loading)} disabled={loading} onClick={load}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {err ? <div style={styles.alert}>{err}</div> : null}
        {locErr ? <div style={styles.alert}>{locErr}</div> : null}

        <div style={styles.statRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total</div>
            <div style={styles.statValue}>{stats.total}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Active</div>
            <div style={styles.statValue}>{stats.active}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Delivered</div>
            <div style={styles.statValue}>{stats.delivered}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Failed</div>
            <div style={styles.statValue}>{stats.failed}</div>
          </div>
        </div>

        <div style={styles.list}>
          {rows.map((d) => {
            const status = d.status || "PENDING";
            const isUpdating = updatingId === d.id;

            const pod = podView[d.id];
            const failure = failView[d.id];

            return (
              <div key={d.id} style={styles.card}>
                <div style={styles.topRow}>
                  <div>
                    <div style={styles.ref}>REF: {d.reference_no || `#${d.id}`}</div>
                    <div style={styles.customer}>{d.customer_name || "Customer"}</div>
                    <div style={styles.route}>
                      {d.pickup_address || "Pickup"} → {d.dropoff_address || "Drop-off"}
                    </div>
                  </div>
                  <div style={styles.badge(status)}>{status.replaceAll("_", " ")}</div>
                </div>

                <input
                  style={styles.input}
                  placeholder="Optional note (e.g. arrived at pickup)"
                  value={note[d.id] || ""}
                  onChange={(e) => setNote((p) => ({ ...p, [d.id]: e.target.value }))}
                />

                <div style={styles.btnRow}>
                  {ACTIONS.map((a) => (
                    <button
                      key={a.value}
                      style={styles.btn("primary", isUpdating || !canAction(status, a.value))}
                      disabled={isUpdating || !canAction(status, a.value)}
                      onClick={() => updateStatus(d.id, a.value)}
                    >
                      {isUpdating ? "Updating..." : a.label}
                    </button>
                  ))}

                  <button style={styles.btn("ghost")} onClick={() => togglePod(d.id)}>
                    POD
                  </button>

                  <button style={styles.btn("danger")} onClick={() => toggleFail(d.id)}>
                    Fail
                  </button>

                  <button
                    style={styles.btn("ghost")}
                    onClick={async () => {
                      toggleTimeline(d.id);
                      if (!events[d.id]) await loadEvents(d.id);
                    }}
                  >
                    Timeline
                  </button>
                </div>

                {/* POD Section */}
                {podOpen[d.id] ? (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Proof of Delivery (POD)</h3>

                    <div style={styles.grid2}>
                      <div>
                        <div style={styles.fieldLabel}>Recipient Name</div>
                        <input
                          style={styles.input}
                          value={recipientName[d.id] || ""}
                          onChange={(e) => setRecipientName((p) => ({ ...p, [d.id]: e.target.value }))}
                          placeholder="e.g. Juan Dela Cruz"
                        />
                        <div style={styles.small}>Required</div>
                      </div>

                      <div>
                        <div style={styles.fieldLabel}>Photo</div>
                        <div style={styles.fileBox}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              setPodPhoto((p) => ({ ...p, [d.id]: f || null }));
                            }}
                          />
                          <div style={styles.small}>Required</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={styles.fieldLabel}>Note (optional)</div>
                      <input
                        style={styles.input}
                        value={podNote[d.id] || ""}
                        onChange={(e) => setPodNote((p) => ({ ...p, [d.id]: e.target.value }))}
                        placeholder="Optional note"
                      />
                    </div>

                    <SignaturePad onChange={(val) => setSigDataUrl((p) => ({ ...p, [d.id]: val }))} />

                    <div style={styles.btnRow}>
                      <button
                        style={styles.btn("primary", podSubmittingId === d.id)}
                        disabled={podSubmittingId === d.id}
                        onClick={() => submitPod(d.id)}
                      >
                        {podSubmittingId === d.id ? "Submitting..." : "Submit POD"}
                      </button>

                      <button
                        style={styles.btn("ghost")}
                        onClick={async () => {
                          setPodViewOpen((p) => ({ ...p, [d.id]: !p[d.id] }));
                          if (!podView[d.id]) await loadPod(d.id);
                        }}
                      >
                        View POD
                      </button>
                    </div>

                    {podViewOpen[d.id] && pod ? (
                      <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>POD Details</h3>
                        <div style={styles.hint}>
                          Recipient: <b>{pod.recipient_name}</b>
                          <br />
                          Delivered at: <b>{fmt(pod.delivered_at)}</b>
                          <br />
                          Note: {pod.note || "—"}
                        </div>

                        {pod.photo_url ? (
                          <img
                            alt="POD photo"
                            style={styles.previewImg}
                            src={`${API_BASE}${pod.photo_url}`}
                          />
                        ) : null}

                        {pod.signature_url ? (
                          <img
                            alt="Signature"
                            style={styles.previewImg}
                            src={`${API_BASE}${pod.signature_url}`}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* FAIL Section */}
                {failOpen[d.id] ? (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Mark as Failed</h3>

                    <div style={styles.grid2}>
                      <div>
                        <div style={styles.fieldLabel}>Reason</div>
                        <select
                          style={styles.input}
                          value={failReason[d.id] || ""}
                          onChange={(e) => setFailReason((p) => ({ ...p, [d.id]: e.target.value }))}
                        >
                          <option value="">Select reason...</option>
                          {FAIL_REASONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div style={styles.fieldLabel}>Photo (optional)</div>
                        <div style={styles.fileBox}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              setFailPhoto((p) => ({ ...p, [d.id]: f || null }));
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={styles.fieldLabel}>Notes (optional)</div>
                      <input
                        style={styles.input}
                        value={failNotes[d.id] || ""}
                        onChange={(e) => setFailNotes((p) => ({ ...p, [d.id]: e.target.value }))}
                        placeholder="What happened?"
                      />
                    </div>

                    <div style={styles.btnRow}>
                      <button
                        style={styles.btn("danger", failSubmittingId === d.id)}
                        disabled={failSubmittingId === d.id}
                        onClick={() => submitFail(d.id)}
                      >
                        {failSubmittingId === d.id ? "Submitting..." : "Submit Failure"}
                      </button>

                      <button
                        style={styles.btn("ghost")}
                        onClick={async () => {
                          setFailViewOpen((p) => ({ ...p, [d.id]: !p[d.id] }));
                          if (!failView[d.id]) await loadFailure(d.id);
                        }}
                      >
                        View Failure
                      </button>
                    </div>

                    {failViewOpen[d.id] && failure ? (
                      <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>Failure Details</h3>
                        <div style={styles.hint}>
                          Reason: <b>{failure.reason}</b>
                          <br />
                          Failed at: <b>{fmt(failure.failed_at)}</b>
                          <br />
                          Notes: {failure.notes || "—"}
                        </div>

                        {failure.photo_url ? (
                          <img
                            alt="Failure photo"
                            style={styles.previewImg}
                            src={`${API_BASE}${failure.photo_url}`}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Timeline */}
                {timelineOpen[d.id] ? (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Timeline</h3>

                    {eventsLoading[d.id] ? (
                      <div style={styles.hint}>Loading timeline…</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {(events[d.id] || []).map((ev) => (
                          <div key={ev.id} style={styles.timelineItem}>
                            <div style={{ fontSize: 12, fontWeight: 1000 }}>
                              {String(ev.status || "").replaceAll("_", " ")}
                            </div>
                            <div style={styles.small}>{fmt(ev.created_at)}</div>
                            {ev.note ? <div style={styles.hint}>{ev.note}</div> : null}
                          </div>
                        ))}
                        {!events[d.id]?.length ? (
                          <div style={styles.hint}>No events yet.</div>
                        ) : null}
                      </div>
                    )}

                    <div style={styles.btnRow}>
                      <button style={styles.btn("ghost")} onClick={() => loadEvents(d.id)}>
                        Refresh Timeline
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
