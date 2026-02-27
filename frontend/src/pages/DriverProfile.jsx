import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css"; // for existing modal/form controls

import { IconChevronRight } from "../components/driver/DriverIcons";

function safe(v, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function splitName(full = "") {
  const t = (full || "").trim().replace(/\s+/g, " ");
  if (!t) return { firstName: "", lastName: "" };
  const parts = t.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.slice(-1).join(" ") };
}

function resolveAssetUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^(blob:|data:|https?:\/\/)/i.test(s)) return s;
  const base = String(api?.defaults?.baseURL || "http://localhost:5000").replace(/\/+$/, "");
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${base}${path}`;
}

function Modal({ open, title, children, onClose, busy }) {
  if (!open) return null;
  return (
    <div
      className="fp-modalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div className="fp-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="fp-modalHeader">
          <div className="fp-modalTitle">{title}</div>
          <button type="button" className="fp-btnGhost" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <div className="fp-modalBody">{children}</div>
      </div>
    </div>
  );
}

export default function DriverProfile() {
  const nav = useNavigate();
  const fileRef = useRef(null);

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });

  const [avatarBusy, setAvatarBusy] = useState(false);

  const loadMe = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/auth/me");
      setMe(data);
      const name = safe(data?.name, "");
      const sp = splitName(name);
      setForm({
        firstName: sp.firstName,
        lastName: sp.lastName,
        email: safe(data?.email, ""),
        phone: safe(data?.phone, ""),
      });
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load profile");
      setMe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = useMemo(() => {
    const full = safe(me?.name, "");
    return full || `${form.firstName} ${form.lastName}`.trim() || "Driver";
  }, [me?.name, form.firstName, form.lastName]);

  const role = useMemo(() => String(me?.role || localStorage.getItem("role") || "DRIVER").toUpperCase(), [me?.role]);

  const avatarUrl = useMemo(() => resolveAssetUrl(me?.avatar_url || me?.avatar || ""), [me?.avatar_url, me?.avatar]);

  const saveProfile = async () => {
    setSaving(true);
    setErr("");
    try {
      const payload = {
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
      };
      await api.patch("/auth/me", payload);
      setEditOpen(false);
      await loadMe();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    setAvatarBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      await api.post("/auth/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await loadMe();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to upload avatar");
    } finally {
      setAvatarBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    nav("/login");
  };

  return (
    <div className="drvStack">
      <section className="drvCard drvProfileHero">
        <div
          className="drvAvatar"
          role="button"
          tabIndex={0}
          title="Change avatar"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
          }}
          style={{ opacity: avatarBusy ? 0.7 : 1 }}
        >
          {avatarUrl ? <img src={avatarUrl} alt="Avatar" /> : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontWeight: 1100, color: "#0b3b8f" }}>{displayName.slice(0, 1).toUpperCase()}</div>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => uploadAvatar(e.target.files?.[0] || null)}
        />

        <h2 className="drvName">{displayName}</h2>
        <div className="drvRole">
          <span className="drvPill drvPill--info">{role}</span>
          <span style={{ marginLeft: 8 }} className={`drvPill ${localStorage.getItem("driverOnline") === "false" ? "drvPill--offline" : "drvPill--online"}`}>
            {localStorage.getItem("driverOnline") === "false" ? "OFFLINE" : "ONLINE"}
          </span>
        </div>
      </section>

      {err ? (
        <div className="drvCard drvCardPad" style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)" }}>
          <p className="drvTitle" style={{ color: "#991b1b" }}>Notice</p>
          <p className="drvSub" style={{ color: "#7f1d1d" }}>{err}</p>
        </div>
      ) : null}

      <section className="drvCard drvSettings">
        <div className="drvRow drvPress drvTap" onClick={() => setEditOpen(true)}>
          <div className="drvRowMain">
            <div className="drvRowTitle">Edit Profile</div>
            <div className="drvRowSub">Update your name, email, and phone</div>
          </div>
          <IconChevronRight />
        </div>

        <div className="drvRow drvPress drvTap" onClick={() => nav("/forgot-password")}> 
          <div className="drvRowMain">
            <div className="drvRowTitle">Change Password</div>
            <div className="drvRowSub">Reset your account password</div>
          </div>
          <IconChevronRight />
        </div>

        <div
          className="drvRow drvPress drvTap"
          onClick={() => {
            // UI only for now (no backend changes requested)
            alert("Vehicle Info: UI placeholder (no backend wiring yet).\n\nYou can add a dedicated page later without changing APIs.");
          }}
        >
          <div className="drvRowMain">
            <div className="drvRowTitle">Vehicle Info</div>
            <div className="drvRowSub">Plate number, type, and docs</div>
          </div>
          <IconChevronRight />
        </div>

        <div className="drvRow drvPress drvTap" onClick={logout}>
          <div className="drvRowMain">
            <div className="drvRowTitle" style={{ color: "#b91c1c" }}>Logout</div>
            <div className="drvRowSub">Sign out of FastPaSS</div>
          </div>
          <IconChevronRight />
        </div>
      </section>

      <Modal open={editOpen} title="Edit Profile" onClose={() => setEditOpen(false)} busy={saving}>
        {loading && !me ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="drvSkel" style={{ height: 46, width: "100%" }} />
            <div className="drvSkel" style={{ height: 46, width: "100%" }} />
            <div className="drvSkel" style={{ height: 46, width: "100%" }} />
          </div>
        ) : (
          <>
            <div className="fp-formGrid">
              <label className="fp-field">
                <span className="fp-fieldLabel">First Name</span>
                <input className="fp-control" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
              </label>
              <label className="fp-field">
                <span className="fp-fieldLabel">Last Name</span>
                <input className="fp-control" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
              </label>
              <label className="fp-field">
                <span className="fp-fieldLabel">Email</span>
                <input className="fp-control" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </label>
              <label className="fp-field">
                <span className="fp-fieldLabel">Phone</span>
                <input className="fp-control" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </label>
            </div>

            <div className="fp-modalFooter">
              <button type="button" className="fp-btnGhost" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="fp-btnPrimary" onClick={saveProfile} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
