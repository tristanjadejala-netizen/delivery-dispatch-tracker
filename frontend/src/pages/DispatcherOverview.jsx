import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "leaflet/dist/leaflet.css";

import StatsGrid from "../components/dispatcher/StatsGrid";
import ExceptionsInbox from "../components/dispatcher/ExceptionsInbox";
import DeliveryCard from "../components/dispatcher/DeliveryCard";
import Icon from "../components/dispatcher/Icons";

const API_BASE = "http://localhost:5000";

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

export default function DispatcherOverview() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverLocations, setDriverLocations] = useState([]);

  // Delivery actions (re-used by DeliveryCard)
  const [driverPick, setDriverPick] = useState({});
  const [assigningId, setAssigningId] = useState(null);

  async function loadDeliveries() {
    const { data } = await api.get("/deliveries", {
      params: { status: "ALL", q: "", limit: 50, offset: 0 },
    });
    setDeliveries(data.rows || []);

    setDriverPick((prev) => {
      const next = { ...prev };
      for (const d of data.rows || []) {
        if (d.assigned_driver_id && next[d.id] == null)
          next[d.id] = String(d.assigned_driver_id);
      }
      return next;
    });
  }

  async function loadDrivers() {
    const { data } = await api.get("/deliveries/drivers");
    const normalized = (data.rows || []).map((dr) => ({
      ...dr,
      driver_id: dr.driver_id ?? dr.id,
      name: dr.name || `Driver #${dr.driver_id ?? dr.id}`,
      status: dr.status || "ACTIVE",
    }));
    setDrivers(normalized);
  }

  async function loadDriverLocations() {
    const { data } = await api.get("/deliveries/driver-locations");
    setDriverLocations(data.rows || []);
  }

  async function refresh() {
    setLoading(true);
    setErr("");
    try {
      await Promise.all([
        loadDeliveries(),
        loadDrivers(),
        loadDriverLocations(),
      ]);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Failed to refresh",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const rows = deliveries || [];
    const active = rows.filter(
      (d) => !["DELIVERED", "FAILED", "CANCELLED"].includes(d.status),
    ).length;
    const delivered = rows.filter((d) => d.status === "DELIVERED").length;
    const failed = rows.filter((d) => d.status === "FAILED").length;
    return { total: rows.length, active, delivered, failed };
  }, [deliveries]);

  const exceptions = useMemo(() => {
    const rows = deliveries || [];
    const unassigned = rows.filter(
      (d) =>
        (d.status === "PENDING" || d.status === "ASSIGNED") &&
        !d.assigned_driver_id,
    );
    const failed = rows.filter((d) => d.status === "FAILED");

    const STALE_MIN = 10;
    const staleDrivers = (driverLocations || []).filter(
      (dl) => minsSince(dl.updated_at) >= STALE_MIN,
    );

    return {
      unassignedCount: unassigned.length,
      failedCount: failed.length,
      staleDriverCount: staleDrivers.length,
      staleMinutesThreshold: STALE_MIN,
    };
  }, [deliveries, driverLocations]);

  const recentActive = useMemo(() => {
    return (deliveries || [])
      .filter((d) => !["DELIVERED", "FAILED", "CANCELLED"].includes(d.status))
      .slice(0, 6);
  }, [deliveries]);

  async function assignDriver(deliveryId) {
    const picked = driverPick[deliveryId];
    if (!picked) {
      alert("Please select a driver first.");
      return;
    }

    setAssigningId(deliveryId);
    setErr("");
    try {
      await api.post(`/deliveries/${deliveryId}/assign`, {
        driver_id: Number(picked),
      });
      await loadDeliveries();
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Assign failed",
      );
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <>
      <div className="fp-header" style={{ marginTop: 0 }}>
        <div>
          <h1 className="fp-title">
            <span className="fp-titleIcon" aria-hidden="true">
              <Icon name="home" size={18} />
            </span>
            Overview
          </h1>
          <div className="fp-sub">
            Quick summary + shortcuts. Use the tabs above to jump into details.
            {lastUpdatedAt ? (
              <span className="fp-subMeta">
                <span className="fp-subDot" aria-hidden="true" />
                Updated:{" "}
                <b>
                  {new Date(lastUpdatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </b>
              </span>
            ) : null}
          </div>
        </div>

        <div className="fp-actions">
          <button className="fp-btn fp-btn-solid" onClick={refresh}>
            <Icon name="refresh" />
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <div
          className="fp-alert"
          role="alert"
          aria-live="polite"
          style={{ marginTop: 14 }}
        >
          <span className="fp-alertIcon" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <div>{err}</div>
        </div>
      ) : null}

    
      <StatsGrid stats={stats} />

      <ExceptionsInbox
        exceptions={exceptions} 
        onShowUnassigned={() => nav("/dispatcher/deliveries")}
        onShowFailed={() => nav("/dispatcher/deliveries")}
        onShowStaleDrivers={() => nav("/dispatcher/drivers")}
      />

      <div className="fp-surface" style={{ marginTop: 14 }}>
        <div className="fp-surfaceHeader">
          <div>
            <div className="fp-surfaceTitle">
              <span className="fp-surfaceTitleIcon" aria-hidden="true">
                <Icon name="list" />
              </span>
              Recent active deliveries
              <span className="fp-pill" style={{ marginLeft: 10 }}>
                {recentActive.length}
              </span>
            </div>
            <div className="fp-muted fp-mt-xs">
              A short list so this page stays uncluttered.
            </div>
          </div>

          <button
            className="fp-btn2"
            onClick={() => nav("/dispatcher/deliveries")}
          >
            View all
          </button>
        </div>

        <div className="fp-list" style={{ marginTop: 10 }}>
          {recentActive.length === 0 ? (
            <div className="fp-muted" style={{ padding: 12 }}>
              No active deliveries right now.
            </div>
          ) : (
            recentActive.map((d) => (
              <DeliveryCard
                key={d.id}
                delivery={d}
                drivers={drivers}
                driverPickValue={driverPick[d.id] || ""}
                onPickDriver={(val) =>
                  setDriverPick((p) => ({ ...p, [d.id]: val }))
                }
                onAssign={() => assignDriver(d.id)}
                assigningId={assigningId}
                // Keep this page light: push deeper actions to Deliveries page
                onDelete={() => nav("/dispatcher/deliveries")}
                deletingId={null}
                toggleTimeline={() => nav("/dispatcher/deliveries")}
                openTimeline={false}
                events={[]}
                loadingEventsId={null}
                togglePod={() => nav("/dispatcher/deliveries")}
                openPod={false}
                pod={null}
                loadingPodId={null}
                toggleFailure={() => nav("/dispatcher/deliveries")}
                openFailure={false}
                failure={null}
                loadingFailureId={null}
                fmt={fmt}
                API_BASE={API_BASE}
                selected={false}
                onToggleSelect={() => {}}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
