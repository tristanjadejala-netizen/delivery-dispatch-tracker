import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "leaflet/dist/leaflet.css";

import DashboardHeader from "../components/dispatcher/DashboardHeader";
import StatsGrid from "../components/dispatcher/StatsGrid";
import ControlsPanel from "../components/dispatcher/ControlsPanel";
import StatusTabs from "../components/dispatcher/StatusTabs";
import DeliveryCard from "../components/dispatcher/DeliveryCard";
import Icon from "../components/dispatcher/Icons";
import SectionHeader from "../components/dispatcher/SectionHeader";

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const STATUS_TABS = ["ALL", "UNASSIGNED", "ACTIVE", "DELIVERED", "FAILED"];

function fmt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function DispatcherDashboard() {
  const nav = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState("ALL");
  const [q, setQ] = useState("");

  const [deliveries, setDeliveries] = useState([]);
  const [total, setTotal] = useState(0);
  const [drivers, setDrivers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [driverPick, setDriverPick] = useState({});
  const [assigningId, setAssigningId] = useState(null);

  const [deletingId, setDeletingId] = useState(null);

  const [openTimeline, setOpenTimeline] = useState({});
  const [eventsByDelivery, setEventsByDelivery] = useState({});
  const [loadingEventsId, setLoadingEventsId] = useState(null);

  const [openPod, setOpenPod] = useState({});
  const [podByDelivery, setPodByDelivery] = useState({});
  const [loadingPodId, setLoadingPodId] = useState(null);

  const [openFailure, setOpenFailure] = useState({});
  const [failureByDelivery, setFailureByDelivery] = useState({});
  const [loadingFailureId, setLoadingFailureId] = useState(null);

  // Auto-refresh (frontend only)
  const [autoRefreshSec, setAutoRefreshSec] = useState(0); // 0 = off
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const refreshTimer = useRef(null);

  // ✅ Bulk select + bulk assign
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDriverId, setBulkDriverId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Map UI tabs to a safe server-side filter.
  // We only send strict statuses the backend is very likely to accept;
  // "ACTIVE" and "UNASSIGNED" are derived client-side.
  const serverStatusForTab = (t) => {
    if (t === "DELIVERED") return "DELIVERED";
    if (t === "FAILED") return "FAILED";
    return "ALL"; // ALL / ACTIVE / UNASSIGNED all request ALL from server
  };

  async function loadDeliveries(nextTab = tab) {
    const { data } = await api.get("/deliveries", {
      params: {
        status: serverStatusForTab(nextTab),
        q: q || "",
        limit: 50,
        offset: 0,
      },
    });

    setDeliveries(data.rows || []);
    setTotal(data.total || 0);

    // Keep driver dropdown prefilled when already assigned
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

  async function hardRefresh() {
    setLoading(true);
    setErr("");
    try {
      await Promise.all([loadDeliveries(tab), loadDrivers()]);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e) {x
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Failed to refresh"
      );
    } finally {
      setLoading(false);
    }
  }

  async function softRefresh() {
    try {
      await loadDeliveries(tab);
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      // silent on auto-refresh
    }
  }

  useEffect(() => {
    hardRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (location.pathname === "/dispatcher") {
      loadDeliveries(tab).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
    if (!autoRefreshSec) return;

    refreshTimer.current = setInterval(() => {
      softRefresh();
    }, autoRefreshSec * 1000);

    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshSec]);

  const filtered = useMemo(() => {
    const rows = deliveries || [];

    const byTab = rows.filter((d) => {
      if (tab === "ALL") return true;

      if (tab === "UNASSIGNED") {
        // ✅ unassigned = no assigned_driver_id (null/undefined/0/"")
        return !d.assigned_driver_id;
      }

      if (tab === "DELIVERED") return d.status === "DELIVERED";
      if (tab === "FAILED") return d.status === "FAILED";

      // ACTIVE = anything not terminal
      return !["DELIVERED", "FAILED", "CANCELLED"].includes(d.status);
    });

    const qq = q.trim().toLowerCase();
    if (!qq) return byTab;

    return byTab.filter((d) => {
      const hay =
        `${d.reference_no} ${d.customer_name} ${d.pickup_address} ${d.dropoff_address}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [deliveries, tab, q]);

  const stats = useMemo(() => {
    const rows = deliveries || [];
    const active = rows.filter(
      (d) => !["DELIVERED", "FAILED", "CANCELLED"].includes(d.status)
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
        !d.assigned_driver_id
    );
    const failed = rows.filter((d) => d.status === "FAILED");

    return {
      unassignedCount: unassigned.length,
      failedCount: failed.length,
      staleDriverCount: 0,
      staleMinutesThreshold: 10,
    };
  }, [deliveries]);

  // ✅ Keep selection clean when list changes (remove IDs not in current dataset)
  useEffect(() => {
    const allIds = new Set((deliveries || []).map((d) => d.id));
    setSelectedIds((prev) => {
      const next = new Set();
      for (const id of prev) if (allIds.has(id)) next.add(id);
      return next;
    });
  }, [deliveries]);

  function toggleSelectOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const d of filtered) next.add(d.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedCount = selectedIds.size;

  // ✅ Make tab buttons functional:
  function handleTabChange(next) {
    setTab(next);
    clearSelection();

    setOpenTimeline({});
    setOpenPod({});
    setOpenFailure({});

    loadDeliveries(next).catch(() => {});
  }

  useEffect(() => {
  const requestedTab = location.state?.tab;

  if (!requestedTab) return;

  // only act if it's a valid tab and it's different
  if (STATUS_TABS.includes(requestedTab) && requestedTab !== tab) {
    handleTabChange(requestedTab);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.state]);


  async function bulkAssign() {
    if (!bulkDriverId) {
      alert("Select a driver for bulk assign first.");
      return;
    }
    if (selectedCount === 0) {
      alert("Select at least one delivery.");
      return;
    }

    const ids = Array.from(selectedIds);

    setBulkAssigning(true);
    setErr("");

    const failedIds = [];
    for (const id of ids) {
      try {
        await api.post(`/deliveries/${id}/assign`, {
          driver_id: Number(bulkDriverId),
        });
      } catch {
        failedIds.push(id);
      }
    }

    try {
      await loadDeliveries(tab);
    } catch {
      // ignore
    } finally {
      setBulkAssigning(false);
    }

    if (failedIds.length) {
      setErr(
        `Bulk assign completed with ${failedIds.length} failures. (IDs: ${failedIds.join(
          ", "
        )})`
      );
    } else {
      clearSelection();
    }
  }

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
      await loadDeliveries(tab);
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Assign failed"
      );
    } finally {
      setAssigningId(null);
    }
  }

  async function deleteDelivery(delivery) {
    const ok = window.confirm(
      `Delete order ${delivery.reference_no}?\n\nThis cannot be undone.`
    );
    if (!ok) return;

    setDeletingId(delivery.id);
    setErr("");
    try {
      await api.delete(`/deliveries/${delivery.id}`);
      await loadDeliveries(tab);
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Delete failed"
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleTimeline(deliveryId) {
    const isOpen = !!openTimeline[deliveryId];
    setOpenTimeline((p) => ({ ...p, [deliveryId]: !isOpen }));
    if (isOpen) return;

    if (eventsByDelivery[deliveryId]) return;
    setLoadingEventsId(deliveryId);
    setErr("");
    try {
      const { data } = await api.get(`/deliveries/${deliveryId}/events`);
      setEventsByDelivery((p) => ({ ...p, [deliveryId]: data.rows || [] }));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load timeline");
    } finally {
      setLoadingEventsId(null);
    }
  }

  async function togglePod(deliveryId) {
    const isOpen = !!openPod[deliveryId];
    setOpenPod((p) => ({ ...p, [deliveryId]: !isOpen }));
    if (isOpen) return;

    if (podByDelivery[deliveryId] !== undefined) return;

    setLoadingPodId(deliveryId);
    setErr("");
    try {
      const { data } = await api.get(`/deliveries/${deliveryId}/pod`);
      setPodByDelivery((p) => ({ ...p, [deliveryId]: data }));
    } catch {
      setPodByDelivery((p) => ({ ...p, [deliveryId]: null }));
    } finally {
      setLoadingPodId(null);
    }
  }

  async function toggleFailure(deliveryId) {
    const isOpen = !!openFailure[deliveryId];
    setOpenFailure((p) => ({ ...p, [deliveryId]: !isOpen }));
    if (isOpen) return;

    if (failureByDelivery[deliveryId] !== undefined) return;

    setLoadingFailureId(deliveryId);
    setErr("");
    try {
      const { data } = await api.get(`/deliveries/${deliveryId}/failure`);
      setFailureByDelivery((p) => ({ ...p, [deliveryId]: data }));
    } catch {
      setFailureByDelivery((p) => ({ ...p, [deliveryId]: null }));
    } finally {
      setLoadingFailureId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* ✅ KEEP THESE TOP TABS (Overview/Deliveries/Reports/Drivers/Map) */}
      <SectionHeader
        title="Deliveries"
        subtitle="Manage assignments, verify POD, and review failed deliveries."
      />
      <div className="fp-page">
        <div className="fp-container">
          {err ? (
            <div className="fp-alert" role="alert" aria-live="polite">
              <span className="fp-alertIcon" aria-hidden="true">
                <Icon name="alert" />
              </span>
              <div>{err}</div>
            </div>
          ) : null}

          <StatsGrid stats={stats} />

          <ControlsPanel q={q} setQ={setQ} />

          {/* ✅ Tabs now include UNASSIGNED */}
          <StatusTabs tabs={STATUS_TABS} tab={tab} setTab={handleTabChange} />

          {/* ✅ Bulk action bar */}
          <div className="fp-bulkBar">
            <div className="fp-bulkLeft">
              <div className="fp-bulkTitle">
                Bulk actions
                <span className="fp-pill" style={{ marginLeft: 8 }}>
                  Selected: {selectedCount}
                </span>
              </div>
              <div className="fp-bulkBtns">
                <button
                  className="fp-btn2"
                  onClick={selectAllFiltered}
                  disabled={filtered.length === 0}
                >
                  Select all in view
                </button>
                <button
                  className="fp-btn2"
                  onClick={clearSelection}
                  disabled={selectedCount === 0}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="fp-bulkRight">
              <select
                className="fp-select"
                value={bulkDriverId}
                onChange={(e) => setBulkDriverId(e.target.value)}
                disabled={drivers.length === 0}
              >
                <option value="">Select driver for bulk assign…</option>
                {drivers.map((dr) => (
                  <option key={dr.driver_id} value={dr.driver_id}>
                    {dr.name} ({dr.status})
                  </option>
                ))}
              </select>

              <button
                className="fp-btn2 fp-btn2-primary"
                onClick={bulkAssign}
                disabled={bulkAssigning || !bulkDriverId || selectedCount === 0}
                title={!selectedCount ? "Select deliveries first" : ""}
              >
                <Icon name="route" size={16} />
                {bulkAssigning ? "Assigning…" : "Bulk Assign"}
              </button>
            </div>
          </div>

          <div className="fp-count">
            Showing <b className="fp-strong">{filtered.length}</b> of{" "}
            <b className="fp-strong">{deliveries.length}</b> deliveries.
            {total ? (
              <span className="fp-countMeta">(Server total: {total})</span>
            ) : null}
          </div>

          <div className="fp-list">
            {filtered.map((d) => (
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
                onDelete={() => deleteDelivery(d)}
                deletingId={deletingId}
                toggleTimeline={() => toggleTimeline(d.id)}
                openTimeline={!!openTimeline[d.id]}
                events={eventsByDelivery[d.id] || []}
                loadingEventsId={loadingEventsId}
                togglePod={() => togglePod(d.id)}
                openPod={!!openPod[d.id]}
                pod={podByDelivery[d.id]}
                loadingPodId={loadingPodId}
                toggleFailure={() => toggleFailure(d.id)}
                openFailure={!!openFailure[d.id]}
                failure={failureByDelivery[d.id]}
                loadingFailureId={loadingFailureId}
                fmt={fmt}
                API_BASE={API_BASE}
                selected={selectedIds.has(d.id)}
                onToggleSelect={() => toggleSelectOne(d.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
