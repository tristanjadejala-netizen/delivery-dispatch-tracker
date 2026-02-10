import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import "leaflet/dist/leaflet.css";

import DeliveryMapInline from "../components/dispatcher/DeliveryMapInline";
import Icon from "../components/dispatcher/Icons";

export default function DispatcherMap() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [deliveries, setDeliveries] = useState([]);

  const [ref, setRef] = useState("");
  const [openRef, setOpenRef] = useState("");

  async function loadDeliveries() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/deliveries", {
        params: { status: "ALL", q: "", limit: 50, offset: 0 },
      });
      setDeliveries(data.rows || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => {
    // Prefer active first
    const rows = deliveries || [];
    const active = rows.filter((d) => !["DELIVERED", "FAILED", "CANCELLED"].includes(d.status));
    const rest = rows.filter((d) => ["DELIVERED", "FAILED", "CANCELLED"].includes(d.status));
    return [...active, ...rest]
      .filter((d) => d.reference_no)
      .map((d) => ({
        ref: d.reference_no,
        label: `${d.reference_no} — ${d.status}${d.customer_name ? ` — ${d.customer_name}` : ""}`,
      }));
  }, [deliveries]);

  function open() {
    const r = ref.trim();
    if (!r) return;
    setOpenRef(r);
  }

  return (
    <>
      <div className="fp-header" style={{ marginTop: 0 }}>
        <div>
          <h1 className="fp-title">
            <span className="fp-titleIcon" aria-hidden="true">
              <Icon name="map" size={18} />
            </span>
            Map
          </h1>
          <div className="fp-sub">Pick a delivery reference number to view pickup, dropoff, and driver location.</div>
        </div>

        <div className="fp-actions">
          <button className="fp-btn fp-btn-solid" onClick={loadDeliveries} disabled={loading}>
            <Icon name="refresh" />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="fp-alert" role="alert" aria-live="polite" style={{ marginTop: 14 }}>
          <span className="fp-alertIcon" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <div>{err}</div>
        </div>
      ) : null}

      <div className="fp-surface" style={{ marginTop: 14 }}>
        <div className="fp-surfaceHeader">
          <div>
            <div className="fp-surfaceTitle">
              <span className="fp-surfaceTitleIcon" aria-hidden="true">
                <Icon name="search" />
              </span>
              Choose a delivery
            </div>
            <div className="fp-muted fp-mt-xs">This is a dedicated map page so the Deliveries page stays clean.</div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select className="fp-select" value={ref} onChange={(e) => setRef(e.target.value)} style={{ minWidth: 320 }}>
              <option value="">Select reference…</option>
              {options.map((o) => (
                <option key={o.ref} value={o.ref}>
                  {o.label}
                </option>
              ))}
            </select>

            <button className="fp-btn2 fp-btn2-primary" onClick={open} disabled={!ref.trim()}>
              <Icon name="map" />
              Open map
            </button>
          </div>
        </div>
      </div>

      {openRef ? (
        <div style={{ marginTop: 14 }}>
          <DeliveryMapInline referenceNo={openRef} onClose={() => setOpenRef("")} />
        </div>
      ) : null}
    </>
  );
}
