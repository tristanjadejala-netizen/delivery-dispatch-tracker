import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

function safe(v) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function normStatus(s) {
  const t = String(s || "").toUpperCase().trim();
  return t || "PENDING";
}

function pillClass(status) {
  const s = normStatus(status);
  if (s === "DELIVERED") return "drvPill drvPill--online";
  if (s === "FAILED") return "drvPill drvPill--danger";
  if (s === "CANCELLED") return "drvPill drvPill--offline";
  return "drvPill drvPill--info";
}

function fmtDay(iso) {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const a1 = Number(lat1);
  const o1 = Number(lon1);
  const a2 = Number(lat2);
  const o2 = Number(lon2);
  if ([a1, o1, a2, o2].some((n) => Number.isNaN(n))) return null;

  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(a2 - a1);
  const dLon = toRad(o2 - o1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasPOD(d) {
  return Boolean(
    d?.pod_photo_url ||
      d?.pod_photo ||
      d?.proof_photo_url ||
      d?.photo_url ||
      d?.pod_url ||
      d?.signature_url ||
      d?.recipient_name
  );
}

function failReason(d) {
  return d?.reason || d?.fail_reason || d?.failure_reason || d?.status_reason || "";
}

export default function DriverHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  // UX controls
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL"); // ALL | DELIVERED | FAILED | CANCELLED

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/driver/deliveries");
        const all = Array.isArray(data?.rows) ? data.rows : [];

        // "History" = non-active
        const hist = all
          .filter((d) => !["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(normStatus(d.status)))
          .slice()
          .sort((a, b) => {
            const ta = new Date(a.updated_at || a.created_at || 0).getTime();
            const tb = new Date(b.updated_at || b.created_at || 0).getTime();
            return tb - ta;
          });

        if (alive) setRows(hist);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((d) => {
      const st = normStatus(d.status);
      if (filter !== "ALL" && st !== filter) return false;

      if (!qq) return true;

      const hay = [
        d.reference_no,
        d.id,
        d.pickup_address,
        d.dropoff_address,
        d.customer_name,
        d.customer_contact,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" | ");

      return hay.includes(qq);
    });
  }, [rows, q, filter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const d of filteredRows) {
      const key = fmtDay(d.updated_at || d.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    }
    return Array.from(map.entries());
  }, [filteredRows]);

  const totalLabel = useMemo(() => {
    if (filter === "ALL") return `${filteredRows.length} total`;
    return `${filteredRows.length} ${filter.toLowerCase()}`;
  }, [filteredRows.length, filter]);

  return (
    <div className="drvStack">
      {/* Header card */}
      <div className="drvCard drvCardPad">
        <div className="drvCardHeader">
          <div>
            <p className="drvTitle">Delivery History</p>
            <p className="drvSub">Search, filter, and tap an item to view details.</p>
          </div>
          <span className="drvPill">{totalLabel}</span>
        </div>

        {/* Search */}
        <div style={{ marginTop: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search REF, address, customer…"
            style={{
              width: "100%",
              height: 44,
              borderRadius: 16,
              border: "1px solid rgba(15,23,42,0.10)",
              padding: "0 12px",
              font: "inherit",
              fontWeight: 900,
              outline: "none",
              background: "rgba(255,255,255,0.95)",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 2 }}>
          {[
            { key: "ALL", label: "All" },
            { key: "DELIVERED", label: "Delivered" },
            { key: "FAILED", label: "Failed" },
            { key: "CANCELLED", label: "Cancelled" },
          ].map((c) => {
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className="drvTap"
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 999,
                  border: active ? "1px solid rgba(0,112,255,0.28)" : "1px solid rgba(15,23,42,0.10)",
                  background: active ? "rgba(0,112,255,0.10)" : "rgba(255,255,255,0.85)",
                  fontWeight: 1000,
                  fontSize: 12,
                  color: active ? "#0b3b8f" : "#334155",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="drvStack">
          <div className="drvCard drvCardPad">
            <div className="drvSkel" style={{ height: 14, width: 160 }} />
            <div className="drvSkel" style={{ height: 12, width: 240, marginTop: 10 }} />
            <div className="drvSkel" style={{ height: 56, width: "100%", marginTop: 14 }} />
          </div>
          <div className="drvCard drvCardPad">
            <div className="drvSkel" style={{ height: 14, width: 140 }} />
            <div className="drvSkel" style={{ height: 56, width: "100%", marginTop: 14 }} />
          </div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="drvCard drvCardPad">
          <p className="drvTitle">No results</p>
          <p className="drvSub">Try adjusting your search or filters.</p>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day} className="drvStack">
            {/* Sticky date header */}
            <div
              style={{
                position: "sticky",
                top: 56, // sits below TopBar
                zIndex: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 2px",
                backdropFilter: "blur(10px)",
                background: "rgba(248, 249, 251, 0.82)",
                borderRadius: 12,
              }}
            >
              <p style={{ margin: 0, fontSize: 12, fontWeight: 1000, color: "#334155" }}>{day}</p>
              <span className="drvPill">{items.length}</span>
            </div>

            <div className="drvList">
              {items.map((d) => {
                const id = d.id;
                const open = openId === id;
                const st = normStatus(d.status);

                const updatedIso = d.updated_at || d.created_at;
                const timeLabel = fmtTime(updatedIso);

                const km = haversineKm(d.pickup_lat, d.pickup_lng, d.dropoff_lat, d.dropoff_lng);
                const distLabel = km ? `${km.toFixed(1)} km` : null;

                const pod = hasPOD(d);
                const reason = failReason(d);

                return (
                  <div key={id} className="drvCard drvPress drvTap" onClick={() => setOpenId(open ? null : id)}>
                    {/* Main row */}
                    <div className="drvRow" style={{ alignItems: "flex-start" }}>
                      <div className="drvRowMain" style={{ gap: 6 }}>
                        {/* Top: ref */}
                        <div className="drvRowTitle" style={{ fontSize: 13 }}>
                          REF: {safe(d.reference_no || `#${d.id}`)}
                        </div>

                        {/* Route (2-line clamp) */}
                        <div
                          className="drvRowSub"
                          style={{
                            whiteSpace: "normal",
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            lineHeight: 1.35,
                            fontSize: 12,
                          }}
                        >
                          {safe(d.pickup_address)} → {safe(d.dropoff_address)}
                        </div>

                        {/* Meta row */}
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                            marginTop: 2,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 1000,
                              color: "rgba(100,116,139,0.95)",
                              background: "rgba(255,255,255,0.75)",
                              border: "1px solid rgba(15,23,42,0.08)",
                              padding: "4px 8px",
                              borderRadius: 999,
                            }}
                          >
                            {timeLabel}
                          </span>

                          {distLabel ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 1000,
                                color: "rgba(100,116,139,0.95)",
                                background: "rgba(255,255,255,0.75)",
                                border: "1px solid rgba(15,23,42,0.08)",
                                padding: "4px 8px",
                                borderRadius: 999,
                              }}
                            >
                              {distLabel}
                            </span>
                          ) : null}

                          {pod ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 1000,
                                color: "#14532d",
                                background: "rgba(22,163,74,0.10)",
                                border: "1px solid rgba(22,163,74,0.18)",
                                padding: "4px 8px",
                                borderRadius: 999,
                              }}
                            >
                              POD
                            </span>
                          ) : null}

                          {st === "FAILED" && reason ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 1000,
                                color: "#7f1d1d",
                                background: "rgba(239,68,68,0.10)",
                                border: "1px solid rgba(239,68,68,0.18)",
                                padding: "4px 8px",
                                borderRadius: 999,
                                maxWidth: 220,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={reason}
                            >
                              {reason.replaceAll("_", " ")}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <span className={pillClass(d.status)}>{st.replaceAll("_", " ")}</span>
                    </div>

                    {/* Expanded details */}
                    {open ? (
                      <div style={{ padding: "0 14px 14px" }}>
                        <div
                          style={{
                            borderTop: "1px solid rgba(15,23,42,0.06)",
                            paddingTop: 12,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 1000, color: "#334155" }}>Pickup</div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", lineHeight: 1.35 }}>
                              {safe(d.pickup_address)}
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 1000, color: "#334155" }}>Drop-off</div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", lineHeight: 1.35 }}>
                              {safe(d.dropoff_address)}
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Customer</span>
                            <span style={{ fontSize: 12, fontWeight: 1000, color: "#0f172a", textAlign: "right" }}>
                              {safe(d.customer_name)}
                            </span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Contact</span>
                            <span style={{ fontSize: 12, fontWeight: 1000, color: "#0f172a", textAlign: "right" }}>
                              {safe(d.customer_contact)}
                            </span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Updated</span>
                            <span style={{ fontSize: 12, fontWeight: 1000, color: "#0f172a", textAlign: "right" }}>
                              {safe(new Date(updatedIso || 0).toLocaleString())}
                            </span>
                          </div>

                          {st === "FAILED" && reason ? (
                            <div style={{ fontSize: 12, color: "#7f1d1d", fontWeight: 900, lineHeight: 1.4 }}>
                              <span style={{ color: "#334155" }}>Reason: </span>
                              {reason.replaceAll("_", " ")}
                            </div>
                          ) : null}

                          {d.notes ? (
                            <div style={{ fontSize: 12, color: "#475569", fontWeight: 800, lineHeight: 1.4 }}>
                              {safe(d.notes)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}