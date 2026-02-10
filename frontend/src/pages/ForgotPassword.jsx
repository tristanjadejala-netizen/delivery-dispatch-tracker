import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import splashBg from "../assets/splash.png";
import { requestPasswordReset } from "../api/auth";
// Note: visuals only (aligned to Login.jsx). No backend behavior changes.

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && !loading;
  }, [email, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      setError("Unable to send reset link. Please try again.");
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

    // Same background language as Login.jsx (soft circles + split white/peach)
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
      maxWidth: 460,
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
      padding: "0 16px 0 46px",
      outline: "none",
      fontSize: 15,
      color: "#111827",
      boxShadow: "0 1px 0 rgba(17,24,39,0.04)",
      transition: "box-shadow 160ms ease, border-color 160ms ease",
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

    status: (kind) => ({
      padding: 12,
      borderRadius: 10,
      background:
        kind === "success" ? "rgba(236, 253, 245, 0.95)" : "rgba(255, 238, 240, 0.9)",
      border:
        kind === "success"
          ? "1px solid rgba(16, 185, 129, 0.25)"
          : "1px solid rgba(244, 63, 94, 0.25)",
      color: kind === "success" ? "#065f46" : "#9f1239",
      fontSize: 13,
      fontWeight: 850,
      lineHeight: 1.55,
    }),

    backRow: {
      marginTop: 12,
      display: "flex",
      justifyContent: "center",
      gap: 8,
      fontSize: 13,
      color: "rgba(17,24,39,0.60)",
    },

    backLink: {
      fontSize: 13,
      fontWeight: 800,
      textDecoration: "none",
      color: "#2563eb",
    },
  };

  return (
    <div style={styles.page}>
      <div aria-hidden="true" style={styles.bgDecor} />

      <div style={styles.content}>
        <style>{`
          @media (max-width: 980px) {
            .fp-shell { grid-template-columns: 1fr !important; gap: 18px !important; }
            .fp-card { padding: 30px !important; }
            .fp-title { font-size: 44px !important; }
          }
          @media (max-width: 520px) {
            .fp-card { padding: 22px !important; border-radius: 22px !important; }
            .fp-title { font-size: 38px !important; }
          }
          .fp-input:focus {
            border-color: rgba(255, 141, 96, 0.65) !important;
            box-shadow: 0 0 0 4px rgba(255, 141, 96, 0.22) !important;
            background: rgba(255,255,255,0.95) !important;
          }
          .fp-btn:active { transform: translateY(1px); }
        `}</style>

        <div className="fp-shell" style={styles.shell}>
          {/* Left: matches Login page */}
          <div style={styles.left}>
            <img
              src="/fastpass-logo.png"
              alt="FastPass"
              style={styles.brandLogo}
              loading="eager"
            />
            <img
              src={splashBg}
              alt="FastPass delivery illustration"
              style={styles.illustration}
              loading="eager"
            />
          </div>

          {/* Right: Forgot Password card */}
          <div style={styles.rightWrap}>
            <div className="fp-card" style={styles.card}>
              <h1 className="fp-title" style={styles.title}>
                <span style={styles.titleAccent}>Don’t</span>{" "}
                <span style={styles.titleMain}>Worry!</span>
              </h1>

              <p style={styles.subtitle}>
                Enter your email address below, and we&apos;ll send you a link to reset your
                password. You&apos;ll be back on track in no time.
              </p>

              <hr style={styles.hr} />

              {sent ? (
                <div style={styles.status("success")}>
                  ✅ If an account exists for <b>{email}</b>, a reset link has been sent. Please check
                  your inbox (and spam folder).
                </div>
              ) : (
                <form onSubmit={onSubmit} style={styles.form}>
                  <div style={styles.field}>
                    <div style={styles.label}>Email Address</div>

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
                        <path d="M4 6h16v12H4z" />
                        <path d="m4 7 8 6 8-6" />
                      </svg>

                      <input
                        className="fp-input"
                        style={styles.input}
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>
                  </div>

                  <button
                    className="fp-btn"
                    type="submit"
                    style={styles.submit(!canSubmit)}
                    disabled={!canSubmit}
                  >
                    {loading ? "Sending..." : "Continue"}
                  </button>

                  {error ? <div style={styles.status("error")}>{error}</div> : null}
                </form>
              )}

              <div style={styles.backRow}>
                <span>Remembered your password?</span>
                <Link to="/login" style={styles.backLink}>
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
