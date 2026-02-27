import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "../styles/fastpass-dispatcher-shell.css";
import "leaflet/dist/leaflet.css";
import "../styles/dispatcher-overview.css";

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

function Dot({ color = "#3b82f6" }) {
  return (
    <span
      className="fpOv-dot"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

function StatCard({ tone = "blue", label, value }) {
  const toneMap = {
    blue: { bg: "fpOv-stat fpOv-stat--blue", dot: "#2563eb" },
    peach: { bg: "fpOv-stat fpOv-stat--peach", dot: "#f97316" },
    green: { bg: "fpOv-stat fpOv-stat--green", dot: "#16a34a" },
    pink: { bg: "fpOv-stat fpOv-stat--pink", dot: "#ef4444" },
  };
  const t = toneMap[tone] || toneMap.blue;

  return (
    <div className={t.bg}>
      <div className="fpOv-statLabel">
        <Dot color={t.dot} />
        <span>{label}</span>
      </div>
      <div className="fpOv-statValue">{value}</div>
    </div>
  );
}

function MiniCard({ title, value, caption, danger = false }) {
  return (
    <div className={`fpOv-mini ${danger ? "fpOv-mini--danger" : ""}`}>
      <div className="fpOv-miniTop">
        {danger ? (
          <span className="fpOv-miniWarn" aria-hidden="true">
            <Icon name="alert" />
          </span>
        ) : null}
        <div className="fpOv-miniTitle">{title}</div>
      </div>
      <div className="fpOv-miniValue">{value}</div>
      <div className="fpOv-miniCaption">{caption}</div>
    </div>
  );
}

export default function DispatcherOverview() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverLocations, setDriverLocations] = useState([]);

  const [driverPick, setDriverPick] = useState({});
  const [assigningId, setAssigningId] = useState(null);

  const [perfMetric, setPerfMetric] = useState("DELIVERED"); // DELIVERED | FAILED

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

  const activeDeliveries = useMemo(() => {
    return (deliveries || []).filter(
      (d) => !["DELIVERED", "FAILED", "CANCELLED"].includes(d.status),
    );
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

  const driverStats = useMemo(() => {
    const rows = drivers || [];
    const up = (s) => String(s || "").toUpperCase();

    let available = 0;
    let busy = 0;
    let offline = 0;

    for (const d of rows) {
      const s = up(d.status);
      if (s.includes("OFF")) offline += 1;
      else if (
        s.includes("BUSY") ||
        s.includes("ON_DELIVERY") ||
        s.includes("IN_PROGRESS")
      )
        busy += 1;
      else available += 1;
    }

    return { available, busy, offline };
  }, [drivers]);

  const weeklySeries = useMemo(() => {
    // UI-only: compute a simple last-7-days series from delivered timestamps.
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return {
        key,
        short: d.toLocaleDateString([], { weekday: "short" }),
        label: key,
        value: 0,
      };
    });

    const deliveredRows = (deliveries || []).filter(
      (d) => String(d.status || "").toUpperCase() === "DELIVERED",
    );

    for (const d of deliveredRows) {
      const k = String(
        d.updated_at || d.delivered_at || d.created_at || "",
      ).slice(0, 10);
      const slot = days.find((x) => x.key === k);
      if (slot) slot.value += 1;
    }

    const max = Math.max(1, ...days.map((x) => x.value));
    return days.map((x) => ({
      ...x,
      pct: Math.round((x.value / max) * 100),
    }));
  }, [deliveries]);

  const activity = useMemo(() => {
    // UI-only feed derived from existing data; keeps the page feeling "alive".
    const items = [];

    if (exceptions.unassignedCount > 0) {
      items.push({
        text: `${exceptions.unassignedCount} unassigned deliveries need assignment`,
        time: "Just now",
      });
    }
    if (exceptions.failedCount > 0) {
      items.push({
        text: `${exceptions.failedCount} failed deliveries need review`,
        time: "Just now",
      });
    }
    if (exceptions.staleDriverCount > 0) {
      items.push({
        text: `${exceptions.staleDriverCount} driver pins are stale (>${exceptions.staleMinutesThreshold} mins)`,
        time: "Just now",
      });
    }

    (activeDeliveries || []).slice(0, 6).forEach((d) => {
      items.push({
        text: `Delivery ${d.tracking_no || `#${d.id}`} is ${String(
          d.status || "",
        ).toLowerCase()}`,
        time: fmt(d.updated_at || d.created_at),
      });
    });

    return items.slice(0, 8);
  }, [activeDeliveries, exceptions]);

  const recentActive = useMemo(() => {
    return (activeDeliveries || []).slice(0, 6);
  }, [activeDeliveries]);

  const perf = useMemo(() => {
    const days = [];
    const today = new Date();
    // Build last 7 days (oldest -> newest)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }

    const keyFor = (d) => d.toLocaleDateString("en-US", { weekday: "short" }); // Fri, Sat...

    const counts = days.map(() => 0);

    const rows = deliveries || [];
    for (const r of rows) {
      const ts = r.updated_at || r.created_at;
      if (!ts) continue;

      const dt = new Date(ts);
      if (Number.isNaN(dt.getTime())) continue;

      // match to one of last 7 day buckets
      for (let i = 0; i < days.length; i++) {
        const start = days[i].getTime();
        const end = start + 24 * 60 * 60 * 1000;
        const t = dt.getTime();
        if (t >= start && t < end) {
          if (perfMetric === "DELIVERED" && r.status === "DELIVERED")
            counts[i] += 1;
          if (perfMetric === "FAILED" && r.status === "FAILED") counts[i] += 1;
          break;
        }
      }
    }

    const total = counts.reduce((a, b) => a + b, 0);
    const avg = total / 7;

    let bestIdx = 0;
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] > counts[bestIdx]) bestIdx = i;
    }

    const max = Math.max(...counts, 1);

    return {
      labels: days.map(keyFor),
      counts,
      total,
      avg,
      bestLabel: days[bestIdx].toLocaleDateString("en-US", {
        weekday: "short",
      }),
      bestValue: counts[bestIdx],
      max,
    };
  }, [deliveries, perfMetric]);

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

  const updatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleDateString([], {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

  return (
    <div className="fpOv-page">
      <div className="fpOv-mainCard">
        {/* Breadcrumb */}
        <div className="fpOv-breadcrumb">Dashboard / Overview</div>

        {/* Rainbow divider */}
        <div className="fpOv-rainbow" />

        {/* Header row */}
        <div className="fpOv-headerRow">
          <div className="fpOv-titleBlock">
            <div className="fpOv-title">Overview</div>
            <div className="fpOv-subtitle">
              Quick Summary. Use the sidebar to jump into details{" "}
              <span className="fpOv-updated">
                Updated: <b>{updatedLabel}</b>
              </span>
            </div>
          </div>

          <button
            className="fpOv-btnSecondary"
            onClick={refresh}
            disabled={loading}
          >
            <span className="fpOv-btnIcon" aria-hidden="true">
              <Icon name="refresh" />
            </span>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Error */}
        {err ? (
          <div className="fpOv-alert" role="alert" aria-live="polite">
            <span className="fpOv-alertIcon" aria-hidden="true">
              <Icon name="alert" />
            </span>
            <div>{err}</div>
          </div>
        ) : null}

        {/* A) Stats summary row */}
        <div className="fpOv-statsGrid">
          <StatCard tone="blue" label="Total" value={stats.total} />
          <StatCard tone="peach" label="Active" value={stats.active} />
          <StatCard tone="green" label="Delivered" value={stats.delivered} />
          <StatCard tone="pink" label="Failed" value={stats.failed} />
        </div>

        {/* Performance + Quick Actions row */}
        <div className="fpOv-grid2">
          {/* Performance */}
          <div className="fpOv-perfCard">
            <div className="fpOv-perfHead">
              <div>
                <div className="fpOv-perfTitle">
                  {perfMetric === "DELIVERED"
                    ? "Completed Deliveries"
                    : "Failed Deliveries"}{" "}
                  (Last 7 Days)
                </div>
                <div className="fpOv-perfSub">
                  Total: <b>{perf.total}</b> • Avg/day:{" "}
                  <b>{perf.avg.toFixed(1)}</b> • Best day:{" "}
                  <b>
                    {perf.bestLabel} ({perf.bestValue})
                  </b>
                </div>
              </div>

              <div className="fpOv-perfControls">
                <div
                  className="fpOv-seg"
                  role="tablist"
                  aria-label="Performance metric"
                >
                  <button
                    type="button"
                    className={`fpOv-segBtn ${perfMetric === "DELIVERED" ? "fpOv-segBtn--active" : ""}`}
                    onClick={() => setPerfMetric("DELIVERED")}
                  >
                    Completed
                  </button>
                  <button
                    type="button"
                    className={`fpOv-segBtn ${perfMetric === "FAILED" ? "fpOv-segBtn--active" : ""}`}
                    onClick={() => setPerfMetric("FAILED")}
                  >
                    Failed
                  </button>
                </div>

                <button
                  className="fpOv-btnSmall"
                  type="button"
                  onClick={() => nav("/dispatcher/deliveries")}
                  title="Open deliveries"
                >
                  View details →
                </button>
              </div>
            </div>

            <div className="fpOv-perfBars">
              {perf.labels.map((label, i) => {
                const v = perf.counts[i];
                const h = Math.max(8, Math.round((v / perf.max) * 100));
                return (
                  <div
                    key={label}
                    className="fpOv-perfCol"
                    title={`${label}: ${v}`}
                  >
                    <div className="fpOv-perfBarTrack">
                      <div
                        className="fpOv-perfBar"
                        style={{ height: `${h}%` }}
                      />
                    </div>
                    <div className="fpOv-perfDay">{label}</div>
                    <div className="fpOv-perfVal">{v}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="fpOv-grid2">
          <div className="fpOv-col">
            {/* Quick actions */}
            <div className="fpOv-sectionCard fpOv-card">
              <div className="fpOv-cardTop">
                <div>
                  <div className="fpOv-cardTitle">Quick actions</div>
                  <div className="fpOv-cardSub">
                    Fast navigation for common tasks
                  </div>
                </div>
              </div>

              <div className="fpOv-actionsGrid">
                <button
                  type="button"
                  className="fpOv-actionBtn fpOv-actionBtn--primary"
                  onClick={() => nav("/dispatcher/create")}
                >
                  + Create Order
                </button>
                <button
                  type="button"
                  className="fpOv-actionBtn"
                  onClick={() =>
                    nav("/dispatcher/deliveries", {
                      state: { tab: "UNASSIGNED" },
                    })
                  }
                >
                  View Unassigned
                </button>
                <button
                  type="button"
                  className="fpOv-actionBtn"
                  onClick={() =>
                    nav("/dispatcher/deliveries", { state: { tab: "FAILED" } })
                  }
                >
                  Review Failed
                </button>
                <button
                  type="button"
                  className="fpOv-actionBtn"
                  onClick={() => nav("/dispatcher/map")}
                >
                  Open Map
                </button>
              </div>
            </div>

            {/* Driver status */}
            <div className="fpOv-sectionCard fpOv-card">
              <div className="fpOv-cardTop">
                <div>
                  <div className="fpOv-cardTitle">Driver status</div>
                  <div className="fpOv-cardSub">
                    Live overview of driver availability
                  </div>
                </div>
              </div>

              <div className="fpOv-kpiGrid">
                <div className="fpOv-kpi">
                  <div className="fpOv-kpiLabel">Available</div>
                  <div className="fpOv-kpiValue">{driverStats.available}</div>
                </div>
                <div className="fpOv-kpi">
                  <div className="fpOv-kpiLabel">Busy</div>
                  <div className="fpOv-kpiValue">{driverStats.busy}</div>
                </div>
                <div className="fpOv-kpi">
                  <div className="fpOv-kpiLabel">Offline</div>
                  <div className="fpOv-kpiValue">{driverStats.offline}</div>
                </div>
              </div>
            </div>

            {/* Live activity */}
            <div className="fpOv-sectionCard fpOv-card">
              <div className="fpOv-cardTop">
                <div>
                  <div className="fpOv-cardTitle">Live activity</div>
                  <div className="fpOv-cardSub">
                    Most recent operational events
                  </div>
                </div>
              </div>

              <div className="fpOv-activity">
                {activity.length === 0 ? (
                  <div className="fpOv-empty">No recent activity yet.</div>
                ) : (
                  activity.map((a, idx) => (
                    <div key={idx} className="fpOv-activityRow">
                      <div className="fpOv-activityDot" aria-hidden="true" />
                      <div className="fpOv-activityMain">
                        <div className="fpOv-activityText">{a.text}</div>
                        <div className="fpOv-activityTime">{a.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Exceptions Inbox */}
            <div className="fpOv-sectionCard fpOv-exceptions">
              <div className="fpOv-sectionHead">
                <div className="fpOv-sectionTitle">
                  Exceptions Inbox
                  <span className="fpOv-tag">Action Needed</span>
                </div>

                <div className="fpOv-excActions">
                  <button
                    className="fpOv-linkBtn"
                    type="button"
                    onClick={() => nav("/dispatcher/deliveries")}
                  >
                    Open deliveries
                  </button>
                  <button
                    className="fpOv-linkBtn"
                    type="button"
                    onClick={() => nav("/dispatcher/drivers")}
                  >
                    Open drivers
                  </button>
                </div>
              </div>

              <div className="fpOv-excBody">
                <div className="fpOv-muted">
                  Review items that may need attention: unassigned orders,
                  failed deliveries, or stale driver pings.
                </div>

                <div className="fpOv-miniGrid fpOv-miniGrid--3">
                  <button
                    type="button"
                    className="fpOv-miniBtn"
                    onClick={() =>
                      nav("/dispatcher/deliveries", {
                        state: { tab: "UNASSIGNED" },
                      })
                    }
                    aria-label="View unassigned deliveries"
                  >
                    <MiniCard
                      title="Unassigned"
                      value={exceptions.unassignedCount}
                      caption="Orders without a driver"
                    />
                  </button>

                  <button
                    type="button"
                    className="fpOv-miniBtn"
                    onClick={() => nav("/dispatcher/deliveries")}
                    aria-label="View failed deliveries"
                  >
                    <MiniCard
                      title="Failed"
                      value={exceptions.failedCount}
                      caption="Needs review / re-attempt"
                      danger
                    />
                  </button>

                  <div className="fpOv-mini fpOv-mini--neutral" role="note">
                    <div className="fpOv-miniTop">
                      <div className="fpOv-miniTitle">Stale pins</div>
                    </div>
                    <div className="fpOv-miniValue">
                      {exceptions.staleDriverCount}
                    </div>
                    <div className="fpOv-miniCaption">
                      Driver pings older than {exceptions.staleMinutesThreshold}{" "}
                      mins
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
