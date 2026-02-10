import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import splashBg from "../assets/splash.png";
import { resetPassword } from "../api/auth";
// Note: visuals only (aligned to Login/ForgotPassword). No backend behavior changes.

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const nav = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = useMemo(() => {
    return (
      !!token &&
      password.trim().length >= 6 &&
      confirm.trim().length >= 6 &&
      password === confirm &&
      !loading
    );
  }, [token, password, confirm, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!token) return setErr("Invalid reset link.");
    if (password.length < 6) return setErr("Password must be at least 6 characters.");
    if (password !== confirm) return setErr("Passwords do not match.");

    setLoading(true);
    try {
      await resetPassword(token, password);

      // ✅ After success → go to success page (NOT from email link)
      nav("/reset-success", { replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Reset link is invalid or expired.");
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    page: {
      minHeight: "100vh",
      width: "100%",
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      color: "#111827",
      background: "#ffffff",
      position: "relative",
      overflow: "hidden",
    },

    // ✅ Same background style as Login/ForgotPassword
    bgDecor: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "radial-gradient(900px 520px at 14% -10%, rgba(255,141,96,0.22), transparent 60%)," +
        "radial-gradient(700px 460px at 6% 12%, rgba(255,141,96,0.16), transparent 58%)," +
        "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 55%, rgba(255,239,233,1) 55%, rgba(255,239,233,1) 100%)",
    },

    content: {
      position: "relative",
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 24,
      boxSizing: "border-box",
    },

    shell: {
      width: "100%",
      maxWidth: 1200,
      display: "grid",
      gridTemplateColumns: "1.15fr 0.85fr",
      gap: 28,
      alignItems: "center",
    },

    left: {
      display: "grid",
      alignContent: "center",
      justifyItems: "center",
      gap: 18,
      padding: "18px 10px",
    },

    brandLogo: {
      width: "min(520px, 90%)",
      height: "auto",
      objectFit: "contain",
    },

    illustration: {
      width: "min(760px, 92%)",
      height: "auto",
      objectFit: "contain",
      filter: "drop-shadow(0 20px 40px rgba(17,24,39,0.08))",
    },

    rightWrap: {
      display: "grid",
      placeItems: "center",
    },

    card: {
      width: "100%",
      maxWidth: 520,
      borderRadius: 28,
      background: "rgba(255,239,233,0.92)",
      border: "1px solid rgba(17,24,39,0.06)",
      boxShadow: "0 30px 70px rgba(17,24,39,0.10)",
      padding: 44,
      position: "relative",
    },

    title: {
      margin: 0,
      fontSize: 54,
      lineHeight: 1,
      letterSpacing: -1.2,
      fontWeight: 950,
    },

    titleAccent: { color: "#c2410c" },
    titleMain: { color: "#111827" },

    subtitle: {
      margin: "14px 0 18px 0",
      maxWidth: 440,
      fontSize: 14,
      lineHeight: 1.6,
      color: "rgba(17,24,39,0.68)",
    },

    hr: {
      height: 1,
      border: 0,
      background: "rgba(17,24,39,0.12)",
      margin: "18px 0 30px 0",
    },

    form: { display: "grid", gap: 16 },

    label: {
      fontSize: 14,
      fontWeight: 700,
      color: "rgba(17,24,39,0.78)",
    },

    field: { display: "grid", gap: 8 },

    inputWrap: { position: "relative" },

    iconLeft: {
      position: "absolute",
      left: 14,
      top: "50%",
      transform: "translateY(-50%)",
      color: "rgba(17,24,39,0.55)",
      width: 18,
      height: 18,
      pointerEvents: "none",
    },

    input: {
      height: 54,
      width: "100%",
      borderRadius: 6,
      border: "1px solid rgba(17,24,39,0.14)",
      background: "rgba(255,255,255,0.88)",
      padding: "0 48px 0 46px",
      outline: "none",
      fontSize: 15,
      color: "#111827",
      boxShadow: "0 1px 0 rgba(17,24,39,0.04)",
      transition: "box-shadow 160ms ease, border-color 160ms ease",
      boxSizing: "border-box",
    },

    eyeBtn: {
      position: "absolute",
      right: 12,
      top: "50%",
      transform: "translateY(-50%)",
      border: 0,
      background: "transparent",
      padding: 6,
      cursor: "pointer",
      color: "rgba(17,24,39,0.55)",
    },

    submit: (disabled) => ({
      height: 54,
      width: "100%",
      borderRadius: 6,
      border: 0,
      background: "#ff9d73",
      color: "#fff",
      fontWeight: 900,
      letterSpacing: 0.6,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.7 : 1,
      boxShadow: "0 18px 40px rgba(255,157,115,0.35)",
      textTransform: "uppercase",
    }),

    bottomRow: {
      marginTop: 12,
      display: "flex",
      gap: 8,
      justifyContent: "flex-start",
      alignItems: "center",
      fontSize: 13,
      color: "rgba(17,24,39,0.60)",
    },

    bottomLink: {
      fontSize: 13,
      fontWeight: 800,
      textDecoration: "none",
      color: "rgba(17,24,39,0.75)",
    },

    error: {
      padding: 12,
      borderRadius: 10,
      background: "rgba(255, 238, 240, 0.9)",
      border: "1px solid rgba(244, 63, 94, 0.25)",
      color: "#9f1239",
      fontSize: 13,
      fontWeight: 800,
    },
  };

  return (
    <div style={styles.page}>
      <div aria-hidden="true" style={styles.bgDecor} />

      <div style={styles.content}>
        <style>{`
          @media (max-width: 980px) {
            .rp-shell { grid-template-columns: 1fr !important; gap: 18px !important; }
            .rp-card { padding: 30px !important; }
            .rp-title { font-size: 44px !important; }
          }
          @media (max-width: 520px) {
            .rp-card { padding: 22px !important; border-radius: 22px !important; }
            .rp-title { font-size: 38px !important; }
          }
          .rp-input:focus {
            border-color: rgba(255, 141, 96, 0.65) !important;
            box-shadow: 0 0 0 4px rgba(255, 141, 96, 0.22) !important;
            background: rgba(255,255,255,0.95) !important;
          }
          .rp-btn:active { transform: translateY(1px); }
        `}</style>

        <div className="rp-shell" style={styles.shell}>
          {/* Left: same style as Login/ForgotPassword */}
          <div style={styles.left}>
            <img src="/fastpass-logo.png" alt="FastPass" style={styles.brandLogo} loading="eager" />
            <img src={splashBg} alt="FastPass delivery illustration" style={styles.illustration} loading="eager" />
          </div>

          {/* Right: reset password form */}
          <div style={styles.rightWrap}>
            <div className="rp-card" style={styles.card}>
              <h1 className="rp-title" style={styles.title}>
                <span style={styles.titleAccent}>Almost</span>{" "}
                <span style={styles.titleMain}>There!</span>
              </h1>

              <p style={styles.subtitle}>
                Enter your new password below and secure your account.
                You&apos;re on your way to a stronger, safer login!
              </p>

              <hr style={styles.hr} />

              {!token ? (
                <div style={styles.error}>
                  Invalid reset link. Please request a new reset link from the Forgot Password page.
                </div>
              ) : (
                <form onSubmit={onSubmit} style={styles.form}>
                  {err ? <div style={styles.error}>{err}</div> : null}

                  <div style={styles.field}>
                    <div style={styles.label}>New Password</div>
                    <div style={styles.inputWrap}>
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        style={styles.iconLeft}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 11V7a5 5 0 0 0-10 0v4" />
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                      </svg>

                      <input
                        className="rp-input"
                        style={styles.input}
                        placeholder="New password (min 6 chars)"
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />

                      <button
                        type="button"
                        aria-label={showPw ? "Hide password" : "Show password"}
                        style={styles.eyeBtn}
                        onClick={() => setShowPw((p) => !p)}
                      >
                        {showPw ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94" />
                            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a21.77 21.77 0 0 1-2.72 4.44" />
                            <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                            <path d="M1 1l22 22" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div style={styles.field}>
                    <div style={styles.label}>Confirm New Password</div>
                    <div style={styles.inputWrap}>
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        style={styles.iconLeft}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 11V7a5 5 0 0 0-10 0v4" />
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                      </svg>

                      <input
                        className="rp-input"
                        style={styles.input}
                        placeholder="Confirm password"
                        type={showConfirm ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                      />

                      <button
                        type="button"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                        style={styles.eyeBtn}
                        onClick={() => setShowConfirm((p) => !p)}
                      >
                        {showConfirm ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.94" />
                            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a21.77 21.77 0 0 1-2.72 4.44" />
                            <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                            <path d="M1 1l22 22" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <button className="rp-btn" type="submit" style={styles.submit(!canSubmit)} disabled={!canSubmit}>
                    {loading ? "Saving..." : "Submit"}
                  </button>

                  <div style={styles.bottomRow}>
                    <span>←</span>
                    <Link to="/login" style={styles.bottomLink}>
                      Back to Login
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
