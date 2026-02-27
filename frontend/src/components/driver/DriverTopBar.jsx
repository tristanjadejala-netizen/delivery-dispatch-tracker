import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { IconBell } from "./DriverIcons";

function titleFor(pathname) {
  if (pathname.includes("/driver/home")) return { title: "Home", subtitle: "Today’s route" };
  if (pathname.includes("/driver/assigned")) return { title: "Assigned", subtitle: "Active mission" };
  if (pathname.includes("/driver/history")) return { title: "History", subtitle: "Past deliveries" };
  if (pathname.includes("/driver/profile")) return { title: "Profile", subtitle: "Account & settings" };
  return { title: "Driver", subtitle: "FastPaSS" };
}

export default function DriverTopBar() {
  const loc = useLocation();
  const meta = useMemo(() => titleFor(loc.pathname), [loc.pathname]);

  return (
    <header className="drvTopBar">
      <div className="drvTopBarRow">
        <div className="drvTopTitle">
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
        </div>

        <button
          type="button"
          className="drvIconBtn"
          aria-label="Notifications"
          title="Notifications"
          disabled
        >
          <IconBell />
        </button>
      </div>
    </header>
  );
}
