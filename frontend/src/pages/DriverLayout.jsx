import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import api from "../lib/api";

import "../styles/driver-mobile.css";

import DriverTopBar from "../components/driver/DriverTopBar";
import DriverBottomNav from "../components/driver/DriverBottomNav";
import "../styles/fastpass-dashboard.css";
import "../styles/fastpass-dispatcher-shell.css";
export default function DriverLayout() {
  // =========================================================
  // Live Driver Location Tracking (while logged in as DRIVER)
  // - Posts GPS to backend: POST /driver/location
  // - Throttled to reduce battery/network usage
  // =========================================================
  const watchIdRef = useRef(null);
  const lastSentRef = useRef({ t: 0, lat: null, lng: null });
  const inFlightRef = useRef(false);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "DRIVER") return;

    if (!("geolocation" in navigator)) return;

    // prevent duplicate watch if hot-reload/mount edge cases
    if (watchIdRef.current != null) return;

    const MIN_SEND_MS = 5000; // send at most every 5s
    const MIN_MOVE_M = 12; // or moved ~12m

    const haversineM = (aLat, aLng, bLat, bLng) => {
      const R = 6371000;
      const toRad = (v) => (v * Math.PI) / 180;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const aa =
        s1 * s1 +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    };

    const maybeSend = async (pos) => {
      const now = Date.now();
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;

      const last = lastSentRef.current;
      const timeOk = now - (last.t || 0) >= MIN_SEND_MS;

      let moveOk = true;
      if (typeof last.lat === "number" && typeof last.lng === "number") {
        const moved = haversineM(last.lat, last.lng, latitude, longitude);
        moveOk = moved >= MIN_MOVE_M;
      }

      // throttle by time AND movement
      if (!timeOk && !moveOk) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      try {
        await api.post("/driver/location", {
          lat: latitude,
          lng: longitude,
          accuracy: typeof accuracy === "number" ? accuracy : null,
          heading: typeof heading === "number" ? heading : null,
          speed: typeof speed === "number" ? speed : null,
        });
        lastSentRef.current = { t: now, lat: latitude, lng: longitude };
      } catch {
        // silent (keep UI clean)
      } finally {
        inFlightRef.current = false;
      }
    };

    const onError = () => {
      // silent: permission denied / unavailable
    };

    watchIdRef.current = navigator.geolocation.watchPosition(maybeSend, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });

    return () => {
      if (watchIdRef.current != null) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch {
          // ignore
        }
      }
      watchIdRef.current = null;
      inFlightRef.current = false;
    };
  }, []);

  return (
    <div className="drvApp">
      <div className="drvFrame">
        <DriverTopBar />
        <main className="drvContent">
          <Outlet />
        </main>
        <div style={{ height: 0 }} />
      </div>

      <DriverBottomNav />
    </div>
  );
}
