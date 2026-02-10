import Icon from "./Icons";

export default function ControlsPanel({ q, setQ }) {
  return (
    <div className="fp-controls">
      <div className="fp-inputwrap">
        <span className="fp-inputicon"><Icon name="search" /></span>
        <input
          className="fp-input"
          placeholder="Search by reference, customer, address…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="fp-surface">
        <div className="fp-surfaceTitle">
          <span className="fp-surfaceTitleIcon" aria-hidden="true"><Icon name="shield" /></span>
          Quick Tips
        </div>
        <div className="fp-muted">• Create orders then assign drivers.</div>
        <div className="fp-muted">• Use POD to verify successful deliveries.</div>
        <div className="fp-muted">• Review failures to reschedule or reassign.</div>
      </div>
    </div>
  );
}
