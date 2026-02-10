// frontend/src/components/dispatcher/DispatcherMapModal.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import Icon from "./Icons";

// Fix default marker icon paths (important for Vite/React builds)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
});

const pickupIcon = new L.DivIcon({
  className: "marker pickup-marker",
  html: `<div class="pin pin-pickup"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const dropoffIcon = new L.DivIcon({
  className: "marker dropoff-marker",
  html: `<div class="pin pin-dropoff"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const driverIcon = new L.DivIcon({
  className: "marker driver-marker",
  html: `<div class="pin pin-driver">🚚</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function FitToPoints({ points, fitKey }) {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(points) || points.length === 0) return;

    if (points.length === 1) {
      map.flyTo(points[0], Math.max(map.getZoom(), 15), { duration: 0.8 });
      return;
    }

    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, {
      padding: [30, 30],
      maxZoom: 16,
      animate: true,
      duration: 0.8,
    });
  }, [fitKey, map, points]);

  return null;
}

function fmt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function DispatcherMapModal({ open, referenceNo, onClose }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (!open) return;
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
        setErr(e?.response?.data?.message || "Failed to load tracking map");
        setPayload(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, referenceNo]);

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

  if (!open) return null;

  return (
    <div className="fp-modalOverlay" role="dialog" aria-modal="true" aria-label="Delivery Map">
      <div className="fp-modal">
        <div className="fp-modalHeader">
          <div>
            <div className="fp-modalTitle">
              <span className="fp-modalTitleIcon" aria-hidden="true">
                <Icon name="map" />
              </span>
              Map View
              <span className="fp-pill" style={{ marginLeft: 10 }}>
                {referenceNo}
              </span>
            </div>
            <div className="fp-muted fp-mt-xs">
              Pickup, dropoff, and last known driver location (if assigned).
            </div>
          </div>

          <button className="fp-btn2" onClick={onClose} aria-label="Close">
            <Icon name="close" />
            Close
          </button>
        </div>

        <div className="fp-modalBody">
          {loading ? (
            <div className="fp-muted">Loading map…</div>
          ) : err ? (
            <div className="fp-alert" role="alert" aria-live="polite" style={{ marginTop: 0 }}>
              <span className="fp-alertIcon" aria-hidden="true">
                <Icon name="alert" />
              </span>
              <div>{err}</div>
            </div>
          ) : !hasMap ? (
            <div className="fp-muted">No coordinates available yet for this delivery.</div>
          ) : (
            <div className="fp-mapShell">
              <MapContainer
                center={pointsToFit[0]}
                zoom={13}
                scrollWheelZoom
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FitToPoints points={pointsToFit} fitKey={referenceNo} />

                {Array.isArray(route) && route.length >= 2 ? <Polyline positions={route} /> : null}

                {pickup?.lat && pickup?.lng ? (
                  <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                      Pickup
                    </Tooltip>
                  </Marker>
                ) : null}

                {dropoff?.lat && dropoff?.lng ? (
                  <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                      Dropoff
                    </Tooltip>
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
            </div>
          )}

          <div className="fp-modalMeta">
            <div className="fp-modalMetaCol">
              <div className="fp-muted">Pickup</div>
              <div className="fp-kvStrong">{payload?.delivery?.pickup_address || "—"}</div>
            </div>
            <div className="fp-modalMetaCol">
              <div className="fp-muted">Dropoff</div>
              <div className="fp-kvStrong">{payload?.delivery?.dropoff_address || "—"}</div>
            </div>
            <div className="fp-modalMetaCol">
              <div className="fp-muted">Driver</div>
              <div className="fp-kvStrong">{payload?.driver?.name || "—"}</div>
              <div className="fp-muted fp-mt-xs">
                Last GPS: {payload?.driver_location?.updated_at ? fmt(payload.driver_location.updated_at) : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
