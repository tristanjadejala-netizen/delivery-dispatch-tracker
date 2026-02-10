import { Link } from "react-router-dom";
import splashBg from "../assets/splash.png";

export default function ResetPasswordSuccess() {
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

    // ✅ MATCH FIRST PHOTO: all-white background + soft peach circles (like Login)
    bgDecor: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "radial-gradient(900px 520px at 14% -10%, rgba(255,141,96,0.22), transparent 60%)," +
        "radial-gradient(700px 460px at 6% 12%, rgba(255,141,96,0.16), transparent 58%)," +
        "linear-gradient(180deg, #ffffff 0%, #ffffff 100%)",
    },

    content: {
      position: "relative",
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: "24px",
      boxSizing: "border-box",
    },

    shell: {
      width: "100%",
      maxWidth: 1400,
      display: "grid",
      gridTemplateColumns: "1.15fr 0.85fr",
      gap: 56,
      alignItems: "center",
    },

    left: {
      display: "grid",
      alignContent: "center",
      justifyItems: "center",
      gap: 18,
      padding: "10px 10px",
    },

    brandLogo: {
      width: "min(620px, 92%)",
      height: "auto",
      objectFit: "contain",
    },

    illustration: {
      width: "min(920px, 98%)",
      height: "auto",
      objectFit: "contain",
      filter: "drop-shadow(0 18px 38px rgba(17,24,39,0.08))",
    },

    right: {
      display: "grid",
      alignContent: "center",
      justifyItems: "start",
      paddingLeft: 80, // 👈 PUSH CONTENT INTO PEACH AREA
      paddingRight: 24,
      boxSizing: "border-box",
    },

    panel: {
      width: "100%",
      maxWidth: 600,
    },

    title: {
      margin: 0,
      fontSize: 72,
      lineHeight: 0.95,
      letterSpacing: -1.4,
      fontWeight: 950,
      color: "#C2410C",
    },

    strongLine: {
      margin: "16px 0 10px 0",
      fontSize: 20,
      fontWeight: 950,
      color: "#111827",
    },

    desc: {
      margin: 0,
      fontSize: 14.5,
      lineHeight: 1.7,
      color: "rgba(17,24,39,0.68)",
      maxWidth: 560,
    },

    artworkWrap: {
      marginTop: 34,
      display: "grid",
      placeItems: "center",
    },

    shield: {
      width: 360,
      maxWidth: "85%",
      height: "auto",
      filter: "drop-shadow(0 16px 30px rgba(17,24,39,0.10))",
    },

    button: {
      marginTop: 34,
      height: 58,
      width: "100%",
      borderRadius: 6,
      border: 0,
      background: "#ff9d73",
      color: "#fff",
      fontWeight: 900,
      letterSpacing: 0.6,
      cursor: "pointer",
      boxShadow: "0 18px 40px rgba(255,157,115,0.35)",
    },

    btnLink: {
      display: "block",
      width: "100%",
      textDecoration: "none",
    },
  };

  return (
    <div style={styles.page}>
      <div aria-hidden="true" style={styles.bgDecor} />

      <div style={styles.content}>
        <style>{`
          @media (max-width: 1100px) {
            .s-shell { grid-template-columns: 1fr !important; gap: 18px !important; }
            .s-left { display: none !important; }
            .s-title { font-size: 52px !important; }
            .s-panel { max-width: 680px !important; }
          }
          @media (max-width: 520px) {
            .s-title { font-size: 44px !important; }
          }
        `}</style>

        <div className="s-shell" style={styles.shell}>
          {/* LEFT */}
          <div className="s-left" style={styles.left}>
            <img
              src="/fastpass-logo.png"
              alt="FastPass"
              style={styles.brandLogo}
            />
            <img
              src={splashBg}
              alt="FastPass delivery illustration"
              style={styles.illustration}
            />
          </div>

          {/* RIGHT */}
          <div style={styles.right}>
            <div className="s-panel" style={styles.panel}>
              <h1 className="s-title" style={styles.title}>
                Congratulations!
              </h1>

              <div style={styles.strongLine}>
                You have successfully changed your password
              </div>

              <p style={styles.desc}>
                Your password has been changed successfully. Click the button
                below to return to the login page and sign in using your new
                password.
              </p>

              <div style={styles.artworkWrap}>
                <svg
                  viewBox="0 0 420 360"
                  style={styles.shield}
                  aria-label="Password changed success"
                  role="img"
                >
                  <defs>
                    <linearGradient id="g1" x1="0" x2="1">
                      <stop offset="0" stopColor="#ff8a4c" />
                      <stop offset="1" stopColor="#ffd36b" />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" x2="1">
                      <stop offset="0" stopColor="#fff1c2" />
                      <stop offset="1" stopColor="#ffffff" />
                    </linearGradient>
                  </defs>

                  <circle
                    cx="210"
                    cy="190"
                    r="150"
                    fill="rgba(255,157,115,0.10)"
                  />
                  <path
                    d="M210 40c60 36 114 24 114 24v130c0 96-82 138-114 152-32-14-114-56-114-152V64s54 12 114-24Z"
                    fill="url(#g1)"
                    stroke="rgba(17,24,39,0.12)"
                    strokeWidth="6"
                  />
                  <path
                    d="M210 72c45 26 86 17 86 17v102c0 75-62 107-86 119-24-12-86-44-86-119V89s41 9 86-17Z"
                    fill="url(#g2)"
                    opacity="0.9"
                  />

                  <rect
                    x="150"
                    y="162"
                    width="120"
                    height="96"
                    rx="14"
                    fill="#ffb13a"
                    stroke="rgba(17,24,39,0.10)"
                    strokeWidth="6"
                  />
                  <path
                    d="M172 162v-20c0-22 16-40 38-40s38 18 38 40v20"
                    fill="none"
                    stroke="#ffb13a"
                    strokeWidth="22"
                    strokeLinecap="round"
                  />
                  <circle cx="210" cy="210" r="12" fill="#a16207" />
                  <rect
                    x="204"
                    y="210"
                    width="12"
                    height="28"
                    rx="6"
                    fill="#a16207"
                  />

                  <rect
                    x="110"
                    y="260"
                    width="200"
                    height="40"
                    rx="20"
                    fill="#ffffff"
                    stroke="rgba(17,24,39,0.10)"
                    strokeWidth="6"
                  />
                  <text
                    x="140"
                    y="287"
                    fontSize="22"
                    fontWeight="900"
                    fill="#111827"
                  >
                    ****
                  </text>

                  <circle
                    cx="312"
                    cy="265"
                    r="48"
                    fill="#ffb13a"
                    stroke="rgba(17,24,39,0.10)"
                    strokeWidth="6"
                  />
                  <path
                    d="M294 265l12 12 24-28"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <Link to="/login" style={styles.btnLink}>
                <button type="button" style={styles.button}>
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
