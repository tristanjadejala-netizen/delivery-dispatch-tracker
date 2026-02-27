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
            {autoRefreshSec ? (
              <span className="fp-pill fp-pill-info" style={{ marginLeft: 10 }}>
                Auto {autoRefreshSec}s
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="fp-actions">
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
