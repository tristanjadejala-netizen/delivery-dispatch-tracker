import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function DriverProfile() {
  const nav = useNavigate();

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadMe() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/auth/me");
      setMe(data);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    nav("/login", { replace: true });
  }

  const styles = {
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 14,
    },
    brand: { display: "flex", alignItems: "center", gap: 10 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 16,
      background:
        "linear-gradient(135deg, rgba(0,112,255,0.95) 0%, rgba(11,59,143,0.95) 60%, rgba(255,126,24,0.90) 120%)",
      boxShadow: "0 14px 28px rgba(11,18,32,0.18)",
      display: "grid",
      placeItems: "center",
      color: "white",
      fontWeight: 1000,
    },
    title: { margin: 0, fontSize: 18, fontWeight: 1000, letterSpacing: -0.2 },
    sub: { marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 700 },
    pillBtn: {
      height: 36,
      padding: "0 12px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.10)",
      background: "rgba(255,255,255,0.9)",
      boxShadow: "0 10px 24px rgba(11,18,32,0.10)",
      fontWeight: 900,
      cursor: "pointer",
    },
    alert: {
      background: "rgba(255,255,255,0.92)",
      border: "1px solid rgba(239,68,68,0.25)",
      color: "#991b1b",
      padding: 12,
      borderRadius: 14,
      marginBottom: 12,
      fontSize: 12,
      fontWeight: 900,
    },
    card: {
      borderRadius: 18,
      background: "rgba(255,255,255,0.92)",
      border: "1px solid rgba(15,23,42,0.08)",
      boxShadow: "0 16px 34px rgba(11,18,32,0.12)",
      padding: 14,
    },
    row: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      padding: "10px 0",
      borderTop: "1px solid rgba(15,23,42,0.08)",
      fontSize: 13,
      fontWeight: 800,
      color: "#0f172a",
    },
    label: { color: "#64748b", fontWeight: 900 },
    actions: { marginTop: 12, display: "grid", gap: 10 },
    danger: {
      height: 44,
      borderRadius: 14,
      border: "1px solid rgba(239,68,68,0.25)",
      background: "linear-gradient(180deg, rgba(239,68,68,0.95) 0%, rgba(185,28,28,0.95) 100%)",
      color: "white",
      fontWeight: 1000,
      cursor: "pointer",
      boxShadow: "0 14px 28px rgba(11,18,32,0.18)",
    },
  };

  const initials = (me?.name || "D").trim().slice(0, 1).toUpperCase();

  return (
    <div>
      <div style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.avatar} aria-hidden="true">
            {initials}
          </div>
          <div>
            <h1 style={styles.title}>Profile</h1>
            <div style={styles.sub}>Driver account information</div>
          </div>
        </div>

        <button type="button" style={styles.pillBtn} onClick={loadMe} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err ? <div style={styles.alert}>{err}</div> : null}

      <div style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 1000, marginBottom: 8 }}>Account</div>

        <div style={styles.row}>
          <div style={styles.label}>Name</div>
          <div>{me?.name || "—"}</div>
        </div>

        <div style={styles.row}>
          <div style={styles.label}>Email</div>
          <div>{me?.email || "—"}</div>
        </div>

        <div style={styles.row}>
          <div style={styles.label}>Role</div>
          <div>{me?.role || "DRIVER"}</div>
        </div>

        <div style={styles.actions}>
          <button type="button" style={styles.danger} onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
