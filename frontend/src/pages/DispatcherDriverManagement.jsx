import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "leaflet/dist/leaflet.css";

import Icon from "../components/dispatcher/Icons";
import SectionHeader from "../components/dispatcher/SectionHeader";
import "../styles/dispatcher-drivers.css";

export default function DispatcherDriverManagement() {
  const nav = useNavigate();

  // horizontal table scroll (drag handle)
  const tableScrollRef = useRef(null);
  const dragStateRef = useRef({ active: false, startX: 0, startLeft: 0 });

  // live GPS polling
  const locPollRef = useRef(null);
  const [driverLocations, setDriverLocations] = useState([]);
  const [locUpdatedAt, setLocUpdatedAt] = useState(null);

  // data
  const [drivers, setDrivers] = useState([]);

  // create user
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");

  // create drawer
  const [createOpen, setCreateOpen] = useState(false);

  // update status
  const [updatingId, setUpdatingId] = useState(null);

  // ui states
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // search + filter
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const STALE_MIN = 10;

  function minsSince(iso) {
    if (!iso) return Infinity;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return Infinity;
    return Math.floor((Date.now() - t) / 60000);
  }

  function ageLabel(mins) {
    if (!Number.isFinite(mins)) return "—";
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    return `${h}h ago`;
  }

  async function loadDrivers() {
    const { data } = await api.get("/admin/drivers");
    setDrivers(data.rows || []);
  }

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      await loadDrivers();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load drivers");
    } finally {
      setLoading(false);
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

  useEffect(() => {
    loadAll();
    loadDriverLocations(true);
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

  async function createDriverUser() {
    setErr("");
    try {
      await api.post("/deliveries/driver-users", {
        name: newName,
        email: newEmail,
        password: newPass,
      });
      setNewName("");
      setNewEmail("");
      setNewPass("");
      setCreateOpen(false);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to create driver user");
    }
  }

  async function updateStatus(driverId, status) {
    setUpdatingId(driverId);
    setErr("");
    try {
      await api.patch(`/admin/drivers/${driverId}`, { status });
      await loadDrivers();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  const locByDriverId = useMemo(() => {
    const map = new Map();
    for (const r of driverLocations || []) {
      const id = r.driver_id ?? r.id;
      if (id == null) continue;
      map.set(String(id), r);
    }
    return map;
  }, [driverLocations]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base = drivers || [];

    const passText = (d) => {
      if (!qq) return true;
      const hay =
        `${d.driver_id} ${d.name} ${d.email} ${d.status}`.toLowerCase();
      return hay.includes(qq);
    };

    const passStatus = (d) => {
      const s = String(d.status || "").toUpperCase();
      if (statusFilter === "ALL") return true;
      if (statusFilter === "ACTIVE") return s === "AVAILABLE";
      if (statusFilter === "BUSY") return s === "BUSY";
      if (statusFilter === "OFFLINE") return s !== "AVAILABLE" && s !== "BUSY";
      if (statusFilter === "STALE") {
        const loc = locByDriverId.get(String(d.driver_id));
        const mins = minsSince(loc?.updated_at);
        const hasLoc = loc?.lat != null && loc?.lng != null;
        return hasLoc && mins >= STALE_MIN;
      }
      return true;
    };

    return base.filter((d) => passText(d) && passStatus(d));
  }, [drivers, q, statusFilter, locByDriverId]);

  function badgeFor(status) {
    const s = String(status || "").toUpperCase();
    if (s === "AVAILABLE")
      return { cls: "fp-pill fp-pill-ok", label: "Active" };
    if (s === "BUSY") return { cls: "fp-pill fp-pill-warn", label: "Busy" };
    return { cls: "fp-pill fp-pill-bad", label: "Inactive" };
  }

  const canCreateUser = !!newName && !!newEmail && !!newPass;

  function onDragBarPointerDown(e) {
    const scroller = tableScrollRef.current;
    if (!scroller) return;

    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startLeft: scroller.scrollLeft,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function onDragBarPointerMove(e) {
    const scroller = tableScrollRef.current;
    const st = dragStateRef.current;
    if (!scroller || !st.active) return;

    const dx = e.clientX - st.startX;
    scroller.scrollLeft = st.startLeft - dx;
  }

  function onDragBarPointerUp(e) {
    dragStateRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  return (
    <div className="fpOv-page">
      <div className="fpOv-mainCard">
          <SectionHeader
            title="Driver Management"
            subtitle="Create driver users, update availability, and manage live GPS operations."
            right={
              <div className="fpDrv-topActions">
                <button
                  className="fp-btn fp-btn-ghost"
                  type="button"
                  onClick={() => nav("/dispatcher/drivers")}
                  title="Back to Drivers overview"
                >
                  <Icon name="arrowLeft" />
                  Back
                </button>

                <button
                  className="fp-btn fp-btn-ghost"
                  type="button"
                  onClick={() => setCreateOpen(true)}
                >
                  <Icon name="plus" />
                  Create Driver
                </button>

                <button
                  className="fp-btn fp-btn-solid"
                  type="button"
                  onClick={() => {
                    loadAll();
                    loadDriverLocations(false);
                  }}
                  disabled={loading}
                >
                  <Icon name="refresh" />
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            }
          />

          {err ? (
            <div
              className="fp-alert fpDrv-alert"
              role="alert"
              aria-live="polite"
            >
              <span className="fp-alertIcon" aria-hidden="true">
                <Icon name="alert" />
              </span>
              <div>{err}</div>
            </div>
          ) : null}

          <div className="fpDrv-mainGrid fpDrv-mainGrid--clean">
            {/* MAIN */}
            <div className="fpDrv-card">
              <div className="fpDrv-cardHeader fpDrv-cardHeader--premium">
                <div className="fpDrv-cardHeadLeft">
                  <div className="fpDrv-cardTitle">Drivers</div>
                  <div className="fpDrv-cardSub">
                    Status + live GPS. Use filters to find stale pins and update
                    driver availability.
                  </div>
                </div>

                <div className="fpDrv-toolbar">
                  <div
                    className="fpDrv-tabs fpDrv-tabs--premium"
                    role="tablist"
                    aria-label="Driver filters"
                  >
                    <button
                      type="button"
                      className={`fpDrv-tab ${statusFilter === "ALL" ? "fpDrv-tab--active" : ""}`}
                      onClick={() => setStatusFilter("ALL")}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`fpDrv-tab ${statusFilter === "ACTIVE" ? "fpDrv-tab--active" : ""}`}
                      onClick={() => setStatusFilter("ACTIVE")}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className={`fpDrv-tab ${statusFilter === "BUSY" ? "fpDrv-tab--active" : ""}`}
                      onClick={() => setStatusFilter("BUSY")}
                    >
                      Busy
                    </button>
                    <button
                      type="button"
                      className={`fpDrv-tab ${statusFilter === "OFFLINE" ? "fpDrv-tab--active" : ""}`}
                      onClick={() => setStatusFilter("OFFLINE")}
                    >
                      Offline
                    </button>
                    <button
                      type="button"
                      className={`fpDrv-tab ${statusFilter === "STALE" ? "fpDrv-tab--active" : ""}`}
                      onClick={() => setStatusFilter("STALE")}
                      title={`GPS older than ${STALE_MIN} mins`}
                    >
                      Stale GPS
                    </button>
                  </div>

                  <div className="fpDrv-search fpDrv-search--premium">
                    <span className="fpDrv-searchIcon" aria-hidden="true">
                      <Icon name="search" />
                    </span>
                    <input
                      className="fpDrv-searchInput"
                      placeholder="Search name, email, ID…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                    {q ? (
                      <button
                        type="button"
                        className="fpDrv-clearBtn"
                        onClick={() => setQ("")}
                        aria-label="Clear search"
                        title="Clear"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="fpDrv-tableWrap fpDrv-tableWrap--premium">
                <div
                  className="fpDrv-tableScroll fpDrv-tableScroll--premium"
                  ref={tableScrollRef}
                >
                  <table className="fpDrv-table fpDrv-table--premium">
                    <thead>
                      <tr>
                        <th style={{ width: 110 }}>Driver ID</th>
                        <th style={{ width: 210 }}>Name</th>
                        <th style={{ width: 280 }}>Email</th>
                        <th style={{ width: 140 }}>Status</th>
                        <th style={{ width: 170 }}>Live GPS</th>
                        <th style={{ width: 360 }}>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map((d) => {
                        const disabled = updatingId === d.driver_id;
                        const b = badgeFor(d.status);

                        const loc = locByDriverId.get(String(d.driver_id));
                        const mins = minsSince(loc?.updated_at);
                        const stale = mins >= STALE_MIN;
                        const hasLoc = loc?.lat != null && loc?.lng != null;

                        return (
                          <tr key={d.driver_id}>
                            <td>{d.driver_id}</td>
                            <td style={{ fontWeight: 900 }}>{d.name || "—"}</td>
                            <td className="fpDrv-email">
                              {d.email ? (
                                <a
                                  href={`mailto:${d.email}`}
                                  className="fpDrv-emailLink"
                                >
                                  {d.email}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td>
                              <span className={b.cls}>{b.label}</span>
                            </td>

                            <td>
                              {hasLoc ? (
                                <span
                                  className={
                                    stale
                                      ? "fp-pill fp-pill-warn"
                                      : "fp-pill fp-pill-info"
                                  }
                                  title={
                                    loc?.updated_at
                                      ? `Last update: ${new Date(loc.updated_at).toLocaleString()}`
                                      : ""
                                  }
                                >
                                  {ageLabel(mins)}
                                </span>
                              ) : (
                                <span className="fp-pill fp-pill-bad">
                                  No GPS
                                </span>
                              )}
                            </td>

                            <td>
                              <div className="fpDrv-actionRow fpDrv-actionRow--premium">
                                <button
                                  className="fpDrv-actionBtn fpDrv-actionBtn--ok"
                                  disabled={disabled}
                                  onClick={() =>
                                    updateStatus(d.driver_id, "AVAILABLE")
                                  }
                                >
                                  {disabled ? "Updating…" : "Set Active"}
                                </button>

                                <button
                                  className="fpDrv-actionBtn fpDrv-actionBtn--warn"
                                  disabled={disabled}
                                  onClick={() =>
                                    updateStatus(d.driver_id, "BUSY")
                                  }
                                >
                                  {disabled ? "Updating…" : "Set Busy"}
                                </button>

                                <button
                                  className="fpDrv-actionBtn fpDrv-actionBtn--muted"
                                  disabled={disabled}
                                  onClick={() =>
                                    updateStatus(d.driver_id, "OFFLINE")
                                  }
                                >
                                  {disabled ? "Updating…" : "Set Inactive"}
                                </button>

                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            <div className="fpDrv-empty">
                              <div className="fpDrv-emptyTitle">
                                No drivers found
                              </div>
                              <div className="fpDrv-emptySub">
                                Try a different search.
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div
                  className="fpDrv-dragBar"
                  role="scrollbar"
                  aria-label="Scroll table horizontally"
                  tabIndex={0}
                  onPointerDown={onDragBarPointerDown}
                  onPointerMove={onDragBarPointerMove}
                  onPointerUp={onDragBarPointerUp}
                  onPointerCancel={onDragBarPointerUp}
                />
              </div>

              <div className="fpDrv-footerMeta">
                Showing <b>{filtered.length}</b> of <b>{drivers.length}</b>{" "}
                drivers
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

          {/* Create Driver Drawer */}
          {createOpen ? (
            <div
              className="fpDrv-drawerOverlay"
              role="dialog"
              aria-modal="true"
            >
              <button
                type="button"
                className="fpDrv-drawerBackdrop"
                aria-label="Close"
                onClick={() => setCreateOpen(false)}
              />

              <div className="fpDrv-drawer">
                <div className="fpDrv-drawerTop">
                  <div>
                    <div className="fpDrv-drawerTitle">
                      Create Driver Account
                    </div>
                    <div className="fpDrv-drawerSub">
                      Creates a login account (User) that can be linked to a
                      Driver record.
                    </div>
                  </div>

                  <button
                    type="button"
                    className="fpDrv-drawerClose"
                    onClick={() => setCreateOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="fpDrv-formGrid fpDrv-formGrid--drawer">
                  <div className="fpDrv-field">
                    <div className="fpDrv-label">Name</div>
                    <input
                      className="fpDrv-input"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Driver Name"
                    />
                  </div>

                  <div className="fpDrv-field">
                    <div className="fpDrv-label">Email</div>
                    <input
                      className="fpDrv-input"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="driver@email.com"
                    />
                  </div>

                  <div className="fpDrv-field">
                    <div className="fpDrv-label">Password</div>
                    <input
                      className="fpDrv-input"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="••••••••"
                      type="password"
                    />
                  </div>
                </div>

                <div className="fpDrv-drawerActions">
                  <button
                    type="button"
                    className="fp-btn fp-btn-ghost"
                    onClick={() => {
                      setNewName("");
                      setNewEmail("");
                      setNewPass("");
                      setCreateOpen(false);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="fpDrv-primaryBtn"
                    onClick={createDriverUser}
                    disabled={!canCreateUser}
                  >
                    Create Driver User
                  </button>
                </div>

                <div className="fpDrv-drawerFoot">
                  <span className="fp-muted">
                    Tip: After creating the user, refresh if you don’t see the
                    account immediately.
                  </span>
                </div>
              </div>
            </div>
          ) : null}
      </div>
    </div>
  );
}
