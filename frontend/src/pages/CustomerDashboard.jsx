import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

// Map (Tracking modal)
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

import "../styles/fastpass-dashboard.css";
import "../styles/fastpass-dispatcher-shell.css";
import "../styles/dispatcher-overview.css";

import Icon from "../components/dispatcher/Icons";
import { statusChipStyle } from "../components/dispatcher/statusChipStyle";

// Fix default marker icon paths (important for Vite/React builds)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
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

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const ini = parts.map((p) => p[0] || "").join("");
  return (ini || "U").toUpperCase();
}

function roleLabel(raw) {
  const r = String(raw || "").toUpperCase();
  if (r === "CUSTOMER") return "Customer";
  return r ? r[0] + r.slice(1).toLowerCase() : "Customer";
}

function safeText(v, fallback = "—") {
  if (v === null || v === undefined) return fallback;
  const s = typeof v === "string" ? v.trim() : String(v);
  return s ? s : fallback;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function shortAddr(addr) {
  const s = String(addr || "").trim();
  if (!s) return "—";
  if (s.length <= 32) return s;
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const tail = parts.slice(-2).join(", ");
    if (tail.length <= 34) return tail;
  }
  return s.slice(0, 32).trim() + "…";
}

function customerRefsKey(userId) {
  return `fp_customer_refs_${userId || "me"}`;
}

function readSavedRefs(userId) {
  try {
    const raw = localStorage.getItem(customerRefsKey(userId)) || "[]";
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function writeSavedRefs(userId, refs) {
  try {
    const uniq = Array.from(
      new Set((refs || []).map((r) => String(r).trim()).filter(Boolean)),
    );
    localStorage.setItem(customerRefsKey(userId), JSON.stringify(uniq));
  } catch {
    // ignore
  }
}

function ViewButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      className={["fps-navItem", active ? "is-active" : ""].filter(Boolean).join(" ")}
      onClick={onClick}
    >
      <span className="fps-navIcon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      {label}
    </button>
  );
}

function DotsProgress({ step = 1, labels = ["Origin", "In Transit", "Delivered"] }) {
  const active = Math.max(0, Math.min(2, Number(step || 0)));
  return (
    <div className="fp-stack" style={{ gap: 10 }}>
      <div className="fp-row" style={{ alignItems: "center", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="fp-row"
            style={{ alignItems: "center", flex: 1, gap: 10 }}
          >
            <div
              className="fp-pill"
              style={{
                width: 14,
                height: 14,
                padding: 0,
                borderRadius: 999,
                background: i <= active ? "rgba(0,112,255,0.95)" : "rgba(15,23,42,0.12)",
              }}
              aria-hidden="true"
            />
            {i < 2 ? (
              <div
                style={{
                  height: 4,
                  borderRadius: 999,
                  background: i < active ? "rgba(0,112,255,0.95)" : "rgba(15,23,42,0.10)",
                  flex: 1,
                }}
                aria-hidden="true"
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="fp-row" style={{ justifyContent: "space-between", gap: 10 }}>
        {labels.map((l, idx) => (
          <div
            key={l}
            className="fp-muted"
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: idx <= active ? "rgba(0,112,255,0.95)" : "rgba(100,116,139,0.85)",
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function Modal({ open, title, subtitle, onClose, children, busy = false }) {
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  if (!open) return null;

  function requestClose() {
    if (busy) return;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      onClose?.();
    }, 170);
  }

  return (
    <div
      className={
        "fpPr-modalOverlay fpPr-modalOverlay--premium" +
        (closing ? " fpPr-modalOverlay--closing" : "")
      }
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className={"fpPr-modal fpPr-modal--premium" + (closing ? " fpPr-modal--closing" : "")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="fpPr-modalHead fpPr-modalHead--premium">
          <div className="fpPr-modalTitleBlock">
            <div className="fpPr-modalTitle">{title}</div>
            {subtitle ? <div className="fpPr-modalSubtitle">{subtitle}</div> : null}
          </div>

          <button
            type="button"
            className="fpOv-btnIcon"
            onClick={requestClose}
            aria-label="Close"
            title="Close"
            disabled={busy}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="fpPr-modalDivider" />
        <div className="fpPr-modalBody fpPr-modalBody--premium">{children}</div>
      </div>
    </div>
  );
}

/**
 * FitBoundsOnTrack (Polish)
 * - When followKey changes (meaning user tracked a new ref or switched delivery),
 *   we fit map bounds to show pickup + dropoff + driver if available.
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
  }, [
    fitKey,
    pickup?.lat,
    pickup?.lng,
    dropoff?.lat,
    dropoff?.lng,
    driverLoc?.lat,
    driverLoc?.lng,
    map,
  ]);

  return null;
}

/**
 * FollowDriver (Mode A)
 * - Auto-pans to driver's live location whenever it updates
 * - Stops auto-follow if user drags/zooms the map
 */
function FollowDriver({ driverLoc, follow, followKey }) {
  const map = useMap();
  const [userMoved, setUserMoved] = useState(false);

  useEffect(() => {
    setUserMoved(false);
  }, [followKey]);

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

  useEffect(() => {
    if (!follow) return;
    if (userMoved) return;
    if (!driverLoc?.lat || !driverLoc?.lng) return;

    map.flyTo([driverLoc.lat, driverLoc.lng], Math.max(map.getZoom(), 15), {
      duration: 0.8,
    });
  }, [driverLoc?.lat, driverLoc?.lng, follow, userMoved, map]);

  return null;
}

export default function CustomerDashboard() {
  const nav = useNavigate();

  const [me, setMe] = useState(null);
  const [bootErr, setBootErr] = useState("");
  const [booting, setBooting] = useState(true);

  const [view, setView] = useState("home");

  const [flash, setFlash] = useState("");
  const [flashTone, setFlashTone] = useState("success");
  const flashTimer = useRef(null);

  // Orders list
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersErr, setOrdersErr] = useState("");

// Live updates (Emergency)
const [liveUpdates, setLiveUpdates] = useState([]);
const [liveLoading, setLiveLoading] = useState(false);
const [liveErr, setLiveErr] = useState("");
const [liveTick, setLiveTick] = useState(0);

  // Add order modal
  const [addOpen, setAddOpen] = useState(false);
  const [addRef, setAddRef] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState("");

  // Tracking modal
  const [trackOpen, setTrackOpen] = useState(false);
  const [activeRef, setActiveRef] = useState("");
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [trackErr, setTrackErr] = useState("");

  // Feedback
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [savingFb, setSavingFb] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  // Follow mode + auto-fit key
  const [follow, setFollow] = useState(true);
  const [followKey, setFollowKey] = useState(0);

  function showFlash(message, tone = "success") {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashTone(tone);
    setFlash(message);
    flashTimer.current = setTimeout(() => setFlash(""), 2600);
  }

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await api.get("/auth/me");
        setMe(res.data);
      } catch (e) {
        setBootErr(e?.response?.data?.message || "Failed to load user");
      } finally {
        setBooting(false);
      }
    }
    loadMe();
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    nav("/login");
  }

  function resetFocusForNewTracking() {
    setFollow(true);
    setFollowKey((k) => k + 1);
  }

  // Map center
  const mapCenter = useMemo(() => {
    if (detail?.pickup?.lat && detail?.pickup?.lng) return [detail.pickup.lat, detail.pickup.lng];
    return [9.65, 123.85];
  }, [detail]);

  const showFeedback =
    detail?.delivery?.status === "DELIVERED" &&
    detail?.feedbackAllowed !== false; // allow backend override if present

  function clearPhoto() {
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview("");
  }

  function onPickPhoto(e) {
    const f = e?.target?.files?.[0];
    if (!f) return;
    clearPhoto();
    setPhoto(f);
    const url = URL.createObjectURL(f);
    setPhotoPreview(url);
  }

  async function submitFeedback() {
    if (!detail?.delivery?.id) return;
    if (!rating) {
      showFlash("Please select a rating.", "error");
      return;
    }

    setSavingFb(true);
    try {
      const fd = new FormData();
      fd.append("delivery_id", String(detail.delivery.id));
      fd.append("rating", String(rating));
      fd.append("comment", String(comment || ""));
      if (photo) fd.append("photo", photo);

      await api.post("/deliveries/feedback", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      showFlash("Feedback submitted. Thank you!", "success");
      setRating(0);
      setComment("");
      clearPhoto();
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to submit feedback";
      const extra = e?.response?.data?.error;
      showFlash(extra ? `${msg} (${extra})` : msg, "error");
    } finally {
      setSavingFb(false);
    }
  }

  async function loadDetail(ref) {
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/deliveries/track?ref=${encodeURIComponent(ref)}`);
      setDetail(data);
    } catch {
      // keep last known detail
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    if (!trackOpen) return;
    if (!activeRef) return;
    const t = setInterval(() => loadDetail(activeRef), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackOpen, activeRef]);

  async function trackByRef(ref) {
    const r = String(ref || "").trim();
    if (!r) return;

    setTrackErr("");
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/deliveries/track?ref=${encodeURIComponent(r)}`);
      setActiveRef(data?.delivery?.reference_no || r);
      setDetail(data);
      setTrackOpen(true);
      resetFocusForNewTracking();
    } catch (e) {
      const msg = e?.response?.data?.message || "Reference number not found.";
      const extra = e?.response?.data?.error;
      setTrackErr(extra ? `${msg} (${extra})` : msg);
      setActiveRef(r);
      setDetail(null);
      setTrackOpen(true);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function fetchOrderSummary(referenceNo) {
    const r = String(referenceNo || "").trim();
    if (!r) return null;
    try {
      const { data } = await api.get(`/deliveries/track?ref=${encodeURIComponent(r)}`);
      const del = data?.delivery;
      if (!del?.reference_no) return null;

      return {
        reference_no: del.reference_no,
        status: del.status,
        created_at: del.created_at,
        pickup_address: del.pickup_address,
        dropoff_address: del.dropoff_address,
        delivery_date: del.delivery_date,
      };
    } catch {
      return {
        reference_no: r,
        status: "UNKNOWN",
        created_at: null,
        pickup_address: "—",
        dropoff_address: "—",
        delivery_date: null,
      };
    }
  }

  async function loadOrders() {
    if (!me?.id) return;
    setOrdersLoading(true);
    setOrdersErr("");
    try {
      const refs = readSavedRefs(me.id);
      if (refs.length === 0) {
        setOrders([]);
        return;
      }

      const summaries = await Promise.all(refs.map((r) => fetchOrderSummary(r)));
      const cleaned = (summaries || []).filter(Boolean);
      cleaned.sort((a, b) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
      setOrders(cleaned);
    } catch (e) {
      setOrdersErr(e?.response?.data?.message || e.message || "Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  }

function minsAgoLabel(iso) {
  if (!iso) return "—";
  const tt = new Date(iso).getTime();
  if (Number.isNaN(tt)) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - tt) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

async function loadLiveUpdates() {
  if (!me?.id) return;
  setLiveLoading(true);
  setLiveErr("");
  try {
    const refs = readSavedRefs(me.id);
    if (refs.length === 0) {
      setLiveUpdates([]);
      return;
    }

    const res = await api.get("/notifications/customer", {
      params: { limit: 80, refs: refs.join(",") },
    });

    const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];
    const emergency = rows.filter(
      (n) => String(n?.subtype || "").toUpperCase() === "EMERGENCY",
    );
    setLiveUpdates(emergency);
  } catch (e) {
    setLiveErr(
      e?.response?.data?.message || e.message || "Failed to load live updates",
    );
  } finally {
    setLiveLoading(false);
  }
}

  useEffect(() => {
    if (!me?.id) return;
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);
useEffect(() => {
  if (!me?.id) return;
  loadLiveUpdates();
  const tt = setInterval(loadLiveUpdates, 15000);
  return () => clearInterval(tt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [me?.id, liveTick]);



  async function addOrderByReference(referenceNumber) {
    const ref = String(referenceNumber || "").trim();
    if (!ref) return;

    setAddBusy(true);
    setAddErr("");
    try {
      // Prefer a dedicated customer endpoint if present.
      // If not available in this project, we fall back to /deliveries/track.
      try {
        await api.post("/customer/orders/add", { referenceNumber: ref });
      } catch (e) {
        const status = e?.response?.status;
        if (status && status !== 404 && status !== 405) throw e;
        await api.get(`/deliveries/track?ref=${encodeURIComponent(ref)}`);
      }

      const nextRefs = Array.from(new Set([...readSavedRefs(me?.id), ref]));
      writeSavedRefs(me?.id, nextRefs);
      await loadOrders();
      await loadLiveUpdates();

      showFlash("Order added successfully.", "success");
      setAddOpen(false);
      setAddRef("");
      setAddErr("");
    } catch (e) {
      const msg = e?.response?.data?.message || "Invalid reference number.";
      const extra = e?.response?.data?.error;
      setAddErr(extra ? `${msg} (${extra})` : msg);
      showFlash("Could not add order.", "error");
    } finally {
      setAddBusy(false);
    }
  }

  if (booting) return <div style={{ padding: 16 }}>Loading…</div>;
  if (bootErr) return <div style={{ padding: 16, color: "#b91c1c" }}>{bootErr}</div>;

  const name = me?.name || localStorage.getItem("name") || "Customer";
  const email = me?.email || localStorage.getItem("email") || "";
  const role = me?.role || localStorage.getItem("role") || "CUSTOMER";
  const ini = initialsFromName(name);

  const allOrders = orders || [];
  const activeOrders = allOrders.filter(
    (o) => !["DELIVERED", "FAILED", "CANCELLED"].includes(String(o.status || "").toUpperCase()),
  );
  const recentOrders = allOrders.slice(0, 5);

  function statusStep(s) {
    const up = String(s || "").toUpperCase();
    if (up === "DELIVERED") return 2;
    if (up === "IN_TRANSIT" || up === "IN TRANSIT" || up === "ONGOING" || up === "ON_DELIVERY") return 1;
    if (up === "ASSIGNED" || up === "PENDING" || up === "PICKED_UP") return 0;
    return 1;
  }

  return (
    <div className="fps-shell">
      {/* Sidebar */}
      <aside className="fps-sidebar" aria-label="FastPaSS customer sidebar">
        <div className="fps-brand">
          <div className="fps-brandMark" aria-hidden="true">
            <Icon name="route" size={18} />
          </div>
          <div className="fps-brandText">
            <div className="fps-brandName">
              Fast<span>PaSS</span>
            </div>
            <div className="fps-brandSub">Customer</div>
          </div>
        </div>

        <nav className="fps-nav" aria-label="Customer navigation">
          <ViewButton active={view === "home"} icon="home" label="Home" onClick={() => setView("home")} />
          <ViewButton active={view === "orders"} icon="truck" label="Orders" onClick={() => setView("orders")} />
          <ViewButton active={view === "profile"} icon="user" label="Profile" onClick={() => setView("profile")} />
        </nav>

        <div className="fps-sideSpacer" />

        <div className="fps-sideFooter">
          <ViewButton active={view === "settings"} icon="settings" label="Settings" onClick={() => setView("settings")} />
          <ViewButton
            active={view === "notifications"}
            icon="bell"
            label="Notifications"
            onClick={() => setView("notifications")}
          />

          <div className="fps-userRow">
            <div className="fps-avatar" aria-hidden="true">
              {ini}
            </div>

            <div className="fps-userMeta">
              <div className="fps-userName">{name}</div>
              <div className="fps-userRole">{roleLabel(role)}</div>
            </div>

            <button
              className="fps-logout"
              type="button"
              onClick={logout}
              title="Logout"
              aria-label="Logout"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="fps-main">
        <header className="fps-topbar">
          <div className="fps-topbarLeft" />
          <div className="fps-topbarRight">
            <span className="fps-pill">Customer</span>
            <button
              type="button"
              className="fpOv-btnIcon"
              title="Go to Home"
              aria-label="Home"
              onClick={() => setView("home")}
            >
              <Icon name="home" size={18} />
            </button>
          </div>
        </header>

        <main className="fps-content">
          {flash ? (
            <div
              className={
                "fpPr-alert " +
                (flashTone === "error" ? "fpPr-alert--error" : "fpPr-alert--success")
              }
              aria-live="polite"
            >
              {flash}
            </div>
          ) : null}

          {/* HOME */}
          {view === "home" ? (
            <div className="fpOv-page">
              <div className="fpOv-mainCard">
                <div className="fpOv-tabsRow" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="fpOv-breadcrumb">Home</div>
                    <div className="fpOv-rainbow" />
                  </div>

                  <div>
                    <button
                      type="button"
                      className="fpOv-btnPrimary"
                      onClick={() => {
                        setAddErr("");
                        setAddRef("");
                        setAddOpen(true);
                      }}
                    >
                      <span className="fpOv-btnIcon" aria-hidden="true">
                        <Icon name="plus" size={18} />
                      </span>
                      Add Order
                    </button>
                  </div>
                </div>

                {/* Welcome */}
                <div className="fp-card" style={{ padding: 18, marginTop: 14 }}>
                  <div className="fp-row" style={{ justifyContent: "space-between", gap: 12 }}>
                    <div className="fp-stack" style={{ gap: 6 }}>
                      <div style={{ fontSize: 34, fontWeight: 1100, letterSpacing: -0.6, color: "#0f172a" }}>
                        Welcome, {name.split(" ")[0] || name}!
                      </div>
                      <div className="fp-muted" style={{ fontWeight: 800 }}>
                        Track your shipments with ease.
                      </div>
                    </div>

                    <div className="fp-row" style={{ alignItems: "center", gap: 10 }}>
                      <span className="fps-pill">{roleLabel(role)}</span>
                    </div>
                  </div>
                </div>

                <div className="fpOv-grid2" style={{ marginTop: 14 }}>
                  {/* Active Orders (big) */}
                  <div className="fp-card" style={{ padding: 16 }}>
                    <div
                      className="fp-row"
                      style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}
                    >
                      <div className="fp-row" style={{ alignItems: "center", gap: 10 }}>
                        <span aria-hidden="true">
                          <Icon name="truck" size={18} />
                        </span>
                        <div style={{ fontSize: 16, fontWeight: 1000, color: "#0f172a" }}>
                          Active Orders
                        </div>
                      </div>

                      {ordersLoading ? <span className="fp-muted">Loading…</span> : null}
                    </div>

                    {ordersErr ? (
                      <div className="fpPr-alert fpPr-alert--error" role="alert" style={{ marginTop: 12 }}>
                        {ordersErr}
                      </div>
                    ) : null}

                    {!ordersLoading && activeOrders.length === 0 ? (
                      <div className="fp-muted" style={{ marginTop: 12, fontWeight: 900 }}>
                        No active orders yet. Click <b>Add Order</b> to link a reference number.
                      </div>
                    ) : null}

                    {activeOrders.slice(0, 1).map((o) => (
                      <div key={o.reference_no} className="fp-card" style={{ padding: 16, marginTop: 12 }}>
                        <div
                          className="fp-row"
                          style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}
                        >
                          <div style={{ fontSize: 22, fontWeight: 1100, color: "#0f172a" }}>
                            {o.reference_no}
                          </div>
                          <span className="fpOvD-status" style={statusChipStyle(o.status)}>
                            {o.status}
                          </span>
                        </div>

                        <div
                          className="fp-row"
                          style={{
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            marginTop: 10,
                            fontWeight: 900,
                          }}
                        >
                          <div>{shortAddr(o.pickup_address)}</div>
                          <div className="fp-muted" style={{ fontWeight: 1100 }}>
                            →
                          </div>
                          <div style={{ textAlign: "right" }}>{shortAddr(o.dropoff_address)}</div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <DotsProgress step={statusStep(o.status)} labels={["Origin", "In Transit", "Delivered"]} />
                        </div>

                        <div
                          className="fp-row"
                          style={{
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            marginTop: 12,
                          }}
                        >
                          <div className="fp-muted" style={{ fontWeight: 900 }}>
                            Estimated Arrival: <b style={{ color: "#0f172a" }}>{fmtDate(o.delivery_date)}</b>
                          </div>
                          <button type="button" className="fpOv-btnPrimary" onClick={() => trackByRef(o.reference_no)}>
                            Track Shipment
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right column: Announcements + Need Help */}
                  <div className="fp-stack" style={{ gap: 14 }}>

<div className="fp-card" style={{ padding: 16 }}>
  <div className="fp-row" style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
    <div className="fp-row" style={{ alignItems: "center", gap: 10 }}>
      <span aria-hidden="true">
        <Icon name="alert" size={18} />
      </span>
      <div style={{ fontSize: 16, fontWeight: 1000, color: "#0f172a" }}>Live updates</div>
    </div>

    <div className="fp-row" style={{ gap: 10, alignItems: "center" }}>
      {liveLoading ? <span className="fp-muted" style={{ fontWeight: 900 }}>Refreshing…</span> : null}
      <button type="button" className="fpOv-btnSecondary" onClick={() => setLiveTick((k) => k + 1)}>
        Refresh
      </button>
    </div>
  </div>

  {liveErr ? (
    <div className="fpPr-alert fpPr-alert--error" role="alert" style={{ marginTop: 12 }}>
      {liveErr}
    </div>
  ) : null}

  {!liveLoading && !liveErr && liveUpdates.length === 0 ? (
    <div className="fp-muted" style={{ marginTop: 10, fontWeight: 900 }}>
      No emergency updates yet.
    </div>
  ) : null}

  <div className="fp-stack" style={{ gap: 10, marginTop: 12 }}>
    {liveUpdates.slice(0, 4).map((n) => (
      <div key={n.id} className="fp-card" style={{ padding: 12, border: "1px solid rgba(239,68,68,0.18)" }}>
        <div className="fp-row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 1000, color: "#0f172a" }}>
            {n.reference_no ? n.reference_no : "Emergency update"}
          </div>
          <div className="fp-muted" style={{ fontSize: 12, fontWeight: 900 }}>
            {minsAgoLabel(n.created_at)}
          </div>
        </div>
        <div className="fp-muted" style={{ marginTop: 6, fontWeight: 900, color: "rgba(185,28,28,0.95)" }}>
          {n.title || "Driver emergency update"}
        </div>
        {n.message ? (
          <div className="fp-muted" style={{ marginTop: 4 }}>
            {n.message}
          </div>
        ) : null}
      </div>
    ))}
  </div>

  <div className="fp-row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
    <button type="button" className="fpOv-btnPrimary" onClick={() => setView("notifications")}>
      View all
    </button>
  </div>
</div>

                    <div className="fp-card" style={{ padding: 16 }}>
                      <div style={{ fontSize: 16, fontWeight: 1000, color: "#0f172a" }}>Announcements</div>
                      <div className="fp-muted" style={{ marginTop: 10, fontWeight: 900 }}>
                        Limited-time offer!
                      </div>
                      <div className="fp-muted" style={{ marginTop: 6 }}>
                        Get 20% off on your next delivery with code <b>FAST20</b>.
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <button type="button" className="fpOv-btnSecondary">
                          Apply Code
                        </button>
                      </div>
                    </div>

                    <div className="fp-card" style={{ padding: 16 }}>
                      <div style={{ fontSize: 16, fontWeight: 1000, color: "#0f172a" }}>Need Help?</div>
                      <div className="fp-muted" style={{ marginTop: 10 }}>
                        Contact our support team for assistance
                      </div>

                      <div className="fp-muted" style={{ marginTop: 10, fontSize: 12, fontWeight: 900 }}>
                        Business Hours: Monday - Friday, 9:00 AM - 6:00 PM
                      </div>
                      {email ? (
                        <div className="fp-muted" style={{ marginTop: 10, fontSize: 12, fontWeight: 900 }}>
                          Email: <b style={{ color: "#0f172a" }}>{email}</b>
                        </div>
                      ) : null}

                      <div style={{ marginTop: 12 }}>
                        <button type="button" className="fpOv-btnPrimary" onClick={() => setView("notifications")}>
                          Contact Us
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="fp-card" style={{ padding: 16, marginTop: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 1000, color: "#0f172a" }}>Recent Orders</div>

                  {ordersLoading ? (
                    <div className="fp-muted" style={{ marginTop: 12, fontWeight: 900 }}>
                      Loading…
                    </div>
                  ) : recentOrders.length === 0 ? (
                    <div className="fp-muted" style={{ marginTop: 12, fontWeight: 900 }}>
                      No orders yet.
                    </div>
                  ) : (
                    <div className="fp-stack" style={{ gap: 10, marginTop: 12 }}>
                      {recentOrders.map((o) => (
                        <div key={o.reference_no} className="fp-card" style={{ padding: 12 }}>
                          <div
                            className="fp-row"
                            style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}
                          >
                            <div className="fp-stack" style={{ gap: 4 }}>
                              <div style={{ fontWeight: 1000, color: "#0f172a" }}>{o.reference_no}</div>
                              <div className="fp-muted" style={{ fontWeight: 800, fontSize: 12 }}>
                                {shortAddr(o.pickup_address)} → {shortAddr(o.dropoff_address)}
                              </div>
                            </div>
                            <div className="fp-stack" style={{ gap: 6, alignItems: "flex-end" }}>
                              <span className="fpOvD-status" style={statusChipStyle(o.status)}>
                                {o.status}
                              </span>
                              <div className="fp-muted" style={{ fontSize: 11, fontWeight: 900 }}>
                                {fmtDate(o.created_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* ORDERS */}
          {view === "orders" ? (
            <div className="fpOv-page">
              <div className="fpOv-mainCard">
                <div className="fpOv-tabsRow" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="fpOv-breadcrumb">Orders</div>
                    <div className="fpOv-rainbow" />
                  </div>

                  <div className="fp-row" style={{ gap: 10 }}>
                    <button type="button" className="fpOv-btnSecondary" onClick={() => loadOrders()} disabled={ordersLoading}>
                      {ordersLoading ? "Refreshing…" : "Refresh"}
                    </button>
                    <button
                      type="button"
                      className="fpOv-btnPrimary"
                      onClick={() => {
                        setAddErr("");
                        setAddRef("");
                        setAddOpen(true);
                      }}
                    >
                      <span className="fpOv-btnIcon" aria-hidden="true">
                        <Icon name="plus" size={18} />
                      </span>
                      Add Order
                    </button>
                  </div>
                </div>

                {ordersErr ? (
                  <div className="fpPr-alert fpPr-alert--error" role="alert" style={{ marginTop: 12 }}>
                    {ordersErr}
                  </div>
                ) : null}

                <div className="fp-stack" style={{ gap: 12, marginTop: 12 }}>
                  {ordersLoading ? (
                    <div className="fp-muted" style={{ fontWeight: 900 }}>
                      Loading…
                    </div>
                  ) : allOrders.length === 0 ? (
                    <div className="fp-muted" style={{ fontWeight: 900 }}>
                      No orders yet. Click <b>Add Order</b> to link a reference number.
                    </div>
                  ) : (
                    allOrders.map((o) => (
                      <div key={o.reference_no} className="fp-card" style={{ padding: 14 }}>
                        <div className="fp-row" style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div className="fp-stack" style={{ gap: 4 }}>
                            <div style={{ fontWeight: 1100, color: "#0f172a" }}>{o.reference_no}</div>
                            <div className="fp-muted" style={{ fontWeight: 800, fontSize: 12 }}>
                              {shortAddr(o.pickup_address)} → {shortAddr(o.dropoff_address)}
                            </div>
                            <div className="fp-muted" style={{ fontSize: 11, fontWeight: 900 }}>
                              Created: {fmtDate(o.created_at)}
                            </div>
                          </div>

                          <div className="fp-row" style={{ alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <span className="fpOvD-status" style={statusChipStyle(o.status)}>
                              {o.status}
                            </span>
                            <button type="button" className="fpOv-btnPrimary" onClick={() => trackByRef(o.reference_no)}>
                              Track
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* PROFILE */}
          {view === "profile" ? (
            <div className="fpOv-page">
              <div className="fpOv-mainCard">
                <div className="fpOv-breadcrumb">Profile</div>
                <div className="fpOv-rainbow" />

                <div className="fpPr-stack" style={{ marginTop: 12 }}>
                  <section className="fpPr-summary">
                    <div className="fpPr-summaryLeft">
                      <div className="fpPr-summaryRow">
                        <div className="fpPr-avatarWrap fpPr-avatarBtn fpPr-avatarBtn--premium" aria-hidden="true">
                          <span className="fpPr-avatarFallback">{ini}</span>
                        </div>

                        <div className="fpPr-summaryMeta">
                          <div className="fpPr-name">{safeText(name, "Customer")}</div>
                          <div className="fpPr-role">{roleLabel(role)}</div>
                          <div className="fpPr-location">—</div>
                        </div>
                      </div>
                    </div>

                    <div className="fpPr-summaryRight">
                      <button
                        type="button"
                        className="fpOv-btnSecondary"
                        onClick={() => showFlash("Profile editing is not enabled yet.", "error")}
                      >
                        Edit
                      </button>
                    </div>
                  </section>

                  <div className="fp-card" style={{ padding: 16 }}>
                    <div className="fp-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 1100, color: "#0f172a" }}>Personal Information</div>
                    </div>
                    <div className="fpPr-grid2" style={{ marginTop: 12 }}>
                      <div className="fpPr-field">
                        <div className="fpPr-label">Name</div>
                        <div className="fpPr-value">{safeText(name)}</div>
                      </div>
                      <div className="fpPr-field">
                        <div className="fpPr-label">Email</div>
                        <div className="fpPr-value">{safeText(email)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* SETTINGS */}
          {view === "settings" ? (
            <div className="fpOv-page">
              <div className="fpOv-mainCard">
                <div className="fpOv-breadcrumb">Settings</div>
                <div className="fpOv-rainbow" />

                <div className="fp-stack" style={{ gap: 14, marginTop: 12 }}>
                  <div className="fp-card" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 1100, color: "#0f172a" }}>Change password</div>
                    <div className="fp-muted" style={{ marginTop: 8 }}>
                      Use the password reset flow to update your password.
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button type="button" className="fpOv-btnPrimary" onClick={() => nav("/forgot-password")}>
                        Go to Reset Password
                      </button>
                    </div>
                  </div>

                  <div className="fp-card" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 1100, color: "#0f172a" }}>Notification preferences</div>
                    <div className="fp-muted" style={{ marginTop: 8 }}>
                      Manage notifications from the Notifications page.
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button type="button" className="fpOv-btnSecondary" onClick={() => setView("notifications")}>
                        Open Notifications
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* NOTIFICATIONS */}
          {view === "notifications" ? <CustomerNotifications userId={me?.id} /> : null}
        </main>
      </div>

      {/* Add Order modal */}
      <Modal
        open={addOpen}
        title="Add Order"
        subtitle="Enter your reference number to link this order to your account"
        onClose={() => setAddOpen(false)}
        busy={addBusy}
      >
        {addErr ? (
          <div className="fpPr-alert fpPr-alert--error" role="alert" style={{ marginBottom: 12 }}>
            {addErr}
          </div>
        ) : null}

        <div className="fpPr-modalSection">
          <div className="fpPr-modalSectionTitle">Enter Reference Number</div>
          <input
            className="fp-input"
            value={addRef}
            onChange={(e) => setAddRef(e.target.value)}
            placeholder="e.g., ORD-231312321"
            disabled={addBusy}
            onKeyDown={(e) => {
              if (e.key === "Enter") addOrderByReference(addRef);
            }}
          />
        </div>

        <div className="fp-row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button type="button" className="fpOv-btnSecondary" onClick={() => setAddOpen(false)} disabled={addBusy}>
            Cancel
          </button>
          <button type="button" className="fpOv-btnPrimary" onClick={() => addOrderByReference(addRef)} disabled={addBusy}>
            {addBusy ? "Adding…" : "Submit"}
          </button>
        </div>
      </Modal>

      {/* Tracking modal */}
      <Modal
        open={trackOpen}
        title="Track Shipment"
        subtitle={activeRef ? `Reference: ${activeRef}` : ""}
        onClose={() => setTrackOpen(false)}
      >
        {trackErr ? (
          <div className="fpPr-alert fpPr-alert--error" role="alert" style={{ marginBottom: 12 }}>
            {trackErr}
          </div>
        ) : null}

        <div className="fp-card" style={{ padding: 14 }}>
          <div className="fp-row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div className="fp-stack" style={{ gap: 2 }}>
              <div style={{ fontWeight: 1100, color: "#0f172a" }}>{detail?.delivery?.reference_no || activeRef || "—"}</div>
              <div className="fp-muted" style={{ fontWeight: 800, fontSize: 12 }}>
                {shortAddr(detail?.delivery?.pickup_address)} → {shortAddr(detail?.delivery?.dropoff_address)}
              </div>
            </div>

            <div className="fp-row" style={{ alignItems: "center", gap: 10 }}>
              {loadingDetail ? <span className="fp-muted">Updating…</span> : null}
              {detail?.delivery?.status ? (
                <span className="fpOvD-status" style={statusChipStyle(detail.delivery.status)}>
                  {detail.delivery.status}
                </span>
              ) : null}
            </div>
          </div>

          <div className="fp-row" style={{ justifyContent: "space-between", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <div className="fp-muted" style={{ fontWeight: 900 }}>
              ETA: <b style={{ color: "#0f172a" }}>{fmtDate(detail?.delivery?.delivery_date)}</b>
            </div>
            <button
              type="button"
              className="fpOv-btnSecondary"
              onClick={() => {
                setFollow((v) => {
                  const next = !v;
                  if (!v) setFollowKey((k) => k + 1);
                  return next;
                });
              }}
              title={follow ? "Following driver. Drag/zoom map to stop following." : "Enable auto-follow"}
            >
              {follow ? "Following" : "Follow Driver"}
            </button>
          </div>
        </div>

        <div className="fp-card" style={{ padding: 0, overflow: "hidden", marginTop: 12 }}>
          <div style={{ height: 360, width: "100%" }}>
            <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              <FitBoundsOnTrack pickup={detail?.pickup} dropoff={detail?.dropoff} driverLoc={detail?.driver_location} fitKey={followKey} />
              <FollowDriver driverLoc={detail?.driver_location} follow={follow} followKey={followKey} />

              {detail?.pickup?.lat && detail?.pickup?.lng ? (
                <Marker position={[detail.pickup.lat, detail.pickup.lng]} icon={pickupIcon}>
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    Pickup
                  </Tooltip>
                </Marker>
              ) : null}

              {detail?.dropoff?.lat && detail?.dropoff?.lng ? (
                <Marker position={[detail.dropoff.lat, detail.dropoff.lng]} icon={dropoffIcon}>
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    Drop-off
                  </Tooltip>
                </Marker>
              ) : null}

              {detail?.driver_location?.lat && detail?.driver_location?.lng ? (
                <Marker position={[detail.driver_location.lat, detail.driver_location.lng]} icon={driverIcon}>
                  <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                    {detail?.driver?.name ? `Driver: ${detail.driver.name}` : "Driver"}
                  </Tooltip>
                </Marker>
              ) : null}

              {Array.isArray(detail?.route) && detail.route.length >= 2 ? <Polyline positions={detail.route} /> : null}
            </MapContainer>
          </div>
        </div>

        {showFeedback ? (
          <div className="fp-card" style={{ padding: 16, marginTop: 12 }}>
            <div style={{ fontWeight: 1100, color: "#0f172a" }}>Rate your delivery</div>

            <div className="fp-row" style={{ gap: 6, marginTop: 10, fontSize: 20, userSelect: "none" }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="fpOv-btnIcon"
                  onClick={() => setRating(s)}
                  title={`${s} star`}
                  aria-label={`${s} star`}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    fontSize: 22,
                    fontWeight: 1100,
                    color: rating >= s ? "rgba(245, 158, 11, 1)" : "rgba(148, 163, 184, 1)",
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="fp-textarea"
              placeholder="Optional feedback / issue report (short)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <div className="fp-stack" style={{ gap: 10, marginTop: 12 }}>
              <div className="fp-muted" style={{ fontWeight: 900 }}>
                Upload package photo (optional)
              </div>

              <div className="fp-row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input className="fp-input" type="file" accept="image/*" onChange={onPickPhoto} disabled={savingFb} />
                {photo ? (
                  <button type="button" className="fpOv-btnSecondary" onClick={clearPhoto} disabled={savingFb}>
                    Remove
                  </button>
                ) : null}
              </div>

              {photoPreview ? <img src={photoPreview} alt="Package preview" className="fp-img" style={{ maxHeight: 220 }} /> : null}
            </div>

            <div className="fp-row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="fpOv-btnPrimary" disabled={savingFb} onClick={submitFeedback}>
                {savingFb ? "Submitting…" : "Submit Feedback"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function CustomerNotifications({ userId }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  function minsAgoLabel(iso) {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  function mapTypeToTab(type) {
    const t = String(type || "").toUpperCase();
    if (t === "ORDERS") return "Orders";
    if (t === "DRIVERS") return "Drivers";
    if (t === "SYSTEM") return "System";
    return "All";
  }

  async function load() {
    try {
      setLoading(true);
      setErr("");
const refs = userId ? readSavedRefs(userId) : [];
if (!refs.length) {
  setItems([]);
  return;
}

const res = await api.get("/notifications/customer", {
  params: { limit: 200, refs: refs.join(",") },
});
setItems(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((n) => {
      const tabForItem = mapTypeToTab(n.type);
      const matchTab = tab === "All" ? true : tabForItem === tab;
      if (!matchTab) return false;
      if (!q) return true;
      const hay = `${n.title || ""} ${n.message || ""} ${n.reference_no || ""} ${n.type || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, tab]);

  const pageSize = 6;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function setActiveTab(next) {
    setTab(next);
    setPage(1);
  }

  async function markAllRead() {
    try {
const refs = userId ? readSavedRefs(userId) : [];
await api.post("/notifications/customer/mark-all-read", { refs });
      setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to mark all as read");
    }
  }

  async function markOneRead(id) {
    if (!id) return;
    try {
const refs = userId ? readSavedRefs(userId) : [];
await api.post(`/notifications/customer/${id}/read`, { refs });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    } catch {
      // ignore
    }
  }

  return (
    <div className="fpOv-page">
      <div className="fpOv-mainCard">
        <div className="fpOv-breadcrumb">Notifications</div>
        <div className="fpOv-rainbow" />

        <div className="fpsNotif-headerCard">
          <div className="fpsNotif-titleRow">
            <span className="fpsNotif-titleIcon" aria-hidden="true">
              <Icon name="bell" size={18} />
            </span>
            <div className="fpsNotif-title">Notifications</div>
          </div>

          <div className="fpsNotif-searchRow">
            <span className="fpsNotif-searchIcon" aria-hidden="true">
              <Icon name="search" size={18} />
            </span>
            <input
              className="fpsNotif-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Notifications..."
              aria-label="Search notifications"
            />
          </div>

          <div className="fpsNotif-controlsRow">
            <div className="fpsNotif-tabs" role="tablist" aria-label="Notification filters">
              <button type="button" className={"fpsNotif-tab" + (tab === "All" ? " is-active" : "")} onClick={() => setActiveTab("All")} role="tab" aria-selected={tab === "All"}>
                All
              </button>
              <button type="button" className={"fpsNotif-tab" + (tab === "Orders" ? " is-active" : "")} onClick={() => setActiveTab("Orders")} role="tab" aria-selected={tab === "Orders"}>
                Orders
              </button>
              <button type="button" className={"fpsNotif-tab" + (tab === "Drivers" ? " is-active" : "")} onClick={() => setActiveTab("Drivers")} role="tab" aria-selected={tab === "Drivers"}>
                <span className="fpsNotif-tabIcon" aria-hidden="true">
                  <Icon name="truck" size={16} />
                </span>
                Drivers
              </button>
              <button type="button" className={"fpsNotif-tab" + (tab === "System" ? " is-active" : "")} onClick={() => setActiveTab("System")} role="tab" aria-selected={tab === "System"}>
                System
              </button>
            </div>

            <button type="button" className="fpsNotif-markBtn" onClick={markAllRead}>
              Mark all as read
            </button>
          </div>
        </div>

        <div className="fpsNotif-listCard" role="region" aria-label="Notification list">
          {err ? <div style={{ padding: 12, color: "#b91c1c", fontWeight: 800 }}>{err}</div> : null}
          {loading ? <div style={{ padding: 16, color: "var(--fp-muted)", fontWeight: 800 }}>Loading…</div> : null}
          {!loading && paged.length === 0 ? <div style={{ padding: 16, color: "var(--fp-muted)", fontWeight: 800 }}>No notifications.</div> : null}

          {paged.map((n) => {
            const tabForItem = mapTypeToTab(n.type);
            const showBigIcon = tabForItem === "Drivers";

            return (
              <div
                key={n.id}
                className="fpsNotif-item"
                role="button"
                tabIndex={0}
                onClick={() => markOneRead(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") markOneRead(n.id);
                }}
                style={{ cursor: "pointer" }}
                title="Click to mark as read"
              >
                <div className="fpsNotif-itemLeft">
                  {showBigIcon ? (
                    <div className="fpsNotif-bigIcon" aria-hidden="true">
                      <Icon name="truck" size={28} />
                    </div>
                  ) : (
                    <div className="fpsNotif-spacerIcon" aria-hidden="true" />
                  )}

                  <div className="fpsNotif-text">
                    <div className="fpsNotif-line">
                      <div className="fpsNotif-itemTitle">{n.title || "Notification"}</div>
                      {n.unread ? <span className="fpsNotif-unreadDot" aria-label="Unread" /> : null}
                    </div>
                    <div className="fpsNotif-itemMsg">{n.message || ""}</div>
                    <div className="fpsNotif-itemMeta">
                      <span className="fpsNotif-typeChip">{tabForItem}</span>
                      {n.reference_no ? <span className="fpsNotif-ref">{n.reference_no}</span> : null}
                      <span className="fpsNotif-time">{minsAgoLabel(n.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {totalPages > 1 ? (
            <div className="fpsNotif-pager">
              <button type="button" className="fpsNotif-pageBtn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                Prev
              </button>
              <div className="fpsNotif-pageMeta">
                Page <b>{safePage}</b> / {totalPages}
              </div>
              <button type="button" className="fpsNotif-pageBtn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
