import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/fastpass-dashboard.css";
import "../styles/fastpass-dispatcher-shell.css";
import Icon from "../components/dispatcher/Icons";

function navItemClass({ isActive }) {
  return ["fps-navItem", isActive ? "is-active" : ""].filter(Boolean).join(" ");
}

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const ini = parts.map((p) => p[0] || "").join("");
  return (ini || "U").toUpperCase();
}

function roleLabel(raw) {
  const r = String(raw || "").toUpperCase();
  if (r === "ADMIN" || r === "DISPATCHER") return "Admin/Dispatcher";
  if (r === "DRIVER") return "Driver";
  return r ? r[0] + r.slice(1).toLowerCase() : "Dispatcher";
}

function readSidebarProfile() {
  const name =
    localStorage.getItem("fp_display_name") ||
    localStorage.getItem("name") ||
    "Dispatcher";

  const role =
    localStorage.getItem("fp_display_role") ||
    localStorage.getItem("role") ||
    "DISPATCHER";

  const avatarUrl =
    localStorage.getItem("fp_avatar_url") ||
    localStorage.getItem("avatar_url") ||
    "";

  return { name, role, avatarUrl };
}

export default function DispatcherLayout() {
  const nav = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");

    // also clear profile cache used by the sidebar
    localStorage.removeItem("fp_display_name");
    localStorage.removeItem("fp_display_role");
    localStorage.removeItem("fp_avatar_url");

    nav("/login", { replace: true });
  }

  const [{ name, role, avatarUrl }, setProfile] = useState(() =>
    readSidebarProfile(),
  );

  // ✅ Live updates (same tab + other tabs)
  useEffect(() => {
    const sync = () => setProfile(readSidebarProfile());

    const onUpdated = () => sync(); // same-tab custom event
    const onStorage = (e) => {
      if (!e) return;
      if (
        e.key === "fp_display_name" ||
        e.key === "fp_display_role" ||
        e.key === "fp_avatar_url" ||
        e.key === "name" ||
        e.key === "role" ||
        e.key === "avatar_url"
      ) {
        sync();
      }
    };

    window.addEventListener("fp_profile_updated", onUpdated);
    window.addEventListener("storage", onStorage);

    sync();

    return () => {
      window.removeEventListener("fp_profile_updated", onUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <div className="fps-shell">
      {/* Sidebar */}
      <aside className="fps-sidebar" aria-label="FastPaSS sidebar">
        <div className="fps-brand">
          <div className="fps-brandMark" aria-hidden="true">
            <Icon name="route" size={18} />
          </div>
          <div className="fps-brandText">
            <div className="fps-brandName">
              Fast<span>PaSS</span>
            </div>
            <div className="fps-brandSub">Dispatcher</div>
          </div>
        </div>

        <nav className="fps-nav" aria-label="Primary navigation">
          <NavLink to="/dispatcher/overview" className={navItemClass} end>
            <span className="fps-navIcon" aria-hidden="true">
              <Icon name="home" size={18} />
            </span>
            Dashboard
          </NavLink>

          <NavLink to="/dispatcher/create" className={navItemClass}>
            <span className="fps-navIcon" aria-hidden="true">
              <Icon name="plus" size={18} />
            </span>
            Create Order
          </NavLink>

          <NavLink to="/dispatcher/deliveries" className={navItemClass}>
            <span className="fps-navIcon" aria-hidden="true">
              <Icon name="truck" size={18} />
            </span>
            Deliveries
          </NavLink>

          <NavLink to="/dispatcher/reports" className={navItemClass}>
            <span className="fps-navIcon" aria-hidden="true">
              <Icon name="inbox" size={18} />
            </span>
            Feedback
          </NavLink>

          <NavLink to="/dispatcher/map" className={navItemClass}>
            <span className="fps-navIcon" aria-hidden="true">
              <Icon name="map" size={18} />
            </span>
            Map
          </NavLink>

          <NavLink to="/dispatcher/drivers" className={navItemClass}>
            <span className="fps-navIcon" aria-hidden="true">
              <Icon name="gps" size={18} />
            </span>
            Drivers
          </NavLink>
        </nav>

        <div className="fps-sideSpacer" />

        <div className="fps-sideFooter">

          <NavLink to="/dispatcher/profile" className={navItemClass}>
            <span className="fps-navIcon" aria-hidden="true">
              <Icon name="user" size={18} />
            </span>
            Profile
          </NavLink>

          <NavLink to="/dispatcher/settings" className={navItemClass}>
            <span className="fps-navIcon" aria-hidden="true">
              <Icon name="settings" size={18} />
            </span>
            Setting
          </NavLink>

          <NavLink to="/dispatcher/notifications" className={navItemClass}>
            <span className="fps-navIcon" aria-hidden="true">
              <Icon name="bell" size={18} />
            </span>
            Notifications
          </NavLink>

          <div className="fps-userRow">
            {/* ✅ Avatar: image if available, else initials */}
            <div
              className="fps-avatar"
              aria-hidden="true"
              style={{ overflow: "hidden" }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    pointerEvents: "none", // ✅ prevents image from blocking clicks
                  }}
                  onError={(e) => {
                    // If image fails, remove it so initials show
                    e.currentTarget.remove();
                  }}
                />
              ) : (
                initialsFromName(name)
              )}
            </div>

            <div className="fps-userMeta">
              <div className="fps-userName">{name}</div>
              <div className="fps-userRole">{roleLabel(role)}</div>
            </div>

            <button
              className="fps-logout"
              type="button"
              onClick={logout}
              title="Logout"
              aria-label="Logout"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="fps-main">
        {/* Top header bar */}
        <header className="fps-topbar">
          <div className="fps-topbarLeft" />
          <div className="fps-topbarRight">
            <span className="fps-pill">Dispatcher/Admin</span>
          </div>
        </header>

        <main className="fps-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
