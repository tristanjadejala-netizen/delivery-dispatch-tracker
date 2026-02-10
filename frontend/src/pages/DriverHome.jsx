import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import "../styles/driver-home.css";

// Map (Leaflet) — same approach as CustomerDashboard
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon paths (important for Vite/React builds)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
});

const pickupIcon = new L.DivIcon({
  className: "marker pickup-marker",
  html: `<div class="pin pin-pickup"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const dropoffIcon = new L.DivIcon({
  className: "marker dropoff-marker",
  html: `<div class="pin pin-dropoff"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function FitBounds({ pickup, dropoff, fitKey }) {
  const map = useMap();

  useEffect(() => {
    const pts = [];
    if (pickup?.lat && pickup?.lng) pts.push([pickup.lat, pickup.lng]);
    if (dropoff?.lat && dropoff?.lng) pts.push([dropoff.lat, dropoff.lng]);

    if (pts.length === 0) return;

    if (pts.length === 1) {
      map.flyTo(pts[0], Math.max(map.getZoom(), 15), { duration: 0.9 });
      return;
    }

    const bounds = L.latLngBounds(pts.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, {
      padding: [30, 30],
      maxZoom: 16,
      animate: true,
      duration: 0.9,
    });
  }, [fitKey, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, map]);

  return null;
}

function safe(v) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function fmtDateTime(dt) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

function shortTime(dt) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normStatus(s) {
  const t = String(s || "").toUpperCase();
  return t ? t : "PENDING";
}

function prettyStatus(s) {
  return String(s || "PENDING").replaceAll("_", " ");
}

function statusTone(status) {
  const s = normStatus(status);
  const map = {
    PENDING: "warn",
    ASSIGNED: "info",
    PICKED_UP: "neutral",
    IN_TRANSIT: "info",
    DELIVERED: "success",
    FAILED: "danger",
    CANCELLED: "neutral",
  };
  return map[s] || "neutral";
}

function StatusBadge({ status }) {
  const s = normStatus(status);
  const tone = statusTone(s);
  return <span className={`fp-pill fp-pill-${tone}`}>{prettyStatus(s)}</span>;
}

function PriorityBadge({ priority }) {
  const p = String(priority || "NORMAL").toUpperCase();
  const tone = p === "SAME_DAY" ? "danger" : p === "EXPRESS" ? "warn" : "success";
  return <span className={`fp-pill fp-pill-${tone}`}>{p.replaceAll("_", " ")}</span>;
}

function Icon({ name }) {
  const common = { width: 20, height: 20, display: "block" };
  if (name === "pin") {
    return (
      <svg
        viewBox="0 0 24 24"
        style={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    );
  }
  if (name === "box") {
    return (
      <svg
        viewBox="0 0 24 24"
        style={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z" />
        <path d="M3.3 7l8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    );
  }
  if (name === "truck") {
    return (
      <svg
        viewBox="0 0 24 24"
        style={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="1" y="3" width="15" height="13" />
        <path d="M16 8h4l3 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      style={common}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z" />
      <path d="M12 8v6" />
      <path d="M9 11l3 3 3-3" />
    </svg>
  );
}

function Timeline({ events }) {
  const rows = Array.isArray(events) ? events : [];
  return (
    <div className="drvTimeline">
      {rows.length === 0 ? (
        <div className="drvTimelineEmpty">No timeline events yet.</div>
      ) : (
        rows.map((ev, idx) => {
          const s = normStatus(ev.status);
          const top = idx === 0;
          return (
            <div key={ev.id || `${idx}-${s}`} className="drvTlRow">
              <div className="drvTlTime">
                {fmtDateTime(ev.created_at).split(",")[0]}
                <br />
                {shortTime(ev.created_at)}
              </div>

              <div className="drvTlDots">
                <div className={`drvTlDot ${top ? "isTop" : ""}`}>
                  <span className={`drvTlDotIcon tone-${statusTone(s)}`}>
                    {s === "IN_TRANSIT" ? <Icon name="truck" /> : <Icon name="pickup" />}
                  </span>
                </div>
                {idx !== rows.length - 1 ? <div className="drvTlLine" /> : null}
              </div>

              <div className="drvTlText">
                <div className="drvTlTitle">Package is {prettyStatus(s).toLowerCase()}.</div>
                {ev.note ? <div className="drvTlSub">{ev.note}</div> : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fp-modalOverlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="fp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fp-modalHead">
          <div className="fp-modalTitle">{title}</div>
          <button type="button" className="fp-chipBtn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="fp-modalBody">{children}</div>
      </div>
    </div>
  );
}

export default function DriverHome() {
  const [rows, setRows] = useState([]);
  const [eventsById, setEventsById] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Map data (pickup/dropoff coords + route)
  const [track, setTrack] = useState({ pickup: null, dropoff: null, route: null });
  const [trackLoading, setTrackLoading] = useState(false);
  const [fitKey, setFitKey] = useState(0);

  const [actioning, setActioning] = useState(false);

  // POD modal
  const [podOpen, setPodOpen] = useState(false);
  const [podRecipient, setPodRecipient] = useState("");
  const [podNote, setPodNote] = useState("");
  const [podPhoto, setPodPhoto] = useState(null);
  const [podSig, setPodSig] = useState(null);

  // Fail modal
  const [failOpen, setFailOpen] = useState(false);
  const [failReason, setFailReason] = useState("CUSTOMER_UNAVAILABLE");
  const [failNotes, setFailNotes] = useState("");
  const [failPhoto, setFailPhoto] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/driver/deliveries");
      setRows(data.rows || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents(deliveryId) {
    if (!deliveryId) return;
    try {
      const { data } = await api.get(`/driver/deliveries/${deliveryId}/events`);
      setEventsById((p) => ({ ...p, [deliveryId]: data.rows || [] }));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = useMemo(() => {
    const list = [...rows];
    return (
      list.find((d) => normStatus(d.status) === "IN_TRANSIT") ||
      list.find((d) => ["ASSIGNED", "PENDING"].includes(normStatus(d.status))) ||
      list[0] ||
      null
    );
  }, [rows]);

  useEffect(() => {
    if (!current?.id) return;
    if (!eventsById[current.id]) loadEvents(current.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const mapCenter = useMemo(() => {
    if (track?.pickup?.lat && track?.pickup?.lng) return [track.pickup.lat, track.pickup.lng];
    if (track?.dropoff?.lat && track?.dropoff?.lng) return [track.dropoff.lat, track.dropoff.lng];
    // default Bohol-ish center
    return [9.65, 123.85];
  }, [track?.pickup?.lat, track?.pickup?.lng, track?.dropoff?.lat, track?.dropoff?.lng]);

  const pickup = current?.pickup_address || current?.pickupAddress || "";
  const dropoff = current?.dropoff_address || current?.dropoffAddress || "";
  const customerName = current?.customer_name || current?.customerName || "";
  const customerContact = current?.customer_contact || current?.contact_number || current?.contactNumber || "";

  const money = current?.amount ?? current?.price ?? current?.fee ?? current?.delivery_fee ?? null;

  // Fetch geocoded pickup/dropoff + route using the same endpoint as CustomerDashboard
  useEffect(() => {
    async function loadTrack() {
      if (!current?.reference_no && !current?.referenceNumber) {
        setTrack({ pickup: null, dropoff: null, route: null });
        return;
      }

      const ref = String(current.reference_no || current.referenceNumber || "").trim();
      if (!ref) {
        setTrack({ pickup: null, dropoff: null, route: null });
        return;
      }

      setTrackLoading(true);
      try {
        const { data } = await api.get(`/deliveries/track?ref=${encodeURIComponent(ref)}`);
        setTrack({
          pickup: data?.pickup || null,
          dropoff: data?.dropoff || null,
          route: Array.isArray(data?.route) ? data.route : null,
        });
        setFitKey((k) => k + 1);
      } catch {
        // If tracking fails, keep map empty but don't block driver UI
        setTrack({ pickup: null, dropoff: null, route: null });
      } finally {
        setTrackLoading(false);
      }
    }
    loadTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  async function updateStatus(status, note) {
    if (!current?.id) return;
    setActioning(true);
    setErr("");
    try {
      await api.post(`/driver/deliveries/${current.id}/status`, { status, note: note || null });
      await Promise.all([load(), loadEvents(current.id)]);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update status");
    } finally {
      setActioning(false);
    }
  }

  async function submitPOD() {
    if (!current?.id) return;
    if (!podRecipient.trim()) {
      setErr("Recipient name is required.");
      return;
    }
    if (!podPhoto) {
      setErr("POD photo is required.");
      return;
    }

    setActioning(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("recipient_name", podRecipient.trim());
      if (podNote.trim()) fd.append("note", podNote.trim());
      fd.append("photo", podPhoto);
      if (podSig) fd.append("signature", podSig);

      await api.post(`/driver/deliveries/${current.id}/pod`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPodOpen(false);
      setPodRecipient("");
      setPodNote("");
      setPodPhoto(null);
      setPodSig(null);

      await Promise.all([load(), loadEvents(current.id)]);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to submit POD");
    } finally {
      setActioning(false);
    }
  }

  async function submitFail() {
    if (!current?.id) return;
    setActioning(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("reason", failReason);
      if (failNotes.trim()) fd.append("notes", failNotes.trim());
      if (failPhoto) fd.append("photo", failPhoto);

      await api.post(`/driver/deliveries/${current.id}/fail`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFailOpen(false);
      setFailNotes("");
      setFailPhoto(null);

      await Promise.all([load(), loadEvents(current.id)]);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to mark delivery as FAILED");
    } finally {
      setActioning(false);
    }
  }

  const storedStatus = normStatus(current?.status);
  const canPickedUp = storedStatus === "ASSIGNED";
  const canPOD = storedStatus === "IN_TRANSIT";
  const canFail = storedStatus === "IN_TRANSIT";

  return (
    <div className="drvHome">
      <div className="drvTop">
        <div className="drvBrand">
          <span className="drvBrandFast">Fast</span>
          <span className="drvBrandPass">Pass</span>
          <span className="drvBrandTag">Driver</span>
        </div>
        <div className="drvTopActions">
          <button type="button" className="fp-chipBtn" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="fp-alert fp-alert-danger">
          <strong>Notice:</strong> {err}
        </div>
      ) : null}

      {!current ? (
        <div className="fp-card">
          <div className="fp-cardTopbar" />
          <div className="fp-cardBody">
            <div className="drvEmptyTitle">No active delivery</div>
            <div className="drvEmptySub">Once a dispatcher assigns a delivery to you, it will appear here.</div>
          </div>
        </div>
      ) : (
        <div className="drvGrid">
          {/* LEFT: Current delivery */}
          <section className="fp-card">
            <div className="fp-cardTopbar" />
            <div className="fp-cardBody">
              <div className="drvCardHead">
                <div className="drvCardHeadLeft">
                  <div className="drvIconBubble">
                    <Icon name="box" />
                  </div>
                  <div>
                    <div className="drvMeta">Current Delivery</div>
                    <div className="drvRef">{safe(current.reference_no || current.referenceNumber || `#${current.id}`)}</div>
                  </div>
                </div>
                <div className="drvCardHeadRight">
                  {money != null ? <div className="drvMoney">₱{Number(money).toFixed(2)}</div> : null}
                  <div className="drvPills">
                    <PriorityBadge priority={current.delivery_priority || "NORMAL"} />
                    <StatusBadge status={current.status} />
                  </div>
                </div>
              </div>

              <div className="drvRoute">
                <div className="drvRouteCol">
                  <div className="drvMeta">Pickup</div>
                  <div className="drvAddr">{safe(pickup)}</div>
                </div>
                <div className="drvRouteArrow">›</div>
                <div className="drvRouteCol right">
                  <div className="drvMeta">Drop-off</div>
                  <div className="drvAddr">{safe(dropoff)}</div>
                </div>
              </div>

              <div className="drvInfoGrid">
                <div className="drvInfoItem">
                  <div className="drvMeta">Customer</div>
                  <div className="drvValue">{safe(customerName)}</div>
                </div>
                <div className="drvInfoItem right">
                  <div className="drvMeta">Contact</div>
                  <div className="drvValue">{safe(customerContact)}</div>
                </div>
                <div className="drvInfoItem">
                  <div className="drvMeta">Delivery Date</div>
                  <div className="drvValue">{current.delivery_date ? fmtDateTime(current.delivery_date) : "—"}</div>
                </div>
                <div className="drvInfoItem right">
                  <div className="drvMeta">Last Update</div>
                  <div className="drvValue">
                    {eventsById[current.id]?.length
                      ? fmtDateTime(eventsById[current.id][eventsById[current.id].length - 1]?.created_at)
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="drvActions">
                <button
                  type="button"
                  className="fp-btnPrimary"
                  disabled={!canPickedUp || actioning}
                  onClick={() => updateStatus("PICKED_UP", "Picked up")}
                  title={canPickedUp ? "Mark as picked up" : "Picked Up is available only when status is ASSIGNED"}
                >
                  Picked Up
                </button>

                <button
                  type="button"
                  className="fp-btnGhost"
                  disabled={!canPOD || actioning}
                  onClick={() => setPodOpen(true)}
                  title={canPOD ? "Submit proof of delivery" : "Delivered is available only when status is IN TRANSIT"}
                >
                  Delivered (POD)
                </button>

                <button
                  type="button"
                  className="fp-btnDanger"
                  disabled={!canFail || actioning}
                  onClick={() => setFailOpen(true)}
                  title={canFail ? "Mark as failed" : "Failed is available only when status is IN TRANSIT"}
                >
                  Unsuccessful
                </button>

                <button
                  type="button"
                  className="fp-btnLink"
                  onClick={() => {
                    const o = encodeURIComponent(pickup || "");
                    const d = encodeURIComponent(dropoff || "");
                    if (!o || !d) return;
                    window.open(`https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}`, "_blank");
                  }}
                  disabled={!pickup || !dropoff}
                >
                  Open Directions
                </button>
              </div>

              <div className="drvDivider" />

              <div className="drvMetaRow">
                <div className="drvMeta">Timeline</div>
                <div className="drvMetaHint">Status updates are auto-timestamped.</div>
              </div>
              <Timeline events={eventsById[current.id] || []} />
            </div>
          </section>

          {/* RIGHT: Map */}
          <section className="fp-card">
            <div className="fp-cardTopbar" />
            <div className="fp-cardBody">
              <div className="drvMapHead">
                <div className="drvMapTitle">
                  <span className="drvIconBubble small">
                    <Icon name="pin" />
                  </span>
                  Route Map
                </div>
                <div className="drvMapSub">Pickup → Drop-off</div>
              </div>

              <div className="drvMap">
                {trackLoading ? (
                  <div className="drvMapEmpty">Loading map…</div>
                ) : track?.pickup?.lat && track?.pickup?.lng && track?.dropoff?.lat && track?.dropoff?.lng ? (
                  <div className="drvLeaflet">
                    <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                      <FitBounds pickup={track.pickup} dropoff={track.dropoff} fitKey={fitKey} />

                      {/* Pickup */}
                      <Marker position={[track.pickup.lat, track.pickup.lng]} icon={pickupIcon}>
                        <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                          Pickup
                        </Tooltip>
                      </Marker>

                      {/* Drop-off */}
                      <Marker position={[track.dropoff.lat, track.dropoff.lng]} icon={dropoffIcon}>
                        <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                          Drop-off
                        </Tooltip>
                      </Marker>

                      {/* Route */}
                      {Array.isArray(track.route) && track.route.length >= 2 ? <Polyline positions={track.route} /> : null}
                    </MapContainer>
                  </div>
                ) : (
                  <div className="drvMapEmpty">Map preview needs both pickup and drop-off locations.</div>
                )}
              </div>

              <div className="drvMapBtns">
                <button
                  type="button"
                  className="fp-chipBtn"
                  onClick={() => {
                    if (!pickup) return;
                    const q = encodeURIComponent(pickup);
                    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
                  }}
                  disabled={!pickup}
                >
                  Open Pickup
                </button>

                <button
                  type="button"
                  className="fp-chipBtn fp-chipBtnCta"
                  onClick={() => {
                    if (!dropoff) return;
                    const q = encodeURIComponent(dropoff);
                    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
                  }}
                  disabled={!dropoff}
                >
                  Open Drop-off
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* POD Modal */}
      <Modal
        open={podOpen}
        title="Proof of Delivery (POD)"
        onClose={() => {
          if (actioning) return;
          setPodOpen(false);
        }}
      >
        <div className="fp-formGrid">
          <label className="fp-field">
            <span className="fp-fieldLabel">Recipient Name</span>
            <input
              className="fp-control"
              value={podRecipient}
              onChange={(e) => setPodRecipient(e.target.value)}
              placeholder="e.g., Juan Dela Cruz"
            />
          </label>

          <label className="fp-field">
            <span className="fp-fieldLabel">Delivery Note (optional)</span>
            <textarea
              className="fp-textarea"
              value={podNote}
              onChange={(e) => setPodNote(e.target.value)}
              placeholder="Any notes for this delivery…"
            />
          </label>

          <label className="fp-field">
            <span className="fp-fieldLabel">POD Photo (required)</span>
            <input
              className="fp-control fp-file"
              type="file"
              accept="image/*"
              onChange={(e) => setPodPhoto(e.target.files?.[0] || null)}
            />
          </label>

          <label className="fp-field">
            <span className="fp-fieldLabel">Signature (optional)</span>
            <input
              className="fp-control fp-file"
              type="file"
              accept="image/*"
              onChange={(e) => setPodSig(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div className="fp-modalFooter">
          <button type="button" className="fp-btnDanger" onClick={() => setPodOpen(false)} disabled={actioning}>
            Cancel
          </button>
          <button type="button" className="fp-btnPrimary" onClick={submitPOD} disabled={actioning}>
            {actioning ? "Submitting…" : "Submit POD"}
          </button>
        </div>
      </Modal>

      {/* Fail Modal */}
      <Modal
        open={failOpen}
        title="Mark as Unsuccessful"
        onClose={() => {
          if (actioning) return;
          setFailOpen(false);
        }}
      >
        <div className="fp-formGrid">
          <label className="fp-field">
            <span className="fp-fieldLabel">Reason</span>
            <select className="fp-control" value={failReason} onChange={(e) => setFailReason(e.target.value)}>
              <option value="CUSTOMER_UNAVAILABLE">Customer unavailable</option>
              <option value="WRONG_ADDRESS">Wrong address</option>
              <option value="PACKAGE_DAMAGED">Package damaged</option>
              <option value="REFUSED_BY_CUSTOMER">Refused by customer</option>
              <option value="NO_CONTACT">No contact</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="fp-field">
            <span className="fp-fieldLabel">Notes (optional)</span>
            <textarea
              className="fp-textarea"
              value={failNotes}
              onChange={(e) => setFailNotes(e.target.value)}
              placeholder="Add extra details…"
            />
          </label>

          <label className="fp-field">
            <span className="fp-fieldLabel">Photo (optional)</span>
            <input
              className="fp-control fp-file"
              type="file"
              accept="image/*"
              onChange={(e) => setFailPhoto(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div className="fp-modalFooter">
          <button type="button" className="fp-btnGhost" onClick={() => setFailOpen(false)} disabled={actioning}>
            Cancel
          </button>
          <button type="button" className="fp-btnDanger" onClick={submitFail} disabled={actioning}>
            {actioning ? "Saving…" : "Mark Failed"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
