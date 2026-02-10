export function statusChipStyle(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid transparent",
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  };

  // Use CSS variables so the palette stays consistent with the dashboard theme.
  if (status === "PENDING")
    return {
      ...base,
      background: "var(--fp-status-warning-bg)",
      color: "var(--fp-status-warning-text)",
      borderColor: "var(--fp-status-warning-border)",
    };
  if (status === "ASSIGNED")
    return {
      ...base,
      background: "var(--fp-status-info-bg)",
      color: "var(--fp-status-info-text)",
      borderColor: "var(--fp-status-info-border)",
    };
  if (status === "IN_TRANSIT")
    return {
      ...base,
      background: "var(--fp-status-accent-bg)",
      color: "var(--fp-status-accent-text)",
      borderColor: "var(--fp-status-accent-border)",
    };
  if (status === "DELIVERED")
    return {
      ...base,
      background: "var(--fp-status-success-bg)",
      color: "var(--fp-status-success-text)",
      borderColor: "var(--fp-status-success-border)",
    };
  if (status === "FAILED")
    return {
      ...base,
      background: "var(--fp-status-danger-bg)",
      color: "var(--fp-status-danger-text)",
      borderColor: "var(--fp-status-danger-border)",
    };

  return {
    ...base,
    background: "var(--fp-status-neutral-bg)",
    color: "var(--fp-status-neutral-text)",
    borderColor: "var(--fp-status-neutral-border)",
  };

  if (status === "PICKED_UP")
  return {
    ...base,
    background: "var(--fp-status-neutral-bg)",
    color: "var(--fp-status-neutral-text)",
    borderColor: "var(--fp-status-neutral-border)",
  };

if (status === "CANCELLED")
  return {
    ...base,
    background: "var(--fp-status-neutral-bg)",
    color: "var(--fp-status-neutral-text)",
    borderColor: "var(--fp-status-neutral-border)",
  };

}
