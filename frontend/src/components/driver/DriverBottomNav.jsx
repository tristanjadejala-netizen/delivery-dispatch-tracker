import { NavLink } from "react-router-dom";
import { IconBag, IconClock, IconHome, IconUser } from "./DriverIcons";

function Tab({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `drvTab ${isActive ? "isActive" : ""}`}
      aria-label={label}
    >
      {({ isActive }) => (
        <>
          <Icon active={isActive} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function DriverBottomNav() {
  return (
    <div className="drvBottomNav">
      <nav className="drvBottomNavInner">
        <Tab to="/driver/home" label="Home" Icon={IconHome} />
        <Tab to="/driver/assigned" label="Assigned" Icon={IconBag} />
        <Tab to="/driver/history" label="History" Icon={IconClock} />
        <Tab to="/driver/profile" label="Profile" Icon={IconUser} />
      </nav>
    </div>
  );
}
