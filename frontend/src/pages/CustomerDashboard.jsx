import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

// Map
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import "../styles/customer-dashboard.css";

// Fix default marker icon paths (important for Vite/React builds)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL(
    "leaflet/dist/images/marker-icon-2x.png",
    import.meta.url
  ).toString(),
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
});

// Custom colored markers (simple + readable)
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

const driverIcon = new L.DivIcon({
  className: "marker driver-marker",
  html: `<div class="pin pin-driver">🚚</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

/**
 * FitBoundsOnTrack (Polish)
 * - When followKey changes (meaning user tracked a new ref or switched delivery),
 *   we fit map bounds to show pickup + dropoff + driver if available.
 * - This solves: "customer manually finds marker"
 */
function FitBoundsOnTrack({ pickup, dropoff, driverLoc, fitKey }) {
  const map = useMap();

  useEffect(() => {
    const pts = [];

    if (pickup?.lat && pickup?.lng) pts.push([pickup.lat, pickup.lng]);
    if (dropoff?.lat && dropoff?.lng) pts.push([dropoff.lat, dropoff.lng]);
    if (driverLoc?.lat && driverLoc?.lng) pts.push([driverLoc.lat, driverLoc.lng]);

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
  }, [fitKey, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, driverLoc?.lat, driverLoc?.lng, map]);

  return null;
}

/**
 * FollowDriver (Mode A)
 * - Auto-pans to driver's live location whenever it updates
 * - Stops auto-follow if user drags/zooms the map (so it doesn't fight the user)
 */
function FollowDriver({ driverLoc, follow, followKey }) {
  const map = useMap();
  const [userMoved, setUserMoved] = useState(false);

  // Reset "user moved" whenever a new delivery is selected/tracked OR followKey changes
  useEffect(() => {
    setUserMoved(false);
  }, [followKey]);

  // detect when user manually pans/zooms
  useEffect(() => {
    function onUserMove() {
      setUserMoved(true);
    }

    map.on("dragstart", onUserMove);
    map.on("zoomstart", onUserMove);

    return () => {
      map.off("dragstart", onUserMove);
      map.off("zoomstart", onUserMove);
    };
  }, [map]);

  // follow driver location updates
  useEffect(() => {
    if (!follow) return;
    if (userMoved) return;
    if (!driverLoc?.lat || !driverLoc?.lng) return;

    map.flyTo([driverLoc.lat, driverLoc.lng], Math.max(map.getZoom(), 15), {
      duration: 1.0,
    });
  }, [driverLoc?.lat, driverLoc?.lng, follow, userMoved, followKey, map]);

  return null;
}

function normalizeStatus(s) {
  return String(s || "").toLowerCase();
}

export default function CustomerDashboard() {
  const nav = useNavigate();

  const [me, setMe] = useState(null);
  const [bootErr, setBootErr] = useState("");
  const [booting, setBooting] = useState(true);

  const [refInput, setRefInput] = useState("");
  const [tracked, setTracked] = useState([]);
  const [activeRef, setActiveRef] = useState("");
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [trackErr, setTrackErr] = useState("");

  // Follow mode (Mode A)
  const [follow, setFollow] = useState(true);

  // used to reset follow + trigger fit-bounds on each select/track
  const [followKey, setFollowKey] = useState(0);

  // feedback
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [savingFb, setSavingFb] = useState(false);

  // boot: ensure CUSTOMER
  useEffect(() => {
    async function loadMe() {
      try {
        const res = await api.get("/auth/me");
        setMe(res.data);

        if (res.data.role !== "CUSTOMER") {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          nav("/login");
        }
      } catch (e) {
        setBootErr("Session expired. Please login again.");
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        nav("/login");
      } finally {
        setBooting(false);
      }
    }
    loadMe();
  }, [nav]);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    nav("/login");
  }

  function resetFocusForNewTracking() {
    // re-enable follow and also trigger fitbounds + follow reset
    setFollow(true);
    setFollowKey((k) => k + 1);
  }

  async function trackByRef(ref) {
    const r = String(ref || "").trim();
    if (!r) return;

    setTrackErr("");
    try {
      const { data } = await api.get(
        `/deliveries/track?ref=${encodeURIComponent(r)}`
      );

      setTracked((prev) => {
        const exists = prev.some(
          (x) => x.reference_no === data.delivery.reference_no
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            id: data.delivery.id,
            reference_no: data.delivery.reference_no,
            status: data.delivery.status,
            delivery_date: data.delivery.delivery_date,
          },
        ];
      });

      setActiveRef(data.delivery.reference_no);
      setDetail(data);

      setRating(0);
      setComment("");

      // ✅ triggers auto-fit + follow reset
      resetFocusForNewTracking();
    } catch (e) {
      // ✅ show real backend error (so "Server error" becomes actionable)
      const msg = e?.response?.data?.message || "Reference number not found.";
      const extra = e?.response?.data?.error;
      setTrackErr(extra ? `${msg} (${extra})` : msg);
    }
  }

  async function loadDetail(ref) {
    setLoadingDetail(true);
    try {
      const { data } = await api.get(
        `/deliveries/track?ref=${encodeURIComponent(ref)}`
      );
      setDetail(data);
    } catch {
      // keep last known detail
    } finally {
      setLoadingDetail(false);
    }
  }

  // polling active delivery (real-time feel)
  useEffect(() => {
    if (!activeRef) return;
    const t = setInterval(() => loadDetail(activeRef), 8000);
    return () => clearInterval(t);
  }, [activeRef]);

  const mapCenter = useMemo(() => {
    const dl = detail?.driver_location;
    if (dl?.lat && dl?.lng) return [dl.lat, dl.lng];
    return [9.65, 123.85];
  }, [detail]);

  const showFeedback = detail?.delivery?.status === "DELIVERED";

  async function submitFeedback() {
    if (!detail?.delivery?.id) return;
    if (rating < 1) return alert("Please select a rating (1–5).");

    setSavingFb(true);
    try {
      await api.post(`/deliveries/${detail.delivery.id}/feedback`, {
        rating,
        comment,
      });
      alert("Thanks! Your feedback was submitted.");
    } catch (e) {
      alert(e?.response?.data?.message || "Could not submit feedback.");
    } finally {
      setSavingFb(false);
    }
  }

  if (booting) return <div style={{ padding: 16 }}>Loading…</div>;
  if (bootErr)
    return <div style={{ padding: 16, color: "#b91c1c" }}>{bootErr}</div>;

  return (
    <div className="customer-shell">
      <div className="customer-grid">
        {/* LEFT: Tracking list */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="title">Customer Tracking</div>
              <div className="muted">
                {me?.email ? `Logged in as ${me.email}` : "Logged in"}
              </div>
            </div>
            <button className="logout-btn" onClick={logout}>
              Logout
            </button>
          </div>

          <div className="track-row">
            <input
              placeholder="Enter reference (e.g., ORD-2026xxxxxx)"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && trackByRef(refInput)}
            />
            <button onClick={() => trackByRef(refInput)}>Track</button>
          </div>

          {trackErr ? (
            <div
              style={{
                padding: "0 14px 10px 14px",
                color: "#b91c1c",
                fontWeight: 800,
              }}
            >
              {trackErr}
            </div>
          ) : null}

          <div className="list">
            {tracked.length === 0 ? (
              <div style={{ padding: 14, color: "#6b7280", fontSize: 13 }}>
                Add a reference number to start tracking.
              </div>
            ) : (
              tracked.map((d) => (
                <div
                  key={d.reference_no}
                  className="item"
                  onClick={() => {
                    setActiveRef(d.reference_no);
                    loadDetail(d.reference_no);
                    // ✅ triggers auto-fit + follow reset when selecting from list
                    resetFocusForNewTracking();
                  }}
                  style={{
                    outline:
                      activeRef === d.reference_no
                        ? "2px solid rgba(255,107,0,0.35)"
                        : "none",
                  }}
                >
                  <div className="ref">
                    {d.reference_no}
                    <span className={`status ${normalizeStatus(d.status)}`}>
                      {d.status}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                    ETA:{" "}
                    {d.delivery_date
                      ? new Date(d.delivery_date).toLocaleString()
                      : "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Map + details */}
        <div className="mapWrap">
          <div className="panel mapCard">
            <div className="panel-header">
              <div>
                <div className="title">Live Driver Location</div>
                <div className="muted">
                  {activeRef
                    ? `Tracking: ${activeRef}`
                    : "No active delivery selected"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {loadingDetail ? <span className="badge">Updating…</span> : null}

                <button
                  className={`follow-btn ${follow ? "on" : "off"}`}
                  onClick={() => {
                    setFollow((v) => {
                      const next = !v;
                      if (!v) setFollowKey((k) => k + 1); // turning ON => allow follow + refocus
                      return next;
                    });
                  }}
                  title={
                    follow
                      ? "Following driver. Drag/zoom map to stop following."
                      : "Enable auto-follow"
                  }
                >
                  {follow ? "Following" : "Follow Driver"}
                </button>
              </div>
            </div>

            <div className="mapViewport">
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {/* ✅ Auto-fit bounds when tracking/switching */}
                <FitBoundsOnTrack
                  pickup={detail?.pickup}
                  dropoff={detail?.dropoff}
                  driverLoc={detail?.driver_location}
                  fitKey={followKey}
                />

                {/* ✅ Auto-follow driver updates */}
                <FollowDriver
                  driverLoc={detail?.driver_location}
                  follow={follow}
                  followKey={followKey}
                />

                {/* Pickup */}
                {detail?.pickup?.lat && detail?.pickup?.lng ? (
                  <Marker
                    position={[detail.pickup.lat, detail.pickup.lng]}
                    icon={pickupIcon}
                  >
                    <Tooltip
                      direction="top"
                      offset={[0, -10]}
                      opacity={1}
                      permanent
                    >
                      Pickup
                    </Tooltip>
                  </Marker>
                ) : null}

                {/* Drop-off */}
                {detail?.dropoff?.lat && detail?.dropoff?.lng ? (
                  <Marker
                    position={[detail.dropoff.lat, detail.dropoff.lng]}
                    icon={dropoffIcon}
                  >
                    <Tooltip
                      direction="top"
                      offset={[0, -10]}
                      opacity={1}
                      permanent
                    >
                      Drop-off
                    </Tooltip>
                  </Marker>
                ) : null}

                {/* Driver */}
                {detail?.driver_location?.lat && detail?.driver_location?.lng ? (
                  <Marker
                    position={[
                      detail.driver_location.lat,
                      detail.driver_location.lng,
                    ]}
                    icon={driverIcon}
                  >
                    <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                      {detail?.driver?.name
                        ? `Driver: ${detail.driver.name}`
                        : "Driver"}
                    </Tooltip>
                  </Marker>
                ) : null}

                {/* Route */}
                {Array.isArray(detail?.route) && detail.route.length >= 2 ? (
                  <Polyline positions={detail.route} />
                ) : null}
              </MapContainer>
            </div>

            <div className="mapMeta">
              <div className="metaRow">
                <b>Status:</b> <span>{detail?.delivery?.status || "—"}</span>
              </div>
              <div className="metaRow">
                <b>Driver:</b> <span>{detail?.driver?.name || "—"}</span>
              </div>
              <div className="metaRow">
                <b>ETA:</b>{" "}
                <span>
                  {detail?.delivery?.delivery_date
                    ? new Date(detail.delivery.delivery_date).toLocaleString()
                    : "—"}
                </span>
              </div>
              <div className="metaRow">
                <b>Last location:</b>{" "}
                <span>
                  {detail?.driver_location?.updated_at
                    ? new Date(detail.driver_location.updated_at).toLocaleString()
                    : "—"}
                </span>
              </div>
            </div>

            {showFeedback ? (
              <div className="feedback">
                <div style={{ fontWeight: 900 }}>Rate your delivery</div>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={rating >= s ? "active" : ""}
                      onClick={() => setRating(s)}
                      title={`${s} star`}
                    >
                      ★
                    </span>
                  ))}
                </div>

                <textarea
                  placeholder="Optional feedback / issue report (short)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />

                <button disabled={savingFb} onClick={submitFeedback}>
                  {savingFb ? "Submitting…" : "Submit Feedback"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
