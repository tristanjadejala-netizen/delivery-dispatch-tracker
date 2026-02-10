// frontend/src/components/dispatcher/DashboardHeader.jsx
import Icon from "./Icons";

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function DashboardHeader({
  loading,
  onCreate,
  onRefresh,
  autoRefreshSec,
  setAutoRefreshSec,
  lastUpdatedAt,
}) {
  return (
    <div className="fp-header">
      <div>
        <h1 className="fp-title">
          <span className="fp-titleIcon" aria-hidden="true">
            <Icon name="route" size={18} />
          </span>
          Dispatcher Dashboard
        </h1>
        <div className="fp-sub">
          Manage assignments, verify POD, and review failed deliveries.
          <span className="fp-subMeta">
            <span className="fp-subDot" aria-hidden="true" />
            Updated: <b>{fmtTime(lastUpdatedAt)}</b>
            {autoRefreshSec ? (
              <span className="fp-pill fp-pill-info" style={{ marginLeft: 10 }}>
                Auto {autoRefreshSec}s
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="fp-actions">
        <div className="fp-autoRefresh">
          <span className="fp-muted" style={{ fontWeight: 850 }}>
            Auto-refresh
          </span>
          <select
            className="fp-miniSelect"
            value={String(autoRefreshSec || 0)}
            onChange={(e) => setAutoRefreshSec(Number(e.target.value || 0))}
            aria-label="Auto refresh interval"
          >
            <option value="0">Off</option>
            <option value="15">15s</option>
            <option value="30">30s</option>
            <option value="60">60s</option>
          </select>
        </div>

        <button className="fp-btn fp-btn-cta" onClick={onCreate}>
          <Icon name="plus" />
          Create Order
        </button>

        <button className="fp-btn fp-btn-solid" onClick={onRefresh} disabled={loading}>
          <Icon name="refresh" />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
