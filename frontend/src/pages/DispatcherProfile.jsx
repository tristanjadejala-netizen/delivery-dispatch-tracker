import { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "../styles/fastpass-dispatcher-shell.css";
import "../styles/dispatcher-overview.css";

function safeText(v, fallback = "—") {
  if (v === null || v === undefined) return fallback;
  const s = typeof v === "string" ? v.trim() : String(v);
  return s ? s : fallback;
}

function splitName(full = "") {
  const t = (full || "").trim().replace(/\s+/g, " ");
  if (!t) return { firstName: "", lastName: "" };
  const parts = t.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
}

function resolveAssetUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^(blob:|data:|https?:\/\/)/i.test(s)) return s;

  const base = String(api?.defaults?.baseURL || "http://localhost:5000").replace(/\/+$/, "");
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${base}${path}`;
}

function Field({ label, value, asLink = false }) {
  return (
    <div className="fpPr-field">
      <div className="fpPr-label">{label}</div>
      {asLink ? (
        <a className="fpPr-value fpPr-link" href={`mailto:${value}`}>
          {safeText(value)}
        </a>
      ) : (
        <div className="fpPr-value">{safeText(value)}</div>
      )}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="fpPr-card">
      <div className="fpPr-cardHead">
        <div className="fpPr-cardTitle">{title}</div>
      </div>
      <div className="fpPr-cardDivider" />
      <div className="fpPr-cardBody">{children}</div>
    </section>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(Boolean(mq.matches));
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

function Modal({ open, title, subtitle, children, onClose, busy }) {
  const reducedMotion = usePrefersReducedMotion();
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("fpPr-noScroll");
    return () => document.body.classList.remove("fpPr-noScroll");
  }, [open]);

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  const requestClose = () => {
    if (busy) return;
    if (reducedMotion) return onClose?.();
    setClosing(true);
    window.setTimeout(() => onClose?.(), 180);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy, reducedMotion]);

  if (!open) return null;

  return (
    <div
      className={`fpPr-modalOverlay ${closing ? "fpPr-modalOverlay--closing" : ""} ${
        reducedMotion ? "fpPr-modalOverlay--reduced" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className={`fpPr-modal fpPr-modal--premium ${closing ? "fpPr-modal--closing" : ""} ${
          reducedMotion ? "fpPr-modal--reduced" : ""
        }`}
      >
        <div className="fpPr-modalHead fpPr-modalHead--premium">
          <div className="fpPr-modalTitleBlock">
            <div className="fpPr-modalTitle">{title}</div>
            {subtitle ? <div className="fpPr-modalSubtitle">{subtitle}</div> : null}
          </div>

          <button
            className="fpPr-iconBtn"
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label="Close"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="fpPr-modalDivider" />
        <div className="fpPr-modalBody fpPr-modalBody--premium">{children}</div>
      </div>
    </div>
  );
}

export default function DispatcherProfile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [savedFlash, setSavedFlash] = useState("");

  const fileRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarErr, setAvatarErr] = useState("");

  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarBrokenLg, setAvatarBrokenLg] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formProvince, setFormProvince] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const [initialSnapshot, setInitialSnapshot] = useState(null);

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

  // ✅ KEY FIX: keep sidebar name in sync with the profile name
  useEffect(() => {
    const n = String(me?.name || "").trim();
    if (!n) return;
    localStorage.setItem("fp_display_name", n);
    localStorage.setItem("name", n); // optional compatibility
    window.dispatchEvent(new Event("fp_profile_name_updated")); // same-tab update
  }, [me?.name]);

  const name = safeText(me?.name, "—");
  const role = safeText(me?.role, "DISPATCHER");
  const email = safeText(me?.email, "—");

  const avatarRaw = me?.avatar_url ? String(me.avatar_url) : "";
  const avatarResolved = resolveAssetUrl(avatarRaw);

  useEffect(() => {
    setAvatarBroken(false);
    setAvatarBrokenLg(false);
  }, [avatarResolved]);

  // ✅ Keep sidebar (layout) synced with real profile: name, role, avatar
useEffect(() => {
  const n = String(me?.name || "").trim();
  const r = String(me?.role || "").trim();
  const a = String(avatarResolved || "").trim();

  if (n) localStorage.setItem("fp_display_name", n);
  if (r) localStorage.setItem("fp_display_role", r);
  if (a) localStorage.setItem("fp_avatar_url", a);

  // Same-tab live update
  if (n || r || a) window.dispatchEvent(new Event("fp_profile_updated"));
}, [me?.name, me?.role, avatarResolved]);


  const { firstName, lastName } = useMemo(() => splitName(me?.name || ""), [me?.name]);

  const phone = safeText(me?.phone, "—");
  const bio = safeText(me?.bio, "—");
  const country = safeText(me?.country, "Philippines");
  const province = safeText(me?.province, "—");
  const postalCode = safeText(me?.postal_code || me?.postalCode, "—");
  const fullAddress = safeText(me?.address || me?.full_address || me?.fullAddress, "—");

  const locationLine = [province && province !== "—" ? province : null, country]
    .filter(Boolean)
    .join(", ");

  const initials = useMemo(() => {
    const n = (me?.name || "").trim();
    if (!n) return "U";
    const parts = n.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "U";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return (a + b).toUpperCase();
  }, [me?.name]);

  function snapshotFromForm() {
    return {
      name: formName,
      email: formEmail,
      phone: formPhone,
      bio: formBio,
      country: formCountry,
      province: formProvince,
      postal_code: formPostalCode,
      address: formAddress,
    };
  }

  function openEdit() {
    setSaveErr("");
    setSavedFlash("");
    setAvatarErr("");

    const next = {
      name: me?.name || "",
      email: me?.email || "",
      phone: me?.phone || "",
      bio: me?.bio || "",
      country: me?.country || "Philippines",
      province: me?.province || "",
      postal_code: me?.postal_code || me?.postalCode || "",
      address: me?.address || me?.full_address || me?.fullAddress || "",
    };

    setFormName(next.name);
    setFormEmail(next.email);
    setFormPhone(next.phone);
    setFormBio(next.bio);
    setFormCountry(next.country);
    setFormProvince(next.province);
    setFormPostalCode(next.postal_code);
    setFormAddress(next.address);

    setInitialSnapshot(next);

    setAvatarPreview("");
    setEditOpen(true);
  }

  async function saveProfile() {
    setSaving(true);
    setSaveErr("");

    try {
      const payload = {
        name: formName,
        email: formEmail,
        phone: formPhone,
        bio: formBio,
        country: formCountry,
        province: formProvince,
        postal_code: formPostalCode,
        address: formAddress,
      };

      const { data } = await api.patch("/auth/me", payload);

      setMe(data);

      // ✅ ensure sidebar updates even if API returns quickly
      const n = String(data?.name || "").trim();
      if (n) {
        localStorage.setItem("fp_display_name", n);
        localStorage.setItem("name", n);
        window.dispatchEvent(new Event("fp_profile_name_updated"));
      }

      setTimeout(() => setEditOpen(false), 150);
      setSavedFlash("Profile updated successfully");
    } catch (e) {
      setSaveErr(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file) {
    setAvatarUploading(true);
    setAvatarErr("");
    try {
      const fd = new FormData();
      fd.append("avatar", file);

      const { data } = await api.post("/auth/me/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMe(data);

      // ✅ keep sidebar name synced after avatar upload too
      const n = String(data?.name || "").trim();
      if (n) {
        localStorage.setItem("fp_display_name", n);
        localStorage.setItem("name", n);
        window.dispatchEvent(new Event("fp_profile_name_updated"));
      }

      setAvatarPreview("");
    } catch (e) {
      setAvatarErr(e?.response?.data?.message || "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
    }
  }

  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    const now = snapshotFromForm();
    return JSON.stringify(now) !== JSON.stringify(initialSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialSnapshot,
    formName,
    formEmail,
    formPhone,
    formBio,
    formCountry,
    formProvince,
    formPostalCode,
    formAddress,
  ]);

  const canSave = useMemo(() => {
    if (saving || avatarUploading) return false;
    if (!formName.trim()) return false;
    if (!formEmail.trim()) return false;
    if (!isDirty) return false;
    return true;
  }, [saving, avatarUploading, formName, formEmail, isDirty]);

  const showSmallImg = Boolean(avatarPreview || avatarResolved) && !avatarBroken;
  const showLargeImg = Boolean(avatarPreview || avatarResolved) && !avatarBrokenLg;

  return (
    <div className="fpOv-page">
      <div className="fpOv-mainCard">
        <div className="fpOv-breadcrumb">Profile</div>
        <div className="fpOv-rainbow" />

        {err ? (
          <div className="fpPr-alert fpPr-alert--error" role="alert" aria-live="polite">
            {err}
          </div>
        ) : null}

        {savedFlash ? (
          <div className="fpPr-alert fpPr-alert--success" aria-live="polite">
            {savedFlash}
          </div>
        ) : null}

        <div className="fpPr-stack">
          <section className="fpPr-summary">
            <div className="fpPr-summaryLeft">
              <div className="fpPr-summaryRow">
                <button
                  type="button"
                  className="fpPr-avatarWrap fpPr-avatarBtn fpPr-avatarBtn--premium"
                  onClick={openEdit}
                  title="Edit profile"
                  aria-label="Edit profile"
                >
                  {showSmallImg ? (
                    <img
                      className="fpPr-avatar"
                      src={avatarPreview || avatarResolved}
                      alt="Profile avatar"
                      onError={() => setAvatarBroken(true)}
                    />
                  ) : (
                    <span className="fpPr-avatarFallback" aria-hidden="true">
                      {initials}
                    </span>
                  )}
                  <span className="fpPr-avatarOverlay" aria-hidden="true">
                    Change
                  </span>
                </button>

                <div className="fpPr-summaryMeta">
                  <div className="fpPr-name">{loading ? "Loading…" : name}</div>
                  <div className="fpPr-role">
                    {role === "ADMIN" || role === "DISPATCHER" ? "Admin/Dispatcher" : role}
                  </div>
                  <div className="fpPr-location">{safeText(locationLine, "—")}</div>
                </div>
              </div>
            </div>

            <div className="fpPr-summaryRight">
              <button className="fpOv-btnSecondary" type="button" onClick={openEdit}>
                Edit
              </button>
            </div>
          </section>

          <Card title="Personal Information">
            <div className="fpPr-grid2">
              <Field label="First Name" value={firstName} />
              <Field label="Last Name" value={lastName} />
              <Field label="Email Address" value={email} asLink={email !== "—"} />
              <Field label="Phone" value={phone} />
              <Field label="Bio" value={bio} />
              <div />
            </div>
          </Card>

          <Card title="Address">
            <div className="fpPr-grid2">
              <Field label="Country" value={country} />
              <Field label="Province" value={province} />
              <Field label="Postal Code" value={postalCode} />
              <Field label="Full Address" value={fullAddress} />
            </div>
          </Card>
        </div>

        {/* Modal (unchanged) */}
 <Modal
          open={editOpen}
          title="Edit profile"
          subtitle="Update photo and contact details"
          onClose={() =>
            !saving && !avatarUploading ? setEditOpen(false) : null
          }
          busy={saving || avatarUploading}
        >
          {saveErr || avatarErr ? (
            <div className="fpPr-alert fpPr-alert--error" role="alert">
              {saveErr || avatarErr}
            </div>
          ) : null}

          <div className="fpPr-premiumGrid">
            {/* Left: avatar + quick info */}
            <div className="fpPr-pane fpPr-pane--left">
              <div className="fpPr-paneTitle">Profile photo</div>

              <div className="fpPr-photoCard">
                <div className="fpPr-photoPreview">
                  {showLargeImg ? (
                    <img
                      className="fpPr-avatar fpPr-avatar--xl"
                      src={avatarPreview || avatarResolved}
                      alt="Avatar preview"
                      onError={() => setAvatarBrokenLg(true)}
                    />
                  ) : (
                    <div
                      className="fpPr-avatarFallback fpPr-avatarFallback--xl"
                      aria-hidden="true"
                    >
                      {initials}
                    </div>
                  )}
                </div>

                <div className="fpPr-photoActions">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="fpPr-file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = URL.createObjectURL(f);
                      setAvatarPreview(url);
                      setAvatarBroken(false);
                      setAvatarBrokenLg(false);
                    }}
                    disabled={avatarUploading || saving}
                  />

                  <div className="fpPr-btnRow">
                    <button
                      className="fpOv-btnSecondary"
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={avatarUploading || saving}
                    >
                      Choose photo
                    </button>

                    <button
                      className="fpOv-btnPrimary"
                      type="button"
                      onClick={() => {
                        const f = fileRef.current?.files?.[0];
                        if (f) uploadAvatar(f);
                        else setAvatarErr("Please choose a photo first.");
                      }}
                      disabled={avatarUploading || saving}
                    >
                      {avatarUploading ? "Uploading…" : "Upload"}
                    </button>
                  </div>

                  <div className="fpPr-hint">PNG/JPG/WebP • max 3MB</div>
                </div>
              </div>

              <div className="fpPr-miniInfo">
                <div className="fpPr-miniLabel">Signed in as</div>
                <div className="fpPr-miniValue">{safeText(me?.email, "—")}</div>
              </div>
            </div>

            {/* Right: form */}
            <div className="fpPr-pane fpPr-pane--right">
              <div className="fpPr-paneTitle">Account</div>

              <div className="fpPr-formGrid">
                <div className="fpPr-inputGroup">
                  <div className="fpPr-label">Full name</div>
                  <input
                    className="fpPr-input fpPr-input--premium"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Juana Dela Cruz"
                    disabled={saving || avatarUploading}
                  />
                </div>

                <div className="fpPr-inputGroup">
                  <div className="fpPr-label">Email</div>
                  <input
                    className="fpPr-input fpPr-input--premium"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g., juana@gmail.com"
                    disabled={saving || avatarUploading}
                  />
                </div>

                <div className="fpPr-inputGroup">
                  <div className="fpPr-label">Phone</div>
                  <input
                    className="fpPr-input fpPr-input--premium"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g., 0923 131 2341"
                    disabled={saving || avatarUploading}
                  />
                </div>

                <div className="fpPr-inputGroup">
                  <div className="fpPr-label">Country</div>
                  <input
                    className="fpPr-input fpPr-input--premium"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    placeholder="e.g., Philippines"
                    disabled={saving || avatarUploading}
                  />
                </div>

                <div className="fpPr-inputGroup">
                  <div className="fpPr-label">Province</div>
                  <input
                    className="fpPr-input fpPr-input--premium"
                    value={formProvince}
                    onChange={(e) => setFormProvince(e.target.value)}
                    placeholder="e.g., Bohol"
                    disabled={saving || avatarUploading}
                  />
                </div>

                <div className="fpPr-inputGroup">
                  <div className="fpPr-label">Postal code</div>
                  <input
                    className="fpPr-input fpPr-input--premium"
                    value={formPostalCode}
                    onChange={(e) => setFormPostalCode(e.target.value)}
                    placeholder="e.g., 6300"
                    disabled={saving || avatarUploading}
                  />
                </div>

                <div className="fpPr-inputGroup fpPr-span2">
                  <div className="fpPr-label">Full address</div>
                  <input
                    className="fpPr-input fpPr-input--premium"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="e.g., J.A. Clarin St., Tagbilaran City, Bohol"
                    disabled={saving || avatarUploading}
                  />
                </div>

                <div className="fpPr-inputGroup fpPr-span2">
                  <div className="fpPr-labelRow">
                    <div className="fpPr-label">Bio</div>
                    <div className="fpPr-counter">
                      {(formBio || "").length}/500
                    </div>
                  </div>
                  <textarea
                    className="fpPr-textarea fpPr-textarea--premium"
                    value={formBio}
                    onChange={(e) => setFormBio(e.target.value)}
                    placeholder="Write a short bio…"
                    disabled={saving || avatarUploading}
                    maxLength={500}
                  />
                </div>
              </div>

              {/* Sticky action bar */}
              <div className="fpPr-stickyActions">
                <div className="fpPr-dirtyPill" aria-live="polite">
                  {isDirty ? "Unsaved changes" : "All changes saved"}
                </div>

                <div className="fpPr-actionsRight">
                  <button
                    className="fpOv-btnSecondary"
                    type="button"
                    onClick={() => setEditOpen(false)}
                    disabled={saving || avatarUploading}
                  >
                    Cancel
                  </button>

                  <button
                    className="fpOv-btnPrimary"
                    type="button"
                    onClick={saveProfile}
                    disabled={!canSave}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
