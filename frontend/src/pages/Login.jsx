import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import GoogleSignInButton from "../components/GoogleSignInButton";
import splashBg from "../assets/splash.png";
// Note: we intentionally keep visuals self-contained in this file (no backend changes).

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(() => location.state?.email || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [err, setErr] = useState("");
  const [flash, setFlash] = useState(() => location.state?.flash || "");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loading;
  }, [email, password, loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setFlash("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);

      const me = await api.get("/auth/me");
      const role = me.data.role;
      localStorage.setItem("role", role);

      if (role === "ADMIN") nav("/admin/drivers");
      else if (role === "DISPATCHER") nav("/dispatcher");
      else if (role === "DRIVER") nav("/driver");
      else if (role === "CUSTOMER") nav("/customer");
      else nav("/");
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Login failed");
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

    // Soft abstract circles (top-left) like the reference.
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
      justifyItems: "start",
      gap: 10,
      padding: "18px 0 18px 32px",
    },

    brandLogo: {
      width: "min(520px, 90%)",
      height: "auto",
      objectFit: "contain",
    },

    illustration: {
      width: "min(1000px, 100%)",
      marginLeft: "-60px",
      height: "auto",
      objectFit: "contain",
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

    titleAccent: {
      color: "#c2410c",
    },

    titleMain: {
      color: "#111827",
    },

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

    inputWrap: {
      position: "relative",
    },

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

    forgotRow: {
      display: "flex",
      justifyContent: "flex-end",
      marginTop: -4,
    },

    forgotLink: {
      fontSize: 12,
      fontWeight: 700,
      textDecoration: "none",
      color: "#2563eb",
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
    }),

    divider: {
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      gap: 12,
      alignItems: "center",
      margin: "10px 0 6px 0",
      color: "rgba(17,24,39,0.55)",
      fontSize: 13,
      fontWeight: 700,
    },

    dividerLine: {
      height: 1,
      background: "rgba(17,24,39,0.14)",
    },

    bottomRow: {
      marginTop: 10,
      display: "flex",
      gap: 8,
      justifyContent: "center",
      alignItems: "center",
      fontSize: 13,
      color: "rgba(17,24,39,0.60)",
    },

    bottomLink: {
      fontSize: 13,
      fontWeight: 800,
      textDecoration: "none",
      color: "#2563eb",
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

    flash: {
      padding: 12,
      borderRadius: 10,
      background: "rgba(236, 253, 245, 0.95)",
      border: "1px solid rgba(16, 185, 129, 0.25)",
      color: "#065f46",
      fontSize: 13,
      fontWeight: 850,
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
          /* Make the existing GoogleSignInButton look like the reference */
          .fp-card :is(button, a)[data-google-btn],
          .fp-card .google-signin-btn,
          .fp-card button.google-signin {
            height: 54px;
            border-radius: 6px;
            width: 100%;
          }
        `}</style>

        <div className="fp-shell" style={styles.shell}>
          {/* Left: Brand/Illustration */}
          <div style={styles.left}>
            <img
              src="/fastpass-logo.png"
              alt="FastPass"
              style={styles.brandLogo}
              loading="eager"
            />

            {/* If your project has a dedicated illustration, swap splash.png to it. */}
            <img
              src={splashBg}
              alt="FastPass delivery illustration"
              style={styles.illustration}
              loading="eager"
            />
          </div>

          {/* Right: Login card */}
          <div style={styles.rightWrap}>
            <div className="fp-card" style={styles.card}>
              <h1 className="fp-title" style={styles.title}>
                <span style={styles.titleAccent}>Welcome</span>{" "}
                <span style={styles.titleMain}>Back!</span>
              </h1>

              <p style={styles.subtitle}>
                Log in to manage your deliveries, track progress, and ensure
                timely arrivals. Your efficient delivery experience starts here.
              </p>
              <hr style={styles.hr} />

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
                      <path d="M4 4h16v16H4z" opacity="0" />
                      <path d="M4 6h16v12H4z" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                    <input
                      className="fp-input"
                      style={styles.input}
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                      inputMode="email"
                    />
                  </div>
                </div>

                <div style={styles.field}>
                  <div style={styles.label}>Password</div>
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
                      className="fp-input"
                      style={styles.input}
                      placeholder="Enter your password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />

                    <button
                      type="button"
                      aria-label={showPw ? "Hide password" : "Show password"}
                      style={styles.eyeBtn}
                      onClick={() => setShowPw((p) => !p)}
                    >
                      {showPw ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a21.84 21.84 0 0 1 5.06-6.94" />
                          <path d="M1 1l22 22" />
                          <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88" />
                          <path d="M14.12 14.12A3 3 0 0 0 9.88 9.88" />
                          <path d="M21 12s-3-8-9-8a9.77 9.77 0 0 0-2.96.45" />
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div style={styles.forgotRow}>
                    <Link to="/forgot-password" style={styles.forgotLink}>
                      Forgot Password?
                    </Link>
                  </div>
                </div>

                {flash ? <div style={styles.flash}>{flash}</div> : null}
                {err ? <div style={styles.error}>{err}</div> : null}

                <button
                  className="fp-btn"
                  type="submit"
                  style={styles.submit(!canSubmit)}
                  disabled={!canSubmit}
                >
                  {loading ? "Logging in..." : "LOG IN"}
                </button>

                <div style={styles.divider}>
                  <div style={styles.dividerLine} />
                  <div>or</div>
                  <div style={styles.dividerLine} />
                </div>

                <GoogleSignInButton />

                <div style={styles.bottomRow}>
                  <span>Don’t have an account yet?</span>
                  <Link to="/register" style={styles.bottomLink}>
                    Create an account
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
