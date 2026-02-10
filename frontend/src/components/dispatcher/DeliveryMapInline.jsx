import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import Icon from "./Icons";

// Leaflet icon path fix for Vite/React builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
});

const pickupIcon = new L.DivIcon({
  className: "marker pickup-marker",
  html: `<div style="width:14px;height:14px;border-radius:999px;background:rgba(37,99,235,.95);border:2px solid rgba(255,255,255,.9);box-shadow:0 10px 18px rgba(2,6,23,.20)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const dropoffIcon = new L.DivIcon({
  className: "marker dropoff-marker",
  html: `<div style="width:14px;height:14px;border-radius:999px;background:rgba(16,185,129,.95);border:2px solid rgba(255,255,255,.9);box-shadow:0 10px 18px rgba(2,6,23,.20)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const driverIcon = new L.DivIcon({
  className: "marker driver-marker",
  html: `<div style="width:28px;height:28px;border-radius:999px;background:rgba(15,23,42,.90);border:2px solid rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 22px rgba(2,6,23,.28);font-size:15px">🚚</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function FitToPoints({ points, fitKey }) {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(points) || points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15));
      return;
    }

    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [22, 22], maxZoom: 16, animate: true });
  }, [fitKey, map, points]);

  return null;
}

function fmt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function DeliveryMapInline({ referenceNo, onClose }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (!referenceNo) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const { data } = await api.get("/deliveries/track", { params: { ref: referenceNo } });
        if (!alive) return;
        setPayload(data || null);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.message || "Failed to load map");
        setPayload(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [referenceNo]);

  const pickup = payload?.pickup || null;
  const dropoff = payload?.dropoff || null;
  const driverLoc = payload?.driver_location || null;
  const route = payload?.route || null;

  const pointsToFit = useMemo(() => {
    const pts = [];
    if (pickup?.lat && pickup?.lng) pts.push([pickup.lat, pickup.lng]);
    if (dropoff?.lat && dropoff?.lng) pts.push([dropoff.lat, dropoff.lng]);
    if (driverLoc?.lat && driverLoc?.lng) pts.push([Number(driverLoc.lat), Number(driverLoc.lng)]);
    return pts;
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, driverLoc?.lat, driverLoc?.lng]);

  const hasMap = pointsToFit.length > 0;

  return (
    <div className="fp-miniMapWrap">
      <div className="fp-miniMapHeader">
        <div className="fp-miniMapTitle">
          <Icon name="map" />
          Live Map Preview
          <span className="fp-pill" style={{ marginLeft: 8 }}>{referenceNo}</span>
        </div>
        <button className="fp-btn2" onClick={onClose}>
          <Icon name="close" />
          Close
        </button>
      </div>

      <div className="fp-miniMapBody">
        {loading ? (
          <div className="fp-muted" style={{ padding: 12 }}>Loading map…</div>
        ) : err ? (
          <div className="fp-alert" style={{ margin: 12 }}>
            <span className="fp-alertIcon" aria-hidden="true"><Icon name="alert" /></span>
            <div>{err}</div>
          </div>
        ) : !hasMap ? (
          <div className="fp-muted" style={{ padding: 12 }}>No coordinates available yet for this delivery.</div>
        ) : (
          <MapContainer center={pointsToFit[0]} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitToPoints points={pointsToFit} fitKey={referenceNo} />

            {Array.isArray(route) && route.length >= 2 ? <Polyline positions={route} /> : null}

            {pickup?.lat && pickup?.lng ? (
              <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>Pickup</Tooltip>
              </Marker>
            ) : null}

            {dropoff?.lat && dropoff?.lng ? (
              <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>Dropoff</Tooltip>
              </Marker>
            ) : null}

            {driverLoc?.lat && driverLoc?.lng ? (
              <Marker position={[Number(driverLoc.lat), Number(driverLoc.lng)]} icon={driverIcon}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  Driver {payload?.driver?.name ? `(${payload.driver.name})` : ""}
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                    Updated: {fmt(driverLoc.updated_at)}
                  </div>
                </Tooltip>
              </Marker>
            ) : null}
          </MapContainer>
        )}
      </div>

      <div className="fp-miniMapMeta">
        <div className="fp-miniMapMetaRow">
          <div className="fp-miniMapMetaKey">Pickup</div>
          <div className="fp-miniMapMetaVal">{payload?.delivery?.pickup_address || "—"}</div>
        </div>
        <div className="fp-miniMapMetaRow">
          <div className="fp-miniMapMetaKey">Dropoff</div>
          <div className="fp-miniMapMetaVal">{payload?.delivery?.dropoff_address || "—"}</div>
        </div>
        <div className="fp-miniMapMetaRow">
          <div className="fp-miniMapMetaKey">Driver</div>
          <div className="fp-miniMapMetaVal">
            {payload?.driver?.name || "—"}
            <div className="fp-muted fp-mt-xs">
              Last GPS: {payload?.driver_location?.updated_at ? fmt(payload.driver_location.updated_at) : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
