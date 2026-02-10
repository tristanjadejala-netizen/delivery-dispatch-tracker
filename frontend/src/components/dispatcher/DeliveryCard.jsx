import { useState } from "react";
import Icon from "./Icons";
import { statusChipStyle } from "./statusChipStyle";
import DeliveryMapInline from "./DeliveryMapInline";

export default function DeliveryCard({
  delivery: d,
  drivers,
  driverPickValue,
  onPickDriver,
  onAssign,
  assigningId,
  onDelete,
  deletingId,
  toggleTimeline,
  openTimeline,
  events,
  loadingEventsId,
  togglePod,
  openPod,
  pod,
  loadingPodId,
  toggleFailure,
  openFailure,
  failure,
  loadingFailureId,
  fmt,
  API_BASE,

  // ✅ selection
  selected,
  onToggleSelect,
}) {
  const assignedId = Number(d.assigned_driver_id || 0);
  const pickedId = Number(driverPickValue || 0);

  const assignmentLocked = ["DELIVERED", "FAILED", "CANCELLED"].includes(d.status);
  const disableAssign = assignmentLocked || assigningId === d.id || !pickedId || pickedId === assignedId;

  const deleteLocked = d.status === "DELIVERED";
  const disableDelete = deleteLocked || deletingId === d.id;

  const [openMap, setOpenMap] = useState(false);

  return (
    <div className={`fp-card ${selected ? "fp-cardSelected" : ""}`}>
      <div className="fp-row">
        <div className="fp-mainCol">
          <div className="fp-titleRow">
            {/* ✅ checkbox */}
            <label className="fp-check" title="Select delivery">
              <input type="checkbox" checked={!!selected} onChange={onToggleSelect} />
              <span className="fp-checkBox" aria-hidden="true" />
            </label>

            <div className="fp-ref">{d.reference_no}</div>
            <div className="fp-sep">—</div>
            <div className="fp-name">{d.customer_name}</div>

            <span style={statusChipStyle(d.status)}>{d.status}</span>
          </div>

          <div className="fp-muted fp-mt-sm">
            {d.pickup_address} → {d.dropoff_address}
          </div>

          <div className="fp-muted fp-mt-md">
            {d.assigned_driver_id ? (
              <>
                Assigned Driver ID: <b className="fp-strong">{d.assigned_driver_id}</b>
              </>
            ) : (
              <>Not assigned</>
            )}
          </div>

          <div className="fp-actionRow">
            <button className="fp-btn2" onClick={() => setOpenMap((v) => !v)}>
              <Icon name="map" />
              {openMap ? "Hide Map" : "View Map"}
            </button>

            <button className="fp-btn2" onClick={toggleTimeline}>
              {openTimeline ? "Hide Timeline" : "View Timeline"}
            </button>

            <button className="fp-btn2" onClick={togglePod}>
              {openPod ? "Hide POD" : "View POD"}
            </button>

            {d.status === "FAILED" ? (
              <button className="fp-btn2 fp-btn2-danger" onClick={toggleFailure}>
                {openFailure ? "Hide Failure" : "View Failure"}
              </button>
            ) : null}

            <button
              className="fp-btn2 fp-btn2-danger"
              disabled={disableDelete}
              onClick={onDelete}
              title={deleteLocked ? "Delivered orders cannot be deleted" : "Delete this order"}
            >
              {deletingId === d.id ? "Deleting..." : "Delete"}
            </button>

            {(loadingEventsId === d.id || loadingPodId === d.id || loadingFailureId === d.id) && (
              <span className="fp-muted">Loading…</span>
            )}
          </div>
        </div>

        <div className="fp-rightCol">
          <select
            className="fp-select"
            value={driverPickValue || ""}
            onChange={(e) => onPickDriver(e.target.value)}
            disabled={assignmentLocked}
          >
            <option value="">{assignmentLocked ? "Assignment locked" : "Select driver…"}</option>
            {drivers.map((dr) => (
              <option key={dr.driver_id} value={dr.driver_id}>
                {dr.name} ({dr.status})
              </option>
            ))}
          </select>

          <button className="fp-btn2 fp-btn2-primary" disabled={disableAssign} onClick={onAssign}>
            {assignmentLocked
              ? "Assignment locked"
              : assigningId === d.id
              ? "Assigning..."
              : d.assigned_driver_id
              ? "Reassign Driver"
              : "Assign Driver"}
          </button>

          <div className="fp-muted fp-mt-sm">Created: {fmt(d.created_at)}</div>
        </div>
      </div>

      {openMap ? (
        <div className="fp-section">
          <DeliveryMapInline referenceNo={d.reference_no} onClose={() => setOpenMap(false)} />
        </div>
      ) : null}

      {openTimeline ? (
        <div className="fp-section">
          <div className="fp-sectionTitle">
            <span className="fp-sectionIcon" aria-hidden="true">
              <Icon name="route" size={16} />
            </span>
            Timeline
          </div>

          {(events || []).length === 0 ? (
            <div className="fp-muted">No events yet.</div>
          ) : (
            <ul className="fp-timelineList">
              {(events || []).map((e) => (
                <li key={e.id} className="fp-timelineItem">
                  <span className="fp-timelineStatus">{e.status}</span> —{" "}
                  <span className="fp-timelineTime">{fmt(e.created_at)}</span>
                  {e.note ? <div className="fp-muted fp-mt-xs">{e.note}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {openPod ? (
        <div className="fp-section">
          <div className="fp-sectionTitle">Proof of Delivery</div>

          {pod === undefined ? (
            <div className="fp-muted">Loading POD…</div>
          ) : pod === null ? (
            <div className="fp-muted">No POD submitted yet.</div>
          ) : (
            <div className="fp-stack">
              <div className="fp-kv">
                Recipient: <span className="fp-kvStrong">{pod.recipient_name}</span>
              </div>
              <div className="fp-muted">Delivered at: {fmt(pod.delivered_at)}</div>

              {pod.photo_url ? (
                <img src={`${API_BASE}${pod.photo_url}`} alt="POD Photo" className="fp-img" />
              ) : pod.photo_filename ? (
                <img src={`${API_BASE}/uploads/${pod.photo_filename}`} alt="POD Photo" className="fp-img" />
              ) : null}

              {pod.signature_url ? (
                <img src={`${API_BASE}${pod.signature_url}`} alt="POD Signature" className="fp-img" />
              ) : pod.signature_filename ? (
                <img src={`${API_BASE}/uploads/${pod.signature_filename}`} alt="POD Signature" className="fp-img" />
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {openFailure ? (
        <div className="fp-section">
          <div className="fp-sectionTitle fp-sectionTitleDanger">Failed Delivery</div>
          {failure === undefined ? (
            <div className="fp-muted">Loading failure details…</div>
          ) : failure === null ? (
            <div className="fp-muted">No failure record found.</div>
          ) : (
            <div className="fp-stackSm">
              <div className="fp-kv">
                Reason: <span className="fp-dangerText">{failure.reason}</span>
              </div>
              <div className="fp-muted">Failed at: {fmt(failure.failed_at)}</div>
              {failure.notes ? <div className="fp-kv">Notes: {failure.notes}</div> : null}

              {failure.photo_url ? (
                <img src={`${API_BASE}${failure.photo_url}`} alt="Failure Photo" className="fp-img" />
              ) : failure.photo_filename ? (
                <img src={`${API_BASE}/uploads/${failure.photo_filename}`} alt="Failure Photo" className="fp-img" />
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
