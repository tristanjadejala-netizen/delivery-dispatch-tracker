// frontend/src/components/dispatcher/ExceptionsInbox.jsx
import Icon from "./Icons";

export default function ExceptionsInbox({
  exceptions,
  onShowUnassigned,
  onShowFailed,
  onShowStaleDrivers,
}) {
  const {
    unassignedCount = 0,
    failedCount = 0,
    staleDriverCount = 0,
    staleMinutesThreshold = 10,
  } = exceptions || {};

  const hasAny = unassignedCount + failedCount + staleDriverCount > 0;

  return (
    <div className="fp-surface" style={{ marginTop: 14 }}>
      <div className="fp-surfaceHeader">
        <div>
          <div className="fp-surfaceTitle">
            <span className="fp-surfaceTitleIcon" aria-hidden="true">
              <Icon name="inbox" />
            </span>
            Exceptions Inbox
            {hasAny ? (
              <span className="fp-pill fp-pill-warn">Action needed</span>
            ) : (
              <span className="fp-pill">All clear</span>
            )}
          </div>
          <div className="fp-muted fp-mt-xs">
            Fast view of issues that typically require dispatcher attention.
          </div>
        </div>

        <div className="fp-exGrid">
          <button className="fp-exCard" onClick={onShowUnassigned} disabled={!unassignedCount}>
            <div className="fp-exTop">
              <span className="fp-exIcon" aria-hidden="true">
                <Icon name="userx" />
              </span>
              <span className="fp-exLabel">Unassigned</span>
            </div>
            <div className="fp-exValue">{unassignedCount}</div>
            <div className="fp-exHint">Orders without a driver</div>
          </button>

          <button className="fp-exCard" onClick={onShowFailed} disabled={!failedCount}>
            <div className="fp-exTop">
              <span className="fp-exIcon fp-exIconDanger" aria-hidden="true">
                <Icon name="alert" />
              </span>
              <span className="fp-exLabel">Failed</span>
            </div>
            <div className="fp-exValue">{failedCount}</div>
            <div className="fp-exHint">Needs review / reattempt</div>
          </button>

          <button className="fp-exCard" onClick={onShowStaleDrivers} disabled={!staleDriverCount}>
            <div className="fp-exTop">
              <span className="fp-exIcon fp-exIconMuted" aria-hidden="true">
                <Icon name="gps" />
              </span>
              <span className="fp-exLabel">Stale GPS</span>
            </div>
            <div className="fp-exValue">{staleDriverCount}</div>
            <div className="fp-exHint">No update ≥ {staleMinutesThreshold}m</div>
          </button>
        </div>
      </div>
    </div>
  );
}
