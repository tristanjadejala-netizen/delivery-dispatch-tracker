export default function StatsGrid({ stats }) {
  return (
    <div className="fp-grid-stats">
      <div className="fp-stat">
        <div className="fp-stat-label"><span className="fp-stat-accent" />Total (loaded)</div>
        <div className="fp-stat-value">{stats.total}</div>
      </div>
      <div className="fp-stat">
        <div className="fp-stat-label"><span className="fp-stat-accent" />Active</div>
        <div className="fp-stat-value">{stats.active}</div>
      </div>
      <div className="fp-stat">
        <div className="fp-stat-label"><span className="fp-stat-accent" />Delivered</div>
        <div className="fp-stat-value">{stats.delivered}</div>
      </div>
      <div className="fp-stat">
        <div className="fp-stat-label"><span className="fp-stat-accent" />Failed</div>
        <div className="fp-stat-value">{stats.failed}</div>
      </div>
    </div>
  );
}
