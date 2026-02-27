import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "leaflet/dist/leaflet.css";

import Icon from "../components/dispatcher/Icons";
import SectionHeader from "../components/dispatcher/SectionHeader";
import "../styles/dispatcher-drivers.css";

export default function DispatcherDrivers() {
  const nav = useNavigate();

  // live GPS polling
  const locPollRef = useRef(null);
  const [driverLocations, setDriverLocations] = useState([]);
  const [locUpdatedAt, setLocUpdatedAt] = useState(null);

  const [drivers, setDrivers] = useState([]);
  const [ordersAvailable, setOrdersAvailable] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const STALE_MIN = 10;

  function minsSince(iso) {
    if (!iso) return Infinity;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return Infinity;
    return Math.floor((Date.now() - t) / 60000);
  }

  async function loadDrivers() {
    const { data } = await api.get("/admin/drivers");
    setDrivers(data.rows || []);
  }

  async function loadOrdersAvailableCount() {
    try {
      const { data } = await api.get("/deliveries", {
        params: { status: "PENDING", q: "", limit: 1, offset: 0 },
      });
      setOrdersAvailable(data.total || 0);
    } catch {
      setOrdersAvailable(0);
    }
  }

  async function loadDriverLocations(silent = false) {
    if (!silent) setErr("");
    try {
      const { data } = await api.get("/deliveries/driver-locations");
      setDriverLocations(data.rows || []);
      setLocUpdatedAt(new Date().toISOString());
    } catch (e) {
      if (!silent) {
        setErr(e?.response?.data?.message || "Failed to load driver locations");
      }
    }
  }

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      await Promise.all([
        loadDrivers(),
        loadOrdersAvailableCount(),
        loadDriverLocations(true),
      ]);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to refresh");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (locPollRef.current) clearInterval(locPollRef.current);

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

  const locByDriverId = useMemo(() => {
    const map = new Map();
    for (const r of driverLocations || []) {
      const id = r.driver_id ?? r.id;
      if (id == null) continue;
      map.set(String(id), r);
    }
    return map;
  }, [driverLocations]);

  const stats = useMemo(() => {
    const rows = drivers || [];
    const total = rows.length;
    const active = rows.filter(
      (d) => String(d.status || "").toUpperCase() === "AVAILABLE",
    ).length;
    const busy = rows.filter(
      (d) => String(d.status || "").toUpperCase() === "BUSY",
    ).length;
    const offline = total - active - busy;

    const stale = rows.filter((d) => {
      const loc = locByDriverId.get(String(d.driver_id));
      const mins = minsSince(loc?.updated_at);
      const hasLoc = loc?.lat != null && loc?.lng != null;
      return hasLoc && mins >= STALE_MIN;
    }).length;

    return { total, active, busy, offline, stale };
  }, [drivers, locByDriverId]);

  const activeDrivers = useMemo(() => {
    return (drivers || []).filter(
      (d) => String(d.status || "").toUpperCase() === "AVAILABLE",
    );
  }, [drivers]);

  return (
    <div className="fpOv-page">
      <div className="fpOv-mainCard">
        <SectionHeader
          title="Drivers"
          subtitle="Monitor live GPS and driver availability. Use Driver Management for edits."
          right={
            <div className="fpDrv-topActions">
              <button
                className="fp-btn fp-btn-ghost"
                type="button"
                onClick={() => nav("/dispatcher/drivers/manage")}
              >
                <Icon name="settings" />
                Driver Management
              </button>

              <button
                className="fp-btn fp-btn-solid"
                type="button"
                onClick={refresh}
                disabled={loading}
              >
                <Icon name="refresh" />
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          }
        />

        {err ? (
          <div className="fp-alert fpDrv-alert" role="alert" aria-live="polite">
            <span className="fp-alertIcon" aria-hidden="true">
              <Icon name="alert" />
            </span>
            <div>{err}</div>
          </div>
        ) : null}

        {/* KPI Row */}
        <div className="fpDrv-kpiRow">
          <button
            className="fpDrv-kpiCard fpDrv-kpiCard--orders"
            type="button"
            onClick={() =>
              nav("/dispatcher/deliveries", { state: { tab: "UNASSIGNED" } })
            }
            title="Open pending deliveries"
          >
            <div className="fpDrv-kpiLabel">Orders Available</div>
            <div className="fpDrv-kpiValue">{ordersAvailable}</div>
            <div className="fpDrv-kpiHint">Pending orders waiting assignment</div>
          </button>

          <div className="fpDrv-kpiCard">
            <div className="fpDrv-kpiLabel">Total Drivers</div>
            <div className="fpDrv-kpiValue">{stats.total}</div>
            <div className="fpDrv-kpiHint">All driver records</div>
          </div>

          <div className="fpDrv-kpiCard">
            <div className="fpDrv-kpiLabel">Active</div>
            <div className="fpDrv-kpiValue">{stats.active}</div>
            <div className="fpDrv-kpiHint">Available now</div>
          </div>

          <div className="fpDrv-kpiCard">
            <div className="fpDrv-kpiLabel">Stale GPS</div>
            <div className="fpDrv-kpiValue">{stats.stale}</div>
            <div className="fpDrv-kpiHint">Pins older than {STALE_MIN} mins</div>
          </div>
        </div>

        {/* Clean 2-col overview (lightweight) */}
        <div className="fpDrv-mainGrid fpDrv-mainGrid--clean fpDrv-mainGrid--single">
          <div className="fpDrv-card fpDrv-card--wide">
            <div className="fpDrv-cardHeader">
              <div>
                <div className="fpDrv-cardTitle">Active Drivers</div>
                <div className="fp-muted fp-mt-xs">
                  Quick snapshot of drivers currently available.
                </div>
              </div>

              <button
                className="fp-btn fp-btn-ghost"
                type="button"
                onClick={() => nav("/dispatcher/map")}
              >
                <Icon name="map" />
                Open Map
              </button>
            </div>

            <div className="fpDrv-miniList fpDrv-miniList--wide">
              {activeDrivers.slice(0, 20).map((d) => (
                <div className="fpDrv-miniRow fpDrv-miniRow--wide" key={d.driver_id}>
                  <div className="fpDrv-avatar">
                    {(d.name || "D").slice(0, 1).toUpperCase()}
                  </div>

                  <div className="fpDrv-miniMain">
                    <div className="fpDrv-miniName">
                      {d.name || `Driver #${d.driver_id}`}
                    </div>
                    <div className="fpDrv-miniHelp">{d.email || "—"}</div>
                  </div>

                  <span className="fp-pill fp-pill-ok">Active</span>

                  <button
                    className="fpDrv-mapPremiumBtn"
                    type="button"
                    onClick={() =>
                      nav("/dispatcher/map", {
                        state: { focusDriverId: d.driver_id },
                      })
                    }
                    title="Center map on this driver"
                  >
                    <span className="fpDrv-mapPremiumInner">
                      <Icon name="map" size={14} />
                      <span>Live Map</span>
                    </span>
                  </button>
                </div>
              ))}

              {activeDrivers.length === 0 ? (
                <div className="fpDrv-miniEmpty">No active drivers right now.</div>
              ) : null}
            </div>

            <div className="fpDrv-footerMeta">
              Active: <b>{stats.active}</b> • Busy: <b>{stats.busy}</b> • Offline: <b>{stats.offline}</b>
              {locUpdatedAt ? (
                <span className="fpDrv-gpsStamp">
                  • GPS updated{" "}
                  {new Date(locUpdatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
