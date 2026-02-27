import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "../styles/fastpass-dispatcher-shell.css";
import "../styles/dispatcher-overview.css";

import Icon from "../components/dispatcher/Icons";

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

export default function DispatcherNotifications() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [items, setItems] = useState([]);

  async function load() {
    try {
      setLoading(true);
      setErr("");

      const res = await api.get("/notifications", { params: { limit: 200 } });
      setItems(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await api.post("/notifications/mark-all-read");
      setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to mark all as read");
    }
  }

  async function markOneRead(id) {
    if (!id) return;
    try {
      await api.post(`/notifications/${id}/read`);
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
              <button
                type="button"
                className={"fpsNotif-tab" + (tab === "All" ? " is-active" : "")}
                onClick={() => setActiveTab("All")}
                role="tab"
                aria-selected={tab === "All"}
              >
                All
              </button>
              <button
                type="button"
                className={"fpsNotif-tab" + (tab === "Orders" ? " is-active" : "")}
                onClick={() => setActiveTab("Orders")}
                role="tab"
                aria-selected={tab === "Orders"}
              >
                Orders
              </button>
              <button
                type="button"
                className={"fpsNotif-tab" + (tab === "Drivers" ? " is-active" : "")}
                onClick={() => setActiveTab("Drivers")}
                role="tab"
                aria-selected={tab === "Drivers"}
              >
                <span className="fpsNotif-tabIcon" aria-hidden="true">
                  <Icon name="truck" size={16} />
                </span>
                Drivers
              </button>
              <button
                type="button"
                className={"fpsNotif-tab" + (tab === "System" ? " is-active" : "")}
                onClick={() => setActiveTab("System")}
                role="tab"
                aria-selected={tab === "System"}
              >
                System
              </button>
            </div>

            <button type="button" className="fpsNotif-markBtn" onClick={markAllRead}>
              Mark all as read
            </button>
          </div>
        </div>

        <div className="fpsNotif-listCard" role="region" aria-label="Notification list">
          {err ? (
            <div style={{ padding: 12, color: "#b91c1c", fontWeight: 800 }}>{err}</div>
          ) : null}

          {loading ? (
            <div style={{ padding: 16, color: "var(--fp-muted)", fontWeight: 800 }}>Loading…</div>
          ) : null}

          {!loading && paged.length === 0 ? (
            <div style={{ padding: 16, color: "var(--fp-muted)", fontWeight: 800 }}>
              No notifications.
            </div>
          ) : null}

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
                      <strong>{n.title}</strong> {n.message}
                    </div>
                    <div className="fpsNotif-time">{minsAgoLabel(n.created_at)}</div>
                  </div>
                </div>

                <div className="fpsNotif-itemRight">
                  {n.unread ? <span className="fpsNotif-unreadDot" aria-label="Unread" /> : null}
                </div>
              </div>
            );
          })}

          <div className="fpsNotif-footer">
            <div className="fpsNotif-footerLeft">
              Showing <strong>{total === 0 ? 0 : (safePage - 1) * pageSize + 1}</strong> to{" "}
              <strong>{Math.min(safePage * pageSize, total)}</strong> of <strong>{total}</strong> total
            </div>

            <div className="fpsNotif-footerRight">
              <button
                type="button"
                className="fpsNotif-pageBtn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="fpsNotif-pageBtn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
