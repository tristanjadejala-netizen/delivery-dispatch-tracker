import { NavLink, Outlet } from "react-router-dom";

function tabStyle(isActive) {
  return {
    flex: 1,
    minWidth: 0,
    padding: "10px 8px",
    borderRadius: 12,
    textDecoration: "none",
    display: "grid",
    placeItems: "center",
    gap: 4,
    fontSize: 11,
    fontWeight: 900,
    color: isActive ? "#0b3b8f" : "#64748b",
    background: isActive ? "rgba(0,112,255,0.10)" : "transparent",
  };
}

function Icon({ name, active }) {
  const c = active ? "#0b3b8f" : "#64748b";
  const common = { width: 22, height: 22, display: "block" };

  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" style={common} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    );
  }

  if (name === "assigned") {
    return (
      <svg viewBox="0 0 24 24" style={common} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" style={common} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function DriverLayout() {
  const styles = {
    page: {
      minHeight: "100vh",
      background:
        "radial-gradient(900px 520px at 15% 12%, rgba(0, 98, 255, 0.16), transparent 60%)," +
        "radial-gradient(900px 520px at 85% 18%, rgba(255, 126, 24, 0.12), transparent 55%)," +
        "linear-gradient(180deg, #ffffff 0%, #f5f8ff 55%, #f7fbff 100%)",
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      color: "#0b1220",
      display: "grid",
      gridTemplateRows: "1fr auto",
    },
    content: {
      padding: "18px 16px 92px",
      // ✅ wider container so desktop doesn't look tiny
      maxWidth: 1280,
      width: "100%",
      margin: "0 auto",
    },
    bottom: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      padding: "10px 12px",
      background: "rgba(255,255,255,0.88)",
      backdropFilter: "blur(10px)",
      borderTop: "1px solid rgba(15,23,42,0.08)",
      display: "grid",
      placeItems: "center",
      zIndex: 50,
    },
    nav: {
      // ✅ nav stays centered and a bit wider
      maxWidth: 900,
      width: "100%",
      display: "flex",
      gap: 8,
      padding: 6,
      borderRadius: 16,
      border: "1px solid rgba(15,23,42,0.08)",
      boxShadow: "0 14px 30px rgba(11,18,32,0.10)",
      background: "rgba(255,255,255,0.92)",
    },
  };

  return (
    <div style={styles.page}>
      <main style={styles.content}>
        <Outlet />
      </main>

      <div style={styles.bottom}>
        <nav style={styles.nav}>
          <NavLink to="/driver/home" style={({ isActive }) => tabStyle(isActive)} aria-label="Home">
            {({ isActive }) => (
              <>
                <Icon name="home" active={isActive} />
                <span>Home</span>
              </>
            )}
          </NavLink>

          <NavLink to="/driver/assigned" style={({ isActive }) => tabStyle(isActive)} aria-label="Deliveries">
            {({ isActive }) => (
              <>
                <Icon name="assigned" active={isActive} />
                <span>Deliveries</span>
              </>
            )}
          </NavLink>

          <NavLink to="/driver/profile" style={({ isActive }) => tabStyle(isActive)} aria-label="Profile">
            {({ isActive }) => (
              <>
                <Icon name="profile" active={isActive} />
                <span>Profile</span>
              </>
            )}
          </NavLink>
        </nav>
      </div>

      {/* ✅ desktop padding boost without changing other pages */}
      <style>{`
        @media (min-width: 1024px){
          main{ padding: 28px 26px 110px !important; }
        }
        @media (min-width: 1440px){
          main{ padding: 34px 32px 118px !important; }
        }
      `}</style>
    </div>
  );
}
