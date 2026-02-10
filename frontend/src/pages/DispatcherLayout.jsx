import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import "../styles/fastpass-dashboard.css";
import Icon from "../components/dispatcher/Icons";

function linkClass({ isActive }) {
  return ["fp-btn2", "fp-dnav", isActive ? "fp-dnav-active" : ""]
    .filter(Boolean)
    .join(" ");
}

export default function DispatcherLayout() {
  const nav = useNavigate();
  const loc = useLocation();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    nav("/login", { replace: true });
  }

  // For the create page we still want the nav visible, but we can hide the "Create" button
  const isCreate = loc.pathname.startsWith("/dispatcher/create");

  return (
    <div className="fp-page">
      <div className="fp-container">
        {/* Top navigation (keeps dispatcher pages from feeling cramped) */}
        <div
          className="fp-surface"
          style={{
            marginTop: 0,
            padding: 14,
            position: "sticky",
            top: 14,
            zIndex: 30,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="fp-titleIcon"
                aria-hidden="true"
                style={{ width: 34, height: 34, borderRadius: 12 }}
              >
                <Icon name="route" size={18} />
              </span>
              <div>
                <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>
                  Dispatcher
                </div>
                <div className="fp-muted" style={{ marginTop: 2 }}>
                  Split into pages so the main screen stays clean.
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {!isCreate ? (
                <button
                  className="fp-btn fp-btn-cta"
                  onClick={() => nav("/dispatcher/create")}
                >
                  <Icon name="plus" />
                  Create Order
                </button>
              ) : null}

              <button className="fp-btn fp-btn-solid" onClick={logout}>
                <Icon name="logout" />
                Logout
              </button>
            </div>
          </div>

          <div
            style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <NavLink to="/dispatcher/overview" className={linkClass}>
              <Icon name="home" />
              Overview
            </NavLink>

            <NavLink to="/dispatcher/deliveries" className={linkClass}>
              <Icon name="list" />
              Deliveries
            </NavLink>

            <NavLink to="/dispatcher/reports" className={linkClass}>
              <Icon name="inbox" />
              Reports
            </NavLink>

            <NavLink to="/dispatcher/drivers" className={linkClass}>
              <Icon name="gps" />
              Drivers
            </NavLink>

            <NavLink to="/dispatcher/map" className={linkClass}>
              <Icon name="map" />
              Map
            </NavLink>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <Outlet />
        </div>

        {/* Local styles for nav buttons (keeps changes contained) */}
        <style>{`
          .fp-dnav{ gap:8px; display:inline-flex; align-items:center; font-weight:900; }
          .fp-dnav svg{ opacity:.9 }
          .fp-dnav-active{ background: rgba(37,99,235,.10); border-color: rgba(37,99,235,.28); }
        `}</style>
      </div>
    </div>
  );
}
