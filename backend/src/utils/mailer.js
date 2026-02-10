import nodemailer from "nodemailer";

/**
 * Supports either:
 * 1) SMTP via host/port/secure
 * 2) "service" mode (ex: Gmail) via SMTP_SERVICE=gmail
 *
 * Required:
 * - SMTP_USER
 * - SMTP_PASS
 *
 * If using host mode:
 * - SMTP_HOST
 * - SMTP_PORT (optional, default 587)
 * - SMTP_SECURE (optional, default false)
 */
export function makeTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER/SMTP_PASS missing in .env");
  }

  // ✅ Service mode (recommended for Gmail)
  const service = (process.env.SMTP_SERVICE || "").trim();
  if (service) {
    return nodemailer.createTransport({
      service,
      auth: { user, pass },
    });
  }

  // ✅ Host mode (standard SMTP)
  let host = (process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  // Guard against common mistake: putting an email in SMTP_HOST
  if (host.includes("@") && !host.includes(".")) {
    // very unlikely; but keep safe
    throw new Error("SMTP_HOST looks invalid.");
  }

  // Common mistake: SMTP_HOST accidentally set to an email (contains @)
  if (host.includes("@")) {
    throw new Error(
      "SMTP_HOST must be an SMTP server hostname (e.g., smtp.gmail.com), not an email address."
    );
  }

  if (!host) {
    throw new Error("SMTP_HOST missing in .env");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendMail({ to, subject, html, text }) {
  const transporter = makeTransport();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  // ✅ Optional: verify connection if you set SMTP_VERIFY=true in .env
  if (String(process.env.SMTP_VERIFY || "false") === "true") {
    await transporter.verify();
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}
