import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

// ✅ UI separated from logic (FastPass styling lives in CSS)
import "../styles/fastpass-admindrivers.css";

export default function AdminDrivers() {
  const nav = useNavigate();

  // data
  const [drivers, setDrivers] = useState([]);
  const [driverUsers, setDriverUsers] = useState([]);

  // ui state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // create DRIVER user
  const [newName, setNewName] = useState("Driver Two");
  const [newEmail, setNewEmail] = useState("driver2@test.com");
  const [newPass, setNewPass] = useState("driver123");
  const [creatingUser, setCreatingUser] = useState(false);

  // create driver profile (drivers table)
  const [selectedUserId, setSelectedUserId] = useState("");
  const [createStatus, setCreateStatus] = useState("AVAILABLE"); // DB-valid
  const [addingDriver, setAddingDriver] = useState(false);

  // update status
  const [updatingId, setUpdatingId] = useState(null);

  // search
  const [q, setQ] = useState("");

  async function loadAll() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const [a, b] = await Promise.all([
        api.get("/admin/drivers"),
        api.get("/admin/driver-users"),
      ]);
      setDrivers(a.data.rows || []);
      setDriverUsers(b.data.rows || []);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.response?.data?.error || "Server error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = drivers.length;
    const active = drivers.filter((d) => d.status !== "OFFLINE").length; // AVAILABLE or BUSY
    const inactive = drivers.filter((d) => d.status === "OFFLINE").length;
    return { total, active, inactive };
  }, [drivers]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return drivers;
    return drivers.filter((d) => {
      const hay = `${d.driver_id} ${d.user_id} ${d.status} ${d.name || ""} ${d.email || ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [drivers, q]);

  function badgeFor(status) {
    const s = String(status || "").toUpperCase();
    if (s === "AVAILABLE") return { bg: "#E8FFF3", fg: "#0E7A3B", border: "#96E7B9", label: "ACTIVE" };
    if (s === "BUSY") return { bg: "#FFF7E6", fg: "#8A5A00", border: "#FFD48A", label: "BUSY" };
    return { bg: "#F1F5F9", fg: "#334155", border: "#CBD5E1", label: "INACTIVE" }; // OFFLINE
  }

  async function createDriverUser() {
    setCreatingUser(true);
    setErr("");
    setOk("");
    try {
      const payload = { name: newName, email: newEmail, password: newPass };
      await api.post("/admin/users/driver", payload);
      setOk("DRIVER account created.");
      setNewName("");
      setNewEmail("");
      setNewPass("");
      await loadAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.response?.data?.error || "Create user failed");
    } finally {
      setCreatingUser(false);
    }
  }

  async function addDriverProfile() {
    if (!selectedUserId) {
      setErr("Please select a DRIVER user first.");
      return;
    }

    setAddingDriver(true);
    setErr("");
    setOk("");

    try {
      await api.post("/admin/drivers", {
        user_id: Number(selectedUserId),
        status: createStatus, // AVAILABLE / BUSY / OFFLINE
      });

      setOk("Driver profile added.");
      setSelectedUserId("");
      setCreateStatus("AVAILABLE");
      await loadAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.response?.data?.error || "Add driver failed");
    } finally {
      setAddingDriver(false);
    }
  }

  async function updateStatus(driverId, status) {
    setUpdatingId(driverId);
    setErr("");
    setOk("");

    try {
      await api.patch(`/admin/drivers/${driverId}`, { status }); // AVAILABLE/OFFLINE/BUSY
      setOk("Driver status updated.");
      await loadAll();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.response?.data?.error || "Update status failed");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="fp-page">
      <div className="fp-container">
        {/* Header */}
        <div className="fp-header">
          <div>
            <h1 className="fp-title">Admin — Drivers</h1>
            <div className="fp-subtitle">Create driver accounts and manage driver availability.</div>
          </div>

          <div className="fp-headerActions">
            <button className="fp-btn fp-btnGhost" onClick={() => nav(-1)}>
              ← Back
            </button>
            <button className="fp-btn fp-btnPrimary" onClick={loadAll} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Alerts */}
        {err ? <div className="fp-alert fp-alertDanger">{err}</div> : null}
        {ok ? <div className="fp-alert fp-alertOk">{ok}</div> : null}

        {/* Stats */}
        <div className="fp-statsGrid">
          <div className="fp-statCard">
            <div className="fp-statLabel">Total Drivers</div>
            <div className="fp-statValue">{stats.total}</div>
          </div>
          <div className="fp-statCard">
            <div className="fp-statLabel">Active</div>
            <div className="fp-statValue">{stats.active}</div>
          </div>
          <div className="fp-statCard">
            <div className="fp-statLabel">Inactive</div>
            <div className="fp-statValue">{stats.inactive}</div>
          </div>
        </div>

        {/* Main Card */}
        <div className="fp-card">
          {/* Create DRIVER account */}
          <div className="fp-sectionTitle">Create DRIVER Account (User)</div>
          <div className="fp-grid3">
            <div>
              <div className="fp-label">Name</div>
              <input
                className="fp-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Driver Three"
              />
            </div>

            <div>
              <div className="fp-label">Email</div>
              <input
                className="fp-input"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g., driver3@test.com"
              />
            </div>

            <div>
              <div className="fp-label">Temporary Password</div>
              <input
                className="fp-input"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="e.g., driver123"
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button className="fp-btn fp-btnPrimary" onClick={createDriverUser} disabled={creatingUser}>
              {creatingUser ? "Creating..." : "Create DRIVER Account"}
            </button>
          </div>

          <div className="fp-hr" />

          {/* Create Driver Profile */}
          <div className="fp-sectionTitle">Create Driver Profile (Drivers Table)</div>

          <div className="fp-grid3">
            <div>
              <div className="fp-label">Select Driver User</div>
              <select
                className="fp-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">Choose a DRIVER account…</option>
                {driverUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    #{u.id} — {u.name} • {u.email}
                  </option>
                ))}
              </select>

              <div className="fp-helper">
                This list only shows DRIVER users that are not yet in the drivers table.
              </div>
            </div>

            <div>
              <div className="fp-label">Status</div>
              <select
                className="fp-select"
                value={createStatus}
                onChange={(e) => setCreateStatus(e.target.value)}
              >
                <option value="AVAILABLE">ACTIVE (Available)</option>
                <option value="BUSY">BUSY</option>
                <option value="OFFLINE">INACTIVE (Offline)</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "end", justifyContent: "flex-end" }}>
              <button className="fp-btn fp-btnSecondary" onClick={addDriverProfile} disabled={addingDriver}>
                {addingDriver ? "Adding..." : "Add Driver"}
              </button>
            </div>
          </div>

          <div className="fp-hr" />

          {/* Existing Drivers */}
          <div className="fp-rowBetween">
            <div className="fp-sectionTitle" style={{ marginBottom: 0 }}>
              Existing Drivers
            </div>

            <input
              className="fp-input"
              style={{ maxWidth: 420 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search: driver id, user id, status, name, email…"
            />
          </div>

          <div className="fp-tableWrap">
            <table className="fp-table">
              <thead>
                <tr>
                  <th className="fp-th">Driver ID</th>
                  <th className="fp-th">User ID</th>
                  <th className="fp-th">Name</th>
                  <th className="fp-th">Email</th>
                  <th className="fp-th">Status</th>
                  <th className="fp-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const b = badgeFor(d.status);
                  const disabled = updatingId === d.driver_id;

                  return (
                    <tr key={d.driver_id}>
                      <td className="fp-td">{d.driver_id}</td>
                      <td className="fp-td">{d.user_id}</td>
                      <td className="fp-td">
                        <b>{d.name}</b>
                      </td>
                      <td className="fp-td">{d.email}</td>
                      <td className="fp-td">
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontWeight: 800,
                            fontSize: 12,
                            background: b.bg,
                            color: b.fg,
                            border: `1px solid ${b.border}`,
                          }}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="fp-td">
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="fp-btn fp-btnGhost"
                            disabled={disabled}
                            onClick={() => updateStatus(d.driver_id, "AVAILABLE")}
                          >
                            {disabled ? "Updating..." : "Set ACTIVE"}
                          </button>

                          <button
                            className="fp-btn fp-btnGhost"
                            disabled={disabled}
                            onClick={() => updateStatus(d.driver_id, "OFFLINE")}
                          >
                            {disabled ? "Updating..." : "Set INACTIVE"}
                          </button>

                          <button
                            className="fp-btn fp-btnGhost"
                            disabled={disabled}
                            onClick={() => updateStatus(d.driver_id, "BUSY")}
                          >
                            {disabled ? "Updating..." : "Set BUSY"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td className="fp-td" colSpan={6}>
                      No drivers found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="fp-footerNote">
            Showing {filtered.length} of {drivers.length} drivers.
          </div>
        </div>
      </div>
    </div>
  );
}
