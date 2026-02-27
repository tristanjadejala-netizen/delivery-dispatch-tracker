import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDriverDeliveries, submitDriverEmergency, submitDriverFail, submitDriverPOD, updateDriverDeliveryStatus } from "../api/driver";

import SignatureModal from "../components/driver/SignatureModal";
import PhotoCaptureModal from "../components/driver/PhotoCaptureModal";
import EmergencyModal from "../components/driver/EmergencyModal";

import { distanceKm } from "../utils/distanceKm";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon paths (important for Vite)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
});

/* ---------------- helpers ---------------- */
function isNum(v) {
  return typeof v === "number" && !Number.isNaN(v);
}

function toLatLng(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  return isNum(a) && isNum(b) ? [a, b] : null;
}

function normalizeStatus(s) {
  return String(s || "").toUpperCase().trim() || "ASSIGNED";
}

// UI step index: ASSIGNED -> PICKED_UP -> IN_TRANSIT -> DELIVERED
function stepIndex(stored) {
  const s = normalizeStatus(stored);
  if (s === "DELIVERED") return 3;
  if (s === "IN_TRANSIT") return 2;
  if (s === "ASSIGNED") return 0;
  // treat other/legacy values as "ASSIGNED"
  return 0;
}

function primaryLabel(stored) {
  const s = normalizeStatus(stored);
  if (s === "ASSIGNED") return "Start Pickup";
  if (s === "IN_TRANSIT") return "Complete Delivery";
  return "Update";
}

function dataUrlToFile(dataUrl, filename = "signature.png") {
  try {
    const [meta, b64] = String(dataUrl || "").split(",");
    const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/png";
    const bin = atob(b64 || "");
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  } catch {
    return null;
  }
}

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    const valid = (points || []).filter(
      (p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1])
    );
    if (!valid.length) return;

    const b = L.latLngBounds(valid.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(b, { padding: [26, 26] });
  }, [map, points]);

  return null;
}

function StepProgress({ status }) {
  const steps = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
  const idx = stepIndex(status);

  return (
    <div className="drvProgWrap" aria-label="Mission progress">
      <div className="drvProgRow">
        {steps.map((s, i) => {
          const active = i <= idx;
          return (
            <div key={s} className="drvProgStep">
              <div className={`drvProgDot ${active ? "isActive" : ""}`} />
              {i !== steps.length - 1 && (
                <div className={`drvProgLine ${active ? "isActive" : ""}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="drvProgLabels">
        <span className={idx >= 0 ? "isActive" : ""}>Assigned</span>
        <span className={idx >= 1 ? "isActive" : ""}>Picked Up</span>
        <span className={idx >= 2 ? "isActive" : ""}>In Transit</span>
        <span className={idx >= 3 ? "isActive" : ""}>Delivered</span>
      </div>
    </div>
  );
}

export default function DriverAssigned() {
  const [deliveries, setDeliveries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Live driver marker
  const [driverPos, setDriverPos] = useState(null); // [lat,lng]
  const [geoErr, setGeoErr] = useState("");
  const [geoUpdatedAt, setGeoUpdatedAt] = useState(null);

  // Swipe between orders (gesture for mission area)
  const startXRef = useRef(0);

  // Carousel ref to auto-snap selected into view
  const stripRef = useRef(null);

  // POD modal
  const [podOpen, setPodOpen] = useState(false);
  const [podRecipient, setPodRecipient] = useState("");
  const [podNote, setPodNote] = useState("");
  const [podPhoto, setPodPhoto] = useState(null); // File
  const [podSigDataUrl, setPodSigDataUrl] = useState("");
  const [podErr, setPodErr] = useState("");

  const [sigOpen, setSigOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  // Emergency modal
  const [emOpen, setEmOpen] = useState(false);
  const [emBusy, setEmBusy] = useState(false);

  // Fail modal
  const [failOpen, setFailOpen] = useState(false);
  const [failReason, setFailReason] = useState("NO_CONTACT");
  const [failNotes, setFailNotes] = useState("");
  const [failPhoto, setFailPhoto] = useState(null);
  const [failErr, setFailErr] = useState("");

  async function fetchDeliveries() {
    try {
      const rows = await fetchDriverDeliveries();
      setDeliveries(rows);

      const active = rows.filter((d) => {
        const s = normalizeStatus(d?.status);
        return !["DELIVERED", "FAILED", "CANCELLED"].includes(s);
      });

      setSelectedId((prev) => {
        if (prev && active.some((d) => d.id === prev)) return prev;
        return active[0]?.id ?? null;
      });
    } catch (e) {
      console.error(e);
      setDeliveries([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live driver marker movement
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoErr("Geolocation not supported on this device.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoErr("");
        setDriverPos([pos.coords.latitude, pos.coords.longitude]);
        setGeoUpdatedAt(Date.now());
      },
      () => setGeoErr("Location permission denied or unavailable."),
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 }
    );

    return () => {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {}
    };
  }, []);

  const activeDeliveries = useMemo(() => {
    const base = deliveries.filter((d) => {
      const s = normalizeStatus(d?.status);
      return !["DELIVERED", "FAILED", "CANCELLED"].includes(s);
    });

    // compute pickup distance + sort (closest first)
    const withDist = base.map((d) => {
      const pickupLL = toLatLng(d?.pickup_lat, d?.pickup_lng);
      const km = driverPos && pickupLL ? distanceKm(driverPos[0], driverPos[1], pickupLL[0], pickupLL[1]) : Infinity;
      return { ...d, _pickupDistanceKm: km };
    });

    withDist.sort((a, b) => {
      const ak = Number.isFinite(a._pickupDistanceKm) ? a._pickupDistanceKm : Infinity;
      const bk = Number.isFinite(b._pickupDistanceKm) ? b._pickupDistanceKm : Infinity;
      if (ak !== bk) return ak - bk;
      // tiebreaker: newest first
      const at = new Date(a?.created_at || a?.createdAt || 0).getTime();
      const bt = new Date(b?.created_at || b?.createdAt || 0).getTime();
      return bt - at;
    });

    return withDist;
  }, [deliveries, driverPos]);

  const selected = useMemo(() => {
    return activeDeliveries.find((d) => d.id === selectedId) || activeDeliveries[0] || null;
  }, [activeDeliveries, selectedId]);

  const pickup = useMemo(() => (selected ? toLatLng(selected.pickup_lat, selected.pickup_lng) : null), [selected]);
  const dropoff = useMemo(() => (selected ? toLatLng(selected.dropoff_lat, selected.dropoff_lng) : null), [selected]);

  const target = useMemo(() => {
    if (!selected) return null;
    const s = normalizeStatus(selected.status);
    return s === "ASSIGNED" ? pickup : dropoff;
  }, [selected, pickup, dropoff]);

  const eta = useMemo(() => {
    if (!driverPos || !target) return null;
    const km = distanceKm(driverPos[0], driverPos[1], target[0], target[1]);
    const avgSpeedKmh = 28; // tune anytime
    const minutes = Math.max(1, Math.round((km / avgSpeedKmh) * 60));
    return { minutes, km: Number(km.toFixed(1)) };
  }, [driverPos, target]);

  const pickupDistanceLabel = useMemo(() => {
    if (!selected) return "";
    const pickupLL = toLatLng(selected?.pickup_lat, selected?.pickup_lng);
    if (!driverPos || !pickupLL) return "—";
    const km = distanceKm(driverPos[0], driverPos[1], pickupLL[0], pickupLL[1]);
    if (!Number.isFinite(km)) return "—";
    return `${km.toFixed(1)} km away`;
  }, [selected, driverPos]);

  const geoUpdatedLabel = useMemo(() => {
    if (!geoUpdatedAt) return "";
    const diff = Math.max(0, Math.round((Date.now() - geoUpdatedAt) / 1000));
    if (diff <= 4) return "Updated just now";
    if (diff < 60) return `Updated ${diff}s ago`;
    const m = Math.round(diff / 60);
    return `Updated ${m}m ago`;
  }, [geoUpdatedAt]);

  const mapPoints = useMemo(() => {
    const pts = [];
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    if (driverPos) pts.push(driverPos);
    return pts;
  }, [pickup, dropoff, driverPos]);

  // Auto-scroll selected card into view (carousel)
  useEffect(() => {
    if (!stripRef.current || !selectedId) return;
    const el = stripRef.current.querySelector(`[data-order-id="${selectedId}"]`);
    if (!el) return;
    // snap to center
    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  function handleTouchStart(e) {
    startXRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    const endX = e.changedTouches[0].clientX;
    const delta = endX - startXRef.current;
    if (Math.abs(delta) < 55) return;

    const idx = activeDeliveries.findIndex((d) => d.id === selectedId);
    if (idx === -1) return;

    if (delta < 0 && idx < activeDeliveries.length - 1) setSelectedId(activeDeliveries[idx + 1].id);
    if (delta > 0 && idx > 0) setSelectedId(activeDeliveries[idx - 1].id);
  }

  function openGoogleMaps() {
    if (!target) return;
    const destination = `${target[0]},${target[1]}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      destination
    )}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function onPrimaryAction() {
    if (!selected) return;
    const s = normalizeStatus(selected.status);

    // ASSIGNED -> PICKED_UP (backend expects status string "PICKED_UP")
    if (s === "ASSIGNED") {
      setBusy(true);
      try {
        await updateDriverDeliveryStatus(selected.id, { status: "PICKED_UP" });
        await fetchDeliveries();
      } catch (e) {
        console.error(e);
      } finally {
        setBusy(false);
      }
      return;
    }

    // IN_TRANSIT -> open POD modal
    if (s === "IN_TRANSIT") {
      setPodErr("");
      setPodOpen(true);
    }
  }

  async function submitPOD() {
    if (!selected) return;

    const recipient = podRecipient.trim();
    if (!recipient) {
      setPodErr("Recipient name is required.");
      return;
    }
    if (!podPhoto) {
      setPodErr("Proof photo is required.");
      return;
    }

    setBusy(true);
    setPodErr("");

    try {
      const fd = new FormData();
      fd.append("recipient_name", recipient);
      if (podNote.trim()) fd.append("note", podNote.trim());
      fd.append("photo", podPhoto);
      if (podSigDataUrl) {
        const f = dataUrlToFile(podSigDataUrl, `signature_${selected.id}.png`);
        if (f) fd.append("signature", f);
      }

      await submitDriverPOD(selected.id, fd);

      setPodOpen(false);
      setPodRecipient("");
      setPodNote("");
      setPodPhoto(null);
      setPodSigDataUrl("");

      await fetchDeliveries();
    } catch (e) {
      console.error(e);
      setPodErr(e?.response?.data?.message || "Failed to submit POD.");
    } finally {
      setBusy(false);
    }
  }

  async function submitFail() {
    if (!selected) return;

    setBusy(true);
    setFailErr("");

    try {
      const fd = new FormData();
      fd.append("reason", failReason);
      if (failNotes.trim()) fd.append("notes", failNotes.trim());
      if (failPhoto) fd.append("photo", failPhoto);

      await submitDriverFail(selected.id, fd);

      setFailOpen(false);
      setFailNotes("");
      setFailPhoto(null);
      setFailReason("NO_CONTACT");

      await fetchDeliveries();
    } catch (e) {
      console.error(e);
      setFailErr(e?.response?.data?.message || "Failed to submit failure report.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEmergency({ type, message }) {
    if (!selected) return;
    setEmBusy(true);
    try {
      const payload = {
        type,
        message: message || null,
        driverLocation: driverPos ? { lat: driverPos[0], lng: driverPos[1] } : null,
        timestamp: new Date().toISOString(),
      };
      await submitDriverEmergency(selected.id, payload);
    } finally {
      setEmBusy(false);
    }
  }

  if (loading) {
    return <div className="drvInlineNotice">Loading assigned orders…</div>;
  }

  if (!activeDeliveries.length) {
    return (
      <div className="drvCard drvCardPad">
        <div className="drvCardHeader">
          <div>
            <p className="drvTitle">No Active Deliveries</p>
            <p className="drvSub">You don’t have any assigned orders right now.</p>
          </div>
          <span className="drvPill drvPill--offline">Idle</span>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="drvCard drvCardPad">
        <p className="drvTitle">Select a delivery</p>
        <p className="drvSub">Choose an assigned order to view mission details.</p>
      </div>
    );
  }

  return (
    <div className="drvAssignedPage">
      {geoErr ? (
        <div className="drvCard drvCardPad" style={{ borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.06)", marginBottom: 12 }}>
          <p className="drvTitle" style={{ color: "#7c2d12" }}>Location permission needed to compute distance</p>
          <p className="drvSub" style={{ color: "#7c2d12" }}>{geoErr}</p>
        </div>
      ) : null}

      {/* Header block - keep width inside frame */}
      <div className="drvAssignedHeader">
        <div className="drvAssignedTitle">
          <h2>Assigned</h2>
          <p>Active mission</p>
        </div>
        <span className="drvCount">{activeDeliveries.length}</span>
      </div>

      {/* Swipe carousel (real mobile) */}
      {activeDeliveries.length > 1 && (
        <div className="drvHScroll" ref={stripRef} aria-label="Assigned orders carousel">
          <div className="drvOrderStrip">
            {activeDeliveries.map((d) => {
              const isSelected = d.id === selectedId;
              const status = normalizeStatus(d.status);
              const dist = Number.isFinite(d?._pickupDistanceKm) ? d._pickupDistanceKm : Infinity;
              const distLabel = Number.isFinite(dist) ? `${dist.toFixed(1)} km away` : "—";

              return (
                <button
                  key={d.id}
                  type="button"
                  data-order-id={d.id}
                  className={`drvOrderChip ${isSelected ? "isSelected" : ""}`}
                  onClick={() => setSelectedId(d.id)}
                >
                  <div className="drvOrderChipTop">
                    <strong>#{d.id}</strong>
                    <span className="drvPill drvPill--info">{status}</span>
                  </div>

                  <div className="drvOrderChipRoute">
                    <span title={d.pickup_address || ""}>{d.pickup_address || "—"}</span>
                    <span className="drvOrderChipArrow">→</span>
                    <span title={d.dropoff_address || ""}>{d.dropoff_address || "—"}</span>
                  </div>

                  <div className="drvOrderChipHint">Pickup: {distLabel}</div>

                  <div className="drvOrderChipHint" style={{ marginTop: 4 }}>
                    {isSelected ? "Viewing" : "Tap to view"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mission content (supports gesture swipe switch too) */}
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <StepProgress status={selected.status} />

        {/* Map hero */}
        <div className="drvMapWrap drvMapWrap--hero">
          <div className="drvMap drvMap--tall">
            <MapContainer
              center={pickup || dropoff || driverPos || [10.3157, 123.8854]}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <FitBounds points={mapPoints} />

              {pickup && <Marker position={pickup} />}
              {dropoff && <Marker position={dropoff} />}
              {pickup && dropoff && <Polyline positions={[pickup, dropoff]} />}
              {driverPos && <Marker position={driverPos} />}
            </MapContainer>

            {/* Overlay chips */}
            <div className="drvMapOverlay">
              {eta ? (
                <>
                  <div className="drvOverlayChip">
                    <span>ETA</span>
                    <strong>{eta.minutes} min</strong>
                  </div>
                  <div className="drvOverlayChip">
                    <span>Distance</span>
                    <strong>{eta.km} km</strong>
                  </div>
                </>
              ) : (
                <div className="drvOverlayChip">
                  <span>{geoErr ? geoErr : "Getting ETA…"}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="drvStack" style={{ marginTop: 12 }}>
          <div className="drvCard drvCardPad">
            <div className="drvCardHeader">
              <div>
                <p className="drvTitle">Delivery #{selected.id}</p>
                <p className="drvSub">{normalizeStatus(selected.status)}</p>
              </div>
              <span className="drvPill drvPill--info">{normalizeStatus(selected.status)}</span>
            </div>

            <div className="drvInfoGrid">
              <div className="drvInfoItem">
                <span>Pickup: </span>
                <strong>{selected.pickup_address || "—"}</strong>
              </div>
              <div className="drvInfoItem">
                <span>Drop-off: </span>
                <strong>{selected.dropoff_address || "—"}</strong>
              </div>
              <div className="drvInfoItem">
                <span>Pickup distance</span>
                <strong>{pickupDistanceLabel}</strong>
              </div>
              {geoUpdatedLabel ? (
                <div className="drvInfoItem">
                  <span>Location</span>
                  <strong>{geoUpdatedLabel}</strong>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="drvBtn drvBtn--ghost drvBtn--full"
              onClick={openGoogleMaps}
              disabled={!target}
            >
              Navigate in Google Maps
            </button>

            <button
              type="button"
              className="drvBtn drvBtn--danger drvBtn--full"
              onClick={() => {
                setFailErr("");
                setFailOpen(true);
              }}
              disabled={busy}
              style={{ marginTop: 10 }}
            >
              Report Issue / Fail Delivery
            </button>

            <button
              type="button"
              className="drvBtn drvBtn--danger drvBtn--full"
              onClick={() => setEmOpen(true)}
              disabled={busy}
              style={{ marginTop: 10 }}
            >
              Emergency Update
            </button>
          </div>

          <div className="drvCard drvCardPad">
            <div className="drvCardHeader">
              <div>
                <p className="drvTitle">Customer</p>
                <p className="drvSub">Contact & details</p>
              </div>
            </div>

            <div className="drvInfoGrid">
              <div className="drvInfoItem">
                <span>Name</span>
                <strong>{selected.customer_name || "—"}</strong>
              </div>
              <div className="drvInfoItem">
                <span>Contact</span>
                <strong>{selected.customer_contact || "—"}</strong>
              </div>
            </div>

            <a
              className={`drvBtn drvBtn--primary drvBtn--full ${selected.customer_contact ? "" : "isDisabled"}`}
              href={selected.customer_contact ? `tel:${String(selected.customer_contact).trim()}` : undefined}
              onClick={(e) => {
                if (!selected.customer_contact) e.preventDefault();
              }}
              aria-disabled={!selected.customer_contact}
              style={{ marginTop: 10, textDecoration: "none" }}
              title={selected.customer_contact ? "Call customer" : "Customer phone missing"}
            >
              Call Customer
            </a>
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="drvActionBar">
        <div className="drvActionRow">
          <button className="drvBtn drvBtn--primary drvBtn--full" onClick={onPrimaryAction} disabled={busy}>
            {busy ? "Updating…" : primaryLabel(selected.status)}
          </button>

          <button className="drvBtn drvBtn--ghost drvBtn--full" onClick={openGoogleMaps} disabled={!target}>
            Navigate
          </button>
        </div>

        {activeDeliveries.length > 1 && <div className="drvSwipeHint">Swipe to switch orders</div>}
      </div>

      {/* POD Modal */}
      {podOpen && (
        <div className="drvModalBackdrop" role="dialog" aria-modal="true">
          <div className="drvModal">
            <div className="drvModalHeader">
              <h3>Complete Delivery</h3>
              <button className="drvModalClose" onClick={() => setPodOpen(false)} type="button" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="drvField">
              <label>Recipient Name *</label>
              <input
                value={podRecipient}
                onChange={(e) => setPodRecipient(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
              />
            </div>

            <div className="drvField">
              <label>Proof Photo *</label>
              <button type="button" className="drvBtn drvBtn--ghost drvBtn--full" onClick={() => setPhotoOpen(true)}>
                {podPhoto ? "Retake Photo" : "Take Customer Photo"}
              </button>
              {podPhoto ? <p className="drvSub" style={{ marginTop: 8 }}>Photo captured: {podPhoto.name}</p> : null}
            </div>

            <div className="drvField">
              <label>Signature (optional)</label>
              <button type="button" className="drvBtn drvBtn--ghost drvBtn--full" onClick={() => setSigOpen(true)}>
                {podSigDataUrl ? "Re-capture Signature" : "Capture Signature"}
              </button>
              {podSigDataUrl ? <p className="drvSub" style={{ marginTop: 8 }}>Signature captured ✔</p> : null}
            </div>

            <div className="drvField">
              <label>Note (optional)</label>
              <textarea rows={3} value={podNote} onChange={(e) => setPodNote(e.target.value)} placeholder="Add a note…" />
            </div>

            {podErr && <div className="drvFormError">{podErr}</div>}

            <button className="drvBtn drvBtn--primary drvBtn--full" onClick={submitPOD} disabled={busy}>
              {busy ? "Submitting…" : "Submit POD & Mark Delivered"}
            </button>
          </div>
        </div>
      )}

      {/* Fail Modal */}
      {failOpen && (
        <div className="drvModalBackdrop" role="dialog" aria-modal="true">
          <div className="drvModal">
            <div className="drvModalHeader">
              <h3>Report Issue</h3>
              <button className="drvModalClose" onClick={() => setFailOpen(false)} type="button" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="drvField">
              <label>Reason *</label>
              <select value={failReason} onChange={(e) => setFailReason(e.target.value)}>
                <option value="CUSTOMER_UNAVAILABLE">Customer unavailable</option>
                <option value="WRONG_ADDRESS">Wrong address</option>
                <option value="PACKAGE_DAMAGED">Package damaged</option>
                <option value="REFUSED_BY_CUSTOMER">Refused by customer</option>
                <option value="NO_CONTACT">No contact</option>
                <option value="RETURNED_TO_SENDER">Returned to sender</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="drvField">
              <label>Notes (optional)</label>
              <textarea
                rows={3}
                value={failNotes}
                onChange={(e) => setFailNotes(e.target.value)}
                placeholder="Describe what happened…"
              />
            </div>

            <div className="drvField">
              <label>Photo (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => setFailPhoto(e.target.files?.[0] || null)} />
            </div>

            {failErr && <div className="drvFormError">{failErr}</div>}

            <button className="drvBtn drvBtn--danger drvBtn--full" onClick={submitFail} disabled={busy}>
              {busy ? "Submitting…" : "Submit Failure Report"}
            </button>
          </div>
        </div>
      )}

      <SignatureModal open={sigOpen} onClose={() => setSigOpen(false)} onSave={(d) => setPodSigDataUrl(d)} />
      <PhotoCaptureModal open={photoOpen} onClose={() => setPhotoOpen(false)} onSave={(f) => setPodPhoto(f)} />
      <EmergencyModal open={emOpen} onClose={() => setEmOpen(false)} onSubmit={submitEmergency} busy={emBusy} />
    </div>
  );
}