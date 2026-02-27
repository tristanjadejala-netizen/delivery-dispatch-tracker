import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/fastpass-dashboard.css";
import "../styles/fastpass-dispatcher-shell.css";
import "../styles/dispatcher-overview.css";

import Icon from "../components/dispatcher/Icons";

function Toggle({ id, checked, onChange, label }) {
  return (
    <button
      id={id}
      type="button"
      className={"fpsSet-toggle" + (checked ? " is-on" : "")}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className="fpsSet-toggleKnob" aria-hidden="true" />
    </button>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <section className="fpsSet-card" aria-label={title}>
      <div className="fpsSet-cardHeader">
        {icon && (
          <span className="fpsSet-cardIcon" aria-hidden="true">
            <Icon name={icon} size={18} />
          </span>
        )}
        <div className="fpsSet-cardTitle">{title}</div>
      </div>
      <div className="fpsSet-cardBody">{children}</div>
    </section>
  );
}

function Row({ left, right }) {
  return (
    <div className="fpsSet-row">
      <div className="fpsSet-rowLeft">{left}</div>
      <div className="fpsSet-rowRight">{right}</div>
    </div>
  );
}

function RowTitle({ title, desc }) {
  return (
    <div className="fpsSet-rowText">
      <div className="fpsSet-rowTitle">{title}</div>
      {desc && <div className="fpsSet-rowDesc">{desc}</div>}
    </div>
  );
}

export default function DispatcherSetting() {
  const nav = useNavigate();

  // Local-only UI states (no backend wiring required yet)
  const [deliveryNotif, setDeliveryNotif] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [notifSound, setNotifSound] = useState(true);

  const tzLabel = useMemo(() => "Philippine Time (PHT - UTC+8)", []);

  return (
    <div className="fpOv-page">
      <div className="fpOv-mainCard">
        {/* Breadcrumb */}
        <div className="fpOv-breadcrumb">Settings</div>

        {/* Rainbow Divider */}
        <div className="fpOv-rainbow" />

        {/* Title Card */}
        <div className="fpsSet-hero" role="region" aria-label="Settings header">
          <div className="fpsSet-heroIcon" aria-hidden="true">
            <Icon name="settings" size={22} />
          </div>
          <div className="fpsSet-heroTitle">Settings</div>
        </div>

        {/* Content */}
        <div className="fpsSet-wrap">
          <SectionCard title="Account Settings">
            <Row
              left={
                <RowTitle
                  title="Change Password"
                  desc="Update your account password."
                />
              }
              right={
                <button
                  type="button"
                  className="fpsSet-btn"
                  onClick={() => nav("/forgot-password")}
                >
                  Change
                </button>
              }
            />
            <div className="fpsSet-divider" />
          </SectionCard>

          <SectionCard title="Notifications" icon="bell">
            <Row
              left={
                <RowTitle
                  title="Delivery Notifications"
                  desc="Receive notifications about the status of deliveries."
                />
              }
              right={
                <Toggle
                  id="delivery-notif"
                  checked={deliveryNotif}
                  onChange={setDeliveryNotif}
                  label="Delivery Notifications"
                />
              }
            />
            <div className="fpsSet-divider" />
            <Row
              left={
                <RowTitle
                  title="System Alerts"
                  desc="Get critical system updates and alerts"
                />
              }
              right={
                <Toggle
                  id="system-alerts"
                  checked={systemAlerts}
                  onChange={setSystemAlerts}
                  label="System Alerts"
                />
              }
            />
            <div className="fpsSet-divider" />
            <Row
              left={
                <RowTitle
                  title="Notification Sound"
                  desc="Play a sound when there’s a new notification"
                />
              }
              right={
                <Toggle
                  id="notif-sound"
                  checked={notifSound}
                  onChange={setNotifSound}
                  label="Notification Sound"
                />
              }
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
