import { useNavigate } from "react-router-dom";
import "../../styles/fastpass-dashboard.css";
import "../../styles/fastpass-dispatcher-shell.css";
import "../../styles/dispatcher-overview.css";

import Icon from "./Icons";

/**
 * SectionHeader
 * Updated per navigation restructure:
 * - Tabs (Overview/Deliveries/Feedback/Map) and Create Order button are now in the sidebar.
 * - Renders: breadcrumb → rainbow divider → header row (title/subtitle + optional right actions).
 */
export default function SectionHeader({
  title,
  subtitle,
  updatedLabel,

  // Optional: custom right-side actions (buttons, etc.)
  right,

  // Backwards-compatible action props
  primaryAction,
  primaryRight,
  secondaryAction,
  secondaryRight,
}) {
  const navigate = useNavigate(); // kept for backward compatibility if callers use it

  const renderPrimary = () => {
    if (primaryRight) return primaryRight;
    if (!primaryAction) return null;

    const { label, onClick, iconName = "plus", disabled } = primaryAction;
    return (
      <button
        type="button"
        className="fpOv-btnPrimary"
        onClick={onClick}
        disabled={!!disabled}
      >
        <span className="fpOv-btnIcon" aria-hidden="true">
          <Icon name={iconName} />
        </span>
        {label}
      </button>
    );
  };

  const renderSecondary = () => {
    if (secondaryRight) return secondaryRight;
    if (!secondaryAction) return null;

    const { label, onClick, iconName, disabled } = secondaryAction;

    return (
      <button
        type="button"
        className="fpOv-btnSecondary"
        onClick={onClick}
        disabled={!!disabled}
      >
        {iconName ? (
          <span className="fpOv-btnIcon" aria-hidden="true">
            <Icon name={iconName} />
          </span>
        ) : null}
        {label}
      </button>
    );
  };

  const renderRight = () => {
    if (right) return right;

    const p = renderPrimary();
    const s = renderSecondary();
    if (!p && !s) return null;

    return <div className="fpOv-tabs">{p}{s}</div>;
  };

  return (
    <div className="fpOv-page">
      <div className="fpOv-mainCard">
        {/* Breadcrumb */}
        <div className="fpOv-breadcrumb">Dashboard / {title}</div>

        {/* Rainbow Divider */}
        <div className="fpOv-rainbow" />

        {/* Header Row */}
        <div className="fpOv-headerRow">
          <div className="fpOv-titleBlock">
            <div className="fpOv-title">{title}</div>

            <div className="fpOv-subtitle">
              {subtitle}
              {updatedLabel ? (
                <>
                  {" "}
                  <span className="fpOv-updated">
                    Updated: <b>{updatedLabel}</b>
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {renderRight()}
        </div>
      </div>
    </div>
  );
}
