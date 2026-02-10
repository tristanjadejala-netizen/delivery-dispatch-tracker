import Icon from "./Icons";

const STALE_MIN = 10;

function fmt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function minsSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 60000);
}

function ageLabel(mins) {
  if (!Number.isFinite(mins)) return "—";
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ago`;
}

export default function DriverLocationsTable({
  rows = [],
  onRowClick,
}) {
  return (
    <div className="fp-surface" style={{ marginTop: 14 }}>
      <div className="fp-surfaceHeader">
        <div>
          <div className="fp-surfaceTitle">
            <span className="fp-surfaceTitleIcon">
              <Icon name="gps" />
            </span>
            Driver Locations (Last Known)
          </div>
          <div className="fp-muted fp-mt-xs">
            Click a driver to focus on the map.
          </div>
        </div>
      </div>

      <div className="fp-tableWrap">
        <table className="fp-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Last Update</th>
              <th>Lat</th>
              <th>Lng</th>
              <th>Updated</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="fp-muted" style={{ padding: 14 }}>
                  No driver location data available.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const mins = minsSince(r.updated_at);
                const stale = mins >= STALE_MIN;

                return (
                  <tr
                    key={r.driver_id ?? r.id}
                    onClick={() => onRowClick?.(r)}
                    style={{
                      cursor: onRowClick ? "pointer" : "default",
                      background: stale ? "rgba(239,68,68,.04)" : undefined,
                    }}
                  >
                    <td>
                      <div style={{ fontWeight: 700 }}>
                        {r.name || `Driver #${r.driver_id ?? r.id}`}
                      </div>
                      {r.email && (
                        <div className="fp-muted" style={{ fontSize: 12 }}>
                          {r.email}
                        </div>
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          stale
                            ? "fp-pill fp-pill-warn"
                            : "fp-pill fp-pill-info"
                        }
                      >
                        {ageLabel(mins)}
                      </span>
                    </td>

                    <td>{r.lat ?? "—"}</td>
                    <td>{r.lng ?? "—"}</td>
                    <td>{fmt(r.updated_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
