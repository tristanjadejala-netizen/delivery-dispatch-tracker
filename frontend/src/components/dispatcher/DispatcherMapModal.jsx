import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "leaflet/dist/leaflet.css";

import DeliveryMapInline from "../components/dispatcher/DeliveryMapInline";
import DriverLocationsTable from "../components/dispatcher/DriverLocationsTable";
import Icon from "../components/dispatcher/Icons";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

function fmt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function minsSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 60000;
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
  // Deliveries (existing map feature)
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [deliveries, setDeliveries] = useState([]);

  const [ref, setRef] = useState("");
  const [openRef, setOpenRef] = useState("");

  // Driver locations (moved from old DispatcherDrivers.jsx)
  const [locLoading, setLocLoading] = useState(false);
  const [locErr, setLocErr] = useState("");
  const [locRows, setLocRows] = useState([]);
  const [locUpdatedAt, setLocUpdatedAt] = useState(null);
  const [focusedDriver, setFocusedDriver] = useState(null);

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

  async function loadDriverLocations() {
    setLocLoading(true);
    setLocErr("");
    try {
      const { data } = await api.get("/deliveries/driver-locations");
      setLocRows(data.rows || []);
      setLocUpdatedAt(new Date().toISOString());
    } catch (e) {
      setLocErr(e?.response?.data?.message || "Failed to load driver locations");
    } finally {
      setLocLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.allSettled([loadDeliveries(), loadDriverLocations()]);
  }

  useEffect(() => {
    refreshAll();
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

        return {
          ...r,
          lat,
          lng,
          id: r.driver_id ?? r.id,
          name: r.name || `Driver #${r.driver_id ?? r.id}`,
          status: r.status || "ACTIVE",
          stale,
        };
      })
      .filter(Boolean);
  }, [locRows]);

  const staleCount = useMemo(() => drivers.filter((d) => d.stale).length, [drivers]);

  function open() {
    const r = ref.trim();
    if (!r) return;
    setOpenRef(r);
  }

  return (
    <>
      {/* Page Header */}
      <div className="fp-header" style={{ marginTop: 0 }}>
        <div>
          <h1 className="fp-title">
            <span className="fp-titleIcon" aria-hidden="true">
              <Icon name="map" size={18} />
            </span>
            Map
          </h1>
          <div className="fp-sub">
            View delivery routes (pickup/dropoff) and monitor live driver GPS locations.
          </div>
        </div>

        <div className="fp-actions">
          <button className="fp-btn fp-btn-solid" onClick={refreshAll} disabled={loading || locLoading}>
            <Icon name="refresh" />
            {(loading || locLoading) ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="fp-alert" role="alert" aria-live="polite" style={{ marginTop: 14 }}>
          <span className="fp-alertIcon" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <div>{err}</div>
        </div>
      ) : null}

      {/* 1) Delivery Map picker */}
      <div className="fp-surface" style={{ marginTop: 14 }}>
        <div className="fp-surfaceHeader">
          <div>
            <div className="fp-surfaceTitle">
              <span className="fp-surfaceTitleIcon" aria-hidden="true">
                <Icon name="search" />
              </span>
              Choose a delivery
            </div>
            <div className="fp-muted fp-mt-xs">
              Pick a delivery reference number to view pickup, dropoff, and driver location.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select className="fp-select" value={ref} onChange={(e) => setRef(e.target.value)} style={{ minWidth: 320 }}>
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

      {/* 2) Driver GPS locations (moved from old DispatcherDrivers.jsx) */}
      <div className="fp-surface" style={{ marginTop: 18 }}>
        <div className="fp-surfaceHeader">
          <div>
            <div className="fp-surfaceTitle">
              <Icon name="gps" /> Driver Locations (GPS)
            </div>
            <div className="fp-muted fp-mt-xs">
              Stale GPS means no update for {STALE_MIN} minutes.
              {locUpdatedAt ? (
                <span className="fp-subMeta" style={{ marginLeft: 10 }}>
                  <span className="fp-subDot" />
                  Updated:{" "}
                  <b>
                    {new Date(locUpdatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </b>
                </span>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className={staleCount ? "fp-pill fp-pill-warn" : "fp-pill"}>
              Stale GPS: <b>{staleCount}</b>
            </span>
            <span className="fp-pill fp-pill-info">Threshold: {STALE_MIN}m</span>

            <button className="fp-btn fp-btn-solid" onClick={loadDriverLocations} disabled={locLoading}>
              <Icon name="refresh" />
              {locLoading ? "Refreshing..." : "Refresh GPS"}
            </button>
          </div>
        </div>

        {locErr ? (
          <div className="fp-alert" role="alert" style={{ margin: 14 }}>
            <Icon name="alert" />
            <div>{locErr}</div>
          </div>
        ) : null}

        <div style={{ padding: 16, paddingTop: 12 }}>
          <div
            style={{
              height: 420,
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,.06)",
            }}
          >
            <MapContainer center={[14.5995, 120.9842]} zoom={12} style={{ height: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitBounds points={drivers} focus={focusedDriver} />

              {drivers.map((d) => (
                <Marker
                  key={d.id}
                  position={[d.lat, d.lng]}
                  icon={d.stale ? RED_MARKER : BLUE_MARKER}
                  eventHandlers={{ click: () => setFocusedDriver(d) }}
                >
                  <Popup>
                    <div style={{ minWidth: 200 }}>
                      <div style={{ fontWeight: 900 }}>{d.name}</div>

                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span className="fp-pill fp-pill-info">{d.status}</span>
                        {d.stale ? <span className="fp-pill fp-pill-warn">Stale</span> : null}
                      </div>

                      <div className="fp-muted" style={{ marginTop: 8, fontSize: 12 }}>
                        Updated: <b>{fmt(d.updated_at)}</b>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Table (click row -> focus map) */}
      <DriverLocationsTable
        rows={locRows}
        fmt={fmt}
        onRowClick={(row) => {
          const lat = Number(row.lat);
          const lng = Number(row.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          setFocusedDriver({
            lat,
            lng,
            id: row.driver_id ?? row.id,
          });
        }}
      />
    </>
  );
}
