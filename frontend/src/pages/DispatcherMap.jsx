import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "../styles/fastpass-dispatcher-shell.css";
import "leaflet/dist/leaflet.css";

import DeliveryMapInline from "../components/dispatcher/DeliveryMapInline";
import Icon from "../components/dispatcher/Icons";
import SectionHeader from "../components/dispatcher/SectionHeader";

import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

/* ───────────────────────────────────────────── */
/* Leaflet marker setup                          */
/* ───────────────────────────────────────────── */
function makeMarker(color) {
  return new L.Icon({
    iconUrl:
      color === "red"
        ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png"
        : "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

const BLUE_MARKER = makeMarker("blue");
const RED_MARKER = makeMarker("red");

const STALE_MIN = 10;
const GEO_PRECISION = 5; // decimals for caching / stability
const GEO_THROTTLE_MS = 1100; // Nominatim-friendly pacing

function minsSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 60000;
}

function fmtUpdated(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtAgoMinutes(iso) {
  const mins = minsSince(iso);
  if (!Number.isFinite(mins) || mins === Infinity) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  const days = hrs / 24;
  return `${Math.round(days)}d ago`;
}

function FitBounds({ points, focus }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points.length) return;

    if (focus) {
      map.setView([focus.lat, focus.lng], 16, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, points, focus]);

  return null;
}

export default function DispatcherMap() {
  const nav = useNavigate();
  const location = useLocation();

  const focusFromDrivers = location?.state?.focusDriverId;
  const driverSectionRef = useRef(null);
  const locPollRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [deliveries, setDeliveries] = useState([]);

  const [ref, setRef] = useState("");
  const [openRef, setOpenRef] = useState("");

  // live driver locations
  const [locLoading, setLocLoading] = useState(false);
  const [locErr, setLocErr] = useState("");
  const [locRows, setLocRows] = useState([]);
  const [locUpdatedAt, setLocUpdatedAt] = useState(null);
  const [focusedDriver, setFocusedDriver] = useState(null);

  // Reverse geocoding (lat/lng -> address)
  const [addressMap, setAddressMap] = useState({});
  const geoQueueRef = useRef([]); // [{ key, lat, lng }]
  const geoInFlightRef = useRef(false);
  const geoTimerRef = useRef(null);

  async function loadDeliveries() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/deliveries", {
        params: { status: "ALL", q: "", limit: 50, offset: 0 },
      });
      setDeliveries(data.rows || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  async function loadDriverLocations(silent = false) {
    if (!silent) {
      setLocLoading(true);
      setLocErr("");
    }
    try {
      const { data } = await api.get("/deliveries/driver-locations");
      setLocRows(data.rows || []);
      setLocUpdatedAt(new Date().toISOString());
    } catch (e) {
      if (!silent) {
        setLocErr(e?.response?.data?.message || "Failed to load driver locations");
      }
    } finally {
      if (!silent) setLocLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.allSettled([loadDeliveries(), loadDriverLocations(false)]);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll driver locations (live)
  useEffect(() => {
    if (locPollRef.current) {
      clearInterval(locPollRef.current);
      locPollRef.current = null;
    }

    locPollRef.current = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadDriverLocations(true);
    }, 5000);

    return () => {
      if (locPollRef.current) clearInterval(locPollRef.current);
      locPollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => {
    const rows = deliveries || [];
    const active = rows.filter((d) => !["DELIVERED", "FAILED", "CANCELLED"].includes(d.status));
    const rest = rows.filter((d) => ["DELIVERED", "FAILED", "CANCELLED"].includes(d.status));
    return [...active, ...rest]
      .filter((d) => d.reference_no)
      .map((d) => ({
        ref: d.reference_no,
        label: `${d.reference_no} — ${d.status}${d.customer_name ? ` — ${d.customer_name}` : ""}`,
      }));
  }, [deliveries]);

  const drivers = useMemo(() => {
    return (locRows || [])
      .map((r) => {
        const lat = Number(r.lat);
        const lng = Number(r.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const stale = minsSince(r.updated_at) >= STALE_MIN;

        const key = `${lat.toFixed(GEO_PRECISION)},${lng.toFixed(GEO_PRECISION)}`;

        return {
          ...r,
          lat,
          lng,
          geo_key: key,
          address: addressMap[key] || "",
          id: r.driver_id ?? r.id,
          name: r.name || `Driver #${r.driver_id ?? r.id}`,
          status: r.status || "ACTIVE",
          stale,
        };
      })
      .filter(Boolean);
  }, [locRows, addressMap]);

  const points = useMemo(
    () => drivers.map((d) => ({ lat: d.lat, lng: d.lng })),
    [drivers],
  );

  // Coming from Drivers page: focus + scroll to Driver GPS section
  useEffect(() => {
    if (!focusFromDrivers) return;

    const found = drivers.find((d) => String(d.id) === String(focusFromDrivers));
    if (found) setFocusedDriver(found);

    if (driverSectionRef.current) {
      driverSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFromDrivers, drivers.length]);

  // Reverse geocode helpers
  function enqueueReverseGeocode(lat, lng) {
    const key = `${lat.toFixed(GEO_PRECISION)},${lng.toFixed(GEO_PRECISION)}`;
    if (addressMap[key]) return;

    // avoid duplicate queue entries
    if (geoQueueRef.current.some((x) => x.key === key)) return;

    geoQueueRef.current.push({ key, lat, lng });
  }

  async function fetchAddressOnce({ key, lat, lng }) {
    // Nominatim usage: keep requests modest & cache aggressively.
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat,
    )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
    const data = await res.json();
    const address = (data && data.display_name) || "";
    if (!address) return;

    setAddressMap((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: address };
    });
  }

  // Enqueue reverse geocoding when drivers update (cached + throttled)
  useEffect(() => {
    (drivers || []).forEach((d) => {
      if (!Number.isFinite(d.lat) || !Number.isFinite(d.lng)) return;
      enqueueReverseGeocode(d.lat, d.lng);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locRows]);

  // Throttled queue worker
  useEffect(() => {
    if (geoTimerRef.current) {
      clearInterval(geoTimerRef.current);
      geoTimerRef.current = null;
    }

    geoTimerRef.current = setInterval(async () => {
      if (geoInFlightRef.current) return;
      const next = geoQueueRef.current.shift();
      if (!next) return;
      if (addressMap[next.key]) return;

      geoInFlightRef.current = true;
      try {
        await fetchAddressOnce(next);
      } catch {
        // If it fails, we simply skip. The UI will fallback to coords.
      } finally {
        geoInFlightRef.current = false;
      }
    }, GEO_THROTTLE_MS);

    return () => {
      if (geoTimerRef.current) clearInterval(geoTimerRef.current);
      geoTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressMap]);

  function open() {
    const r = ref.trim();
    if (!r) return;
    setOpenRef(r);
  }

  return (
    <div className="fpOv-page">
      <div className="fpOv-mainCard">
      <SectionHeader
        title="Map"
        subtitle="Pick a delivery reference number to view pickup, dropoff, and driver location."
      />

      {err ? (
        <div className="fp-alert" role="alert" aria-live="polite" style={{ marginTop: 14 }}>
          <span className="fp-alertIcon" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <div>{err}</div>
        </div>
      ) : null}

      <div className="fp-surface" style={{ marginTop: 14 }}>
        <div className="fp-surfaceHeader">
          <div>
            <div className="fp-surfaceTitle">
              <span className="fp-surfaceTitleIcon" aria-hidden="true">
                <Icon name="search" />
              </span>
              Choose a delivery
            </div>
            <div className="fp-muted fp-mt-xs">Dedicated map page so the Deliveries page stays clean.</div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="fp-select"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              style={{ minWidth: 320 }}
            >
              <option value="">Select reference…</option>
              {options.map((o) => (
                <option key={o.ref} value={o.ref}>
                  {o.label}
                </option>
              ))}
            </select>

            <button className="fp-btn2 fp-btn2-primary" onClick={open} disabled={!ref.trim()}>
              <Icon name="map" />
              Open map
            </button>
          </div>
        </div>
      </div>

      {openRef ? (
        <div style={{ marginTop: 14 }}>
          <DeliveryMapInline referenceNo={openRef} onClose={() => setOpenRef("")} />
        </div>
      ) : null}

      {/* Live GPS for all drivers */}
      <div ref={driverSectionRef} />

      {locErr ? (
        <div className="fp-alert" role="alert" aria-live="polite" style={{ marginTop: 14 }}>
          <span className="fp-alertIcon" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <div>{locErr}</div>
        </div>
      ) : null}

      <div className="fp-surface" style={{ marginTop: 14 }}>
        <div className="fp-surfaceHeader">
          <div>
            <div className="fp-surfaceTitle">
              <span className="fp-surfaceTitleIcon" aria-hidden="true">
                <Icon name="gps" />
              </span>
              Live Driver Locations
            </div>
            <div className="fp-muted fp-mt-xs">
              Last known GPS for drivers (auto-updating)
              {locUpdatedAt
                ? ` • Updated ${new Date(locUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </div>
          </div>
        </div>

        <div
          style={{
            height: 360,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(15,23,42,.08)",
          }}
        >
          <MapContainer center={[14.5995, 120.9842]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitBounds
              points={points}
              focus={focusedDriver ? { lat: focusedDriver.lat, lng: focusedDriver.lng } : null}
            />

            {drivers.map((d) => (
              <Marker key={d.id} position={[d.lat, d.lng]} icon={d.stale ? RED_MARKER : BLUE_MARKER}>
                <Popup>
                  <div style={{ fontWeight: 800 }}>{d.name}</div>
                  {d.email ? <div style={{ fontSize: 12, opacity: 0.8 }}>{d.email}</div> : null}
                  {d.address ? (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{d.address}</div>
                  ) : null}
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    Lat: {d.lat}
                    <br />
                    Lng: {d.lng}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Driver table (Last known) */}
      <div className="fp-surface" style={{ marginTop: 14 }}>
        <div className="fp-surfaceHeader">
          <div>
            <div className="fp-surfaceTitle">
              <span className="fp-surfaceTitleIcon" aria-hidden="true">
                <Icon name="pin" />
              </span>
              Driver Locations (Last Known)
            </div>
            <div className="fp-muted fp-mt-xs">Click a driver to focus on the map.</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="fp-btn2" onClick={() => loadDriverLocations(false)} disabled={locLoading}>
              <Icon name="refresh" />
              {locLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="fp-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Driver</th>
                <th style={{ minWidth: 120 }}>Last Update</th>
                <th style={{ minWidth: 420 }}>Last Known Address</th>
                <th style={{ minWidth: 220 }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="fp-muted" style={{ padding: 16 }}>
                    {locLoading ? "Loading driver locations…" : "No driver locations available."}
                  </td>
                </tr>
              ) : (
                drivers.map((d) => {
                  const isFocused = focusedDriver && String(focusedDriver.id) === String(d.id);
                  const rowKey = d.id ?? d.geo_key;
                  return (
                    <tr
                      key={rowKey}
                      onClick={() => setFocusedDriver(d)}
                      style={{
                        cursor: "pointer",
                        background: isFocused ? "rgba(59,130,246,.06)" : undefined,
                      }}
                      title="Click to focus"
                    >
                      <td>
                        <div style={{ fontWeight: 800 }}>{d.name}</div>
                        {d.email ? <div className="fp-muted" style={{ fontSize: 12 }}>{d.email}</div> : null}
                      </td>
                      <td>
                        <span className={d.stale ? "fp-badge fp-badge-warn" : "fp-badge"}>
                          {fmtAgoMinutes(d.updated_at)}
                        </span>
                      </td>
                      <td>
                        {d.address ? (
                          <span>{d.address}</span>
                        ) : (
                          <span className="fp-muted">
                            Resolving… (Lat {d.lat.toFixed(5)}, Lng {d.lng.toFixed(5)})
                          </span>
                        )}
                      </td>
                      <td>{fmtUpdated(d.updated_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
