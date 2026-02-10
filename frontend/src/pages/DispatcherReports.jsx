import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";

import "../styles/fastpass-dashboard.css";
import Icon from "../components/dispatcher/Icons";

function fmt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function Stars({ value = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div
      style={{ display: "inline-flex", gap: 3, alignItems: "center" }}
      aria-label={`${v} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const on = i + 1 <= v;
        return (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              display: "inline-block",
              background: on ? "#f59e0b" : "rgba(15,23,42,.14)",
              boxShadow: on ? "0 0 0 2px rgba(245,158,11,.20)" : "none",
            }}
          />
        );
      })}
      <span className="fp-muted" style={{ marginLeft: 6, fontWeight: 900 }}>
        {v.toFixed(0)}
      </span>
    </div>
  );
}

export default function DispatcherReports() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");

  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState(null);

  const [limit] = useState(50);
  const [page, setPage] = useState(1);

  const pages = useMemo(() => {
    return Math.max(1, Math.ceil((count || 0) / limit));
  }, [count, limit]);

  async function load(p = page) {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/deliveries/feedback", {
        params: {
          q: q || "",
          min_rating: minRating !== "" ? Number(minRating) : undefined,
          max_rating: maxRating !== "" ? Number(maxRating) : undefined,
          limit,
          offset: (p - 1) * limit,
        },
      });

      setRows(data.rows || []);
      setCount(Number(data.count) || 0);
      setSummary(data.summary || null);
    } catch (e) {
      setErr(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Failed to load reports",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  function applyFilters() {
    setPage(1);
    load(1);
  }

  function clearFilters() {
    setQ("");
    setMinRating("");
    setMaxRating("");
    setPage(1);
    load(1);
  }

  function go(p) {
    const next = Math.max(1, Math.min(pages, p));
    setPage(next);
    load(next);
  }

  return (
    <>
      <div className="fp-header" style={{ marginTop: 0 }}>
        <div>
          <h1 className="fp-title">
            <span className="fp-titleIcon" aria-hidden="true">
              <Icon name="inbox" size={18} />
            </span>
            Reports
          </h1>
          <div className="fp-sub">
            Customer feedback (ratings + comments) submitted after deliveries
            are marked DELIVERED.
          </div>
        </div>

        <div className="fp-actions">
          <button
            className="fp-btn fp-btn-solid"
            onClick={() => load(page)}
            disabled={loading}
          >
            <Icon name="refresh" />
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <div
          className="fp-alert"
          role="alert"
          aria-live="polite"
          style={{ marginTop: 14 }}
        >
          <span className="fp-alertIcon" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <div>{err}</div>
        </div>
      ) : null}

      <div
        className="fp-grid"
        style={{ marginTop: 14, gridTemplateColumns: "1.2fr .8fr" }}
      >
        <div className="fp-surface" style={{ padding: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>
                Feedback Summary
              </div>
              <div className="fp-muted" style={{ marginTop: 2 }}>
                Total: <b>{summary?.total ?? 0}</b> • Average rating:{" "}
                <b>{summary?.avg_rating ?? 0}</b>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[5, 4, 3, 2, 1].map((n) => (
                <div
                  key={n}
                  className="fp-pill"
                  style={{
                    display: "inline-flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 950 }}>{n}★</div>
                  <div className="fp-muted" style={{ fontWeight: 900 }}>
                    {(n === 5
                      ? summary?.five_star
                      : n === 4
                        ? summary?.four_star
                        : n === 3
                          ? summary?.three_star
                          : n === 2
                            ? summary?.two_star
                            : summary?.one_star) ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fp-surface" style={{ padding: 14 }}>
          <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>Filters</div>
          <div className="fp-muted" style={{ marginTop: 2 }}>
            Search by order ref, customer, or comment.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <div className="fp-field">
              <label className="fp-label">Search</label>
              <div className="fp-inputWrap">
                <span className="fp-inputIcon" aria-hidden="true">
                  <Icon name="search" />
                </span>
                <input
                  className="fp-input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="e.g. ORD-..., email, name, comment"
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <div className="fp-field">
                <label className="fp-label">Min rating</label>
                <input
                  className="fp-input"
                  inputMode="numeric"
                  value={minRating}
                  onChange={(e) =>
                    setMinRating(
                      e.target.value.replace(/[^0-9]/g, "").slice(0, 1),
                    )
                  }
                  placeholder="1"
                />
              </div>
              <div className="fp-field">
                <label className="fp-label">Max rating</label>
                <input
                  className="fp-input"
                  inputMode="numeric"
                  value={maxRating}
                  onChange={(e) =>
                    setMaxRating(
                      e.target.value.replace(/[^0-9]/g, "").slice(0, 1),
                    )
                  }
                  placeholder="5"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="fp-btn fp-btn-solid"
                onClick={applyFilters}
                disabled={loading}
              >
                <Icon name="search" />
                Apply
              </button>
              <button
                className="fp-btn"
                onClick={clearFilters}
                disabled={loading}
              >
                <Icon name="close" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="fp-surface"
        style={{ marginTop: 14, padding: 0, overflow: "hidden" }}
      >
        <div
          style={{
            padding: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>
            Feedback Entries
          </div>
          <div className="fp-muted" style={{ fontWeight: 900 }}>
            {loading ? "Loading…" : `${count} total`}
          </div>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <table className="fp-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ width: 170 }}>Order</th>
                <th style={{ width: 210 }}>Customer</th>
                <th style={{ width: 120 }}>Rating</th>
                <th>Comment</th>
                <th style={{ width: 190 }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => {
                  const driverLabel =
                    r.driver_name ||
                    (r.assigned_driver_id
                      ? `Driver #${r.assigned_driver_id}`
                      : "—");

                  return (
                    <tr key={`${r.delivery_id}-${r.created_at}`}>
                      <td>
                        <div style={{ fontWeight: 950 }}>
                          {r.reference_no || `#${r.delivery_id}`}
                        </div>
                        <div
                          className="fp-muted"
                          style={{ marginTop: 2, fontWeight: 900 }}
                        >
                          {r.status || "—"}
                        </div>

                        <div className="fp-muted" style={{ marginTop: 6 }}>
                          <span style={{ fontWeight: 900 }}>Driver:</span>{" "}
                          <span style={{ fontWeight: 950 }}>{driverLabel}</span>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 950 }}>
                          {r.customer_name || "Customer"}
                        </div>
                        <div
                          className="fp-muted"
                          style={{ marginTop: 2, fontWeight: 900 }}
                        >
                          {r.customer_email || "—"}
                        </div>
                      </td>
                      <td>
                        <Stars value={r.rating} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 900, lineHeight: 1.35 }}>
                          {r.comment ? (
                            r.comment
                          ) : (
                            <span className="fp-muted">(no comment)</span>
                          )}
                        </div>
                        <div className="fp-muted" style={{ marginTop: 4 }}>
                          <span style={{ fontWeight: 900 }}>Pickup:</span>{" "}
                          {r.pickup_address || "—"}
                          <span style={{ margin: "0 6px" }}>•</span>
                          <span style={{ fontWeight: 900 }}>Dropoff:</span>{" "}
                          {r.dropoff_address || "—"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 900 }}>
                          {fmt(r.created_at)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: 18 }}>
                    <div className="fp-muted" style={{ fontWeight: 900 }}>
                      {loading ? "Loading…" : "No feedback found."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div className="fp-muted" style={{ fontWeight: 900 }}>
            Page <b>{page}</b> of <b>{pages}</b>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="fp-btn"
              onClick={() => go(1)}
              disabled={loading || page <= 1}
            >
              First
            </button>
            <button
              className="fp-btn"
              onClick={() => go(page - 1)}
              disabled={loading || page <= 1}
            >
              Prev
            </button>
            <button
              className="fp-btn"
              onClick={() => go(page + 1)}
              disabled={loading || page >= pages}
            >
              Next
            </button>
            <button
              className="fp-btn"
              onClick={() => go(pages)}
              disabled={loading || page >= pages}
            >
              Last
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .fp-table{ width:100%; border-collapse: separate; border-spacing: 0; }
        .fp-table th{ text-align:left; font-weight:950; padding:12px 14px; background: rgba(2,6,23,.03); border-bottom:1px solid rgba(2,6,23,.08); }
        .fp-table td{ padding:12px 14px; border-bottom:1px solid rgba(2,6,23,.06); vertical-align: top; }
        .fp-table tr:hover td{ background: rgba(37,99,235,.04); }
        .fp-pill{ padding:8px 10px; border:1px solid rgba(2,6,23,.10); border-radius:999px; background: rgba(255,255,255,.7); }
        @media (max-width: 980px){
          .fp-grid{ gridTemplateColumns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
