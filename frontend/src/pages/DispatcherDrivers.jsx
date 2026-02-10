import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

import DriverLocationsTable from "../components/dispatcher/DriverLocationsTable";
import Icon from "../components/dispatcher/Icons";

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

/* ───────────────────────────────────────────── */

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

/* ───────────────────────────────────────────── */

export default function DispatcherDrivers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  // Map focus target
  const [focusedDriver, setFocusedDriver] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/deliveries/driver-locations");
      setRows(data.rows || []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load driver locations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const drivers = useMemo(() => {
    return (rows || [])
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
  }, [rows]);

  const staleCount = drivers.filter((d) => d.stale).length;

  return (
    <>
      {/* Header */}
      <div className="fp-header" style={{ marginTop: 0 }}>
        <div>
          <h1 className="fp-title">
            <span className="fp-titleIcon">
              <Icon name="gps" size={18} />
            </span>
            Drivers
          </h1>
          <div className="fp-sub">
            Last known GPS updates from drivers.
            {lastUpdatedAt && (
              <span className="fp-subMeta">
                <span className="fp-subDot" />
                Updated:{" "}
                <b>
                  {new Date(lastUpdatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </b>
              </span>
            )}
          </div>
        </div>

        <div className="fp-actions">
          <button
            className="fp-btn fp-btn-solid"
            onClick={load}
            disabled={loading}
          >
            <Icon name="refresh" />
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="fp-alert" role="alert">
          <Icon name="alert" />
          <div>{err}</div>
        </div>
      )}

      {/* Health check */}
      <div className="fp-surface" style={{ marginTop: 14 }}>
        <div className="fp-surfaceHeader">
          <div>
            <div className="fp-surfaceTitle">
              <Icon name="shield" /> Health check
            </div>
            <div className="fp-muted fp-mt-xs">
              Stale GPS means no update for {STALE_MIN} minutes.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <span className={staleCount ? "fp-pill fp-pill-warn" : "fp-pill"}>
              Stale GPS: <b>{staleCount}</b>
            </span>
            <span className="fp-pill fp-pill-info">
              Threshold: {STALE_MIN}m
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="fp-surface" style={{ marginTop: 14 }}>
        <div className="fp-surfaceHeader">
          <div className="fp-surfaceTitle">
            <Icon name="map" /> Driver Locations
          </div>
        </div>

        <div
          style={{
            height: 420,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,.06)",
          }}
        >
          <MapContainer
            center={[14.5995, 120.9842]}
            zoom={12}
            style={{ height: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={drivers} focus={focusedDriver} />

            {drivers.map((d) => (
              <Marker
                key={d.id}
                position={[d.lat, d.lng]}
                icon={d.stale ? RED_MARKER : BLUE_MARKER}
                eventHandlers={{
                  click: () => setFocusedDriver(d),
                }}
              >
                {d.stale && <div className="stale-marker" />}

                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontWeight: 900 }}>{d.name}</div>

                    <div
                      style={{
                        marginTop: 6,
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="fp-pill fp-pill-info">{d.status}</span>
                      {d.stale &&
                        (!focusedDriver || focusedDriver.id !== d.id) && (
                          <div className="stale-marker" />
                        )}
                    </div>

                    <div
                      className="fp-muted"
                      style={{ marginTop: 8, fontSize: 12 }}
                    >
                      Updated: <b>{fmt(d.updated_at)}</b>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Table (click row → focus map) */}
      <DriverLocationsTable
        rows={rows}
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
