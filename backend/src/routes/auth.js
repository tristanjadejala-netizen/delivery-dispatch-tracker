import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { sendMail } from "../utils/mailer.js";

import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Google OAuth client (ID token verification)
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function issueJwt(user) {
  // keep payload shape consistent with your existing requireAuth middleware
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

/**
 * (Optional) Register route — keep for testing.
 * Customer registration only.
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 🔒 Customer registration only
    const role = "CUSTOMER";

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const existing = await db.query("SELECT id FROM users WHERE email=$1", [
      cleanEmail,
    ]);
    if (existing.rows.length) {
      return res.status(409).json({ message: "Email already used" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const created = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1,$2,$3,$4)
       RETURNING id, name, email, role`,
      [name, cleanEmail, password_hash, role]
    );

    return res.json(created.rows[0]);
  } catch (e) {
    if (
      String(e.message)
        .toLowerCase()
        .includes("invalid input value for enum")
    ) {
      return res.status(500).json({
        message: "DB enum missing CUSTOMER role. Update your role enum/type.",
        error: e.message,
      });
    }

    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = String(email || "").trim().toLowerCase();
    const pw = String(password || "");

    const result = await db.query("SELECT * FROM users WHERE email=$1", [
      cleanEmail,
    ]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(pw, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = issueJwt(user);
    return res.json({ token, role: user.role });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * POST /auth/google-signup
 * body: { idToken }
 *
 * ✅ Signup only (one-time):
 * - Verifies Google ID token
 * - If user already exists -> 409
 * - If new -> returns a short-lived signupToken to be used on /complete-signup
 *
 * Frontend flow:
 * 1) Google returns idToken
 * 2) POST /auth/google-signup { idToken }
 * 3) Store signupToken temporarily (sessionStorage)
 * 4) Go to /complete-signup and POST /auth/complete-signup
 */
router.post("/google-signup", async (req, res) => {
  try {
    const { idToken } = req.body || {};
    const token = String(idToken || "").trim();
    if (!token) return res.status(400).json({ message: "Missing idToken" });

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res
        .status(500)
        .json({ message: "GOOGLE_CLIENT_ID not set in backend env" });
    }
    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ message: "JWT_SECRET not set in backend env" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = String(payload?.email || "").trim().toLowerCase();
    const emailVerified = Boolean(payload?.email_verified);

    if (!email) {
      return res.status(400).json({ message: "Google token has no email" });
    }
    if (!emailVerified) {
      return res
        .status(403)
        .json({ message: "Google email is not verified" });
    }

    const existing = await db.query("SELECT id, role FROM users WHERE email=$1", [
      email,
    ]);
    if (existing.rows.length) {
      // account exists -> do not allow signup overwrite
      return res.status(409).json({ message: "Account already exists" });
    }

    // short-lived token only for completing signup
    const signupToken = jwt.sign(
      { email, type: "signup" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({ email, signupToken });
  } catch (e) {
    console.error("[google-signup] error:", e);
    return res.status(401).json({ message: "Invalid Google token" });
  }
});

/**
 * POST /auth/complete-signup
 * body: { signupToken, password }
 *
 * ✅ Creates local account using the verified Google email + user-chosen password
 * ✅ Does NOT log the user in. User must log in using email + password.
 */
router.post("/complete-signup", async (req, res) => {
  try {
    const { signupToken, password } = req.body || {};
    const st = String(signupToken || "").trim();
    const pw = String(password || "");

    if (!st || !pw) {
      return res.status(400).json({ message: "Missing fields" });
    }
    if (pw.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ message: "JWT_SECRET not set in backend env" });
    }

    let decoded;
    try {
      decoded = jwt.verify(st, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Signup expired or invalid" });
    }

    if (!decoded || decoded.type !== "signup" || !decoded.email) {
      return res.status(403).json({ message: "Invalid signup token" });
    }

    const email = String(decoded.email).trim().toLowerCase();

    // prevent race / double-submit
    const existing = await db.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.rows.length) {
      return res.status(409).json({ message: "Account already exists" });
    }

    const role = "CUSTOMER";
    const password_hash = await bcrypt.hash(pw, 10);

    // name can be null/empty if your schema allows it; keep consistent with your project
    await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1,$2,$3,$4)
       RETURNING id, role`,
      ["Google User", email, password_hash, role]
    );

    // ✅ Requirement: after creating a password, user must log in using
    // email + the created password (no automatic login here).
    return res.json({ ok: true, email, role: role });
  } catch (e) {
    console.error("[complete-signup] error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * POST /auth/forgot-password
 * body: { email }
 * Always returns ok (neutral message pattern).
 * Stores hashed token + expiry in DB and emails reset link.
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();

    // Always return ok (avoid account enumeration)
    if (!cleanEmail) return res.json({ ok: true });

    const userRes = await db.query(
      "SELECT id, email, name FROM users WHERE email=$1",
      [cleanEmail]
    );
    const user = userRes.rows[0];

    if (user) {
      // Create token (store HASH only)
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 mins

      await db.query(
        `UPDATE users
         SET reset_token_hash=$1, reset_token_expires=$2
         WHERE id=$3`,
        [tokenHash, expiresAt, user.id]
      );

      const frontend = process.env.FRONTEND_BASE_URL || "http://localhost:5173";
      const link = `${frontend}/reset-password?token=${rawToken}`;

      const subject = "Reset your FastPass password";
      const text = `Hi ${user.name || ""},

We received a request to reset your password.

Reset link: ${link}

If you didn't request this, you can ignore this email.
This link expires in 30 minutes.`;

      const html = `
        <div style="font-family:Arial,sans-serif; line-height:1.5">
          <h2 style="margin:0 0 8px 0;">Reset your FastPass password</h2>
          <p>Hi ${user.name || "there"},</p>
          <p>We received a request to reset your password.</p>
          <p>
            <a href="${link}" style="display:inline-block; padding:10px 14px; background:#0b5cff; color:#fff; border-radius:8px; text-decoration:none;">
              Reset Password
            </a>
          </p>
          <p style="font-size:12px; color:#555">
            If you didn’t request this, you can ignore this email.
            This link expires in 30 minutes.
          </p>
        </div>
      `;

      try {
        await sendMail({ to: user.email, subject, text, html });
        console.log(`[forgot-password] Email sent to ${user.email}`);
      } catch (mailErr) {
        console.error("[forgot-password] Email send failed:", mailErr);
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[forgot-password] error:", e);
    return res.json({ ok: true });
  }
});

/**
 * POST /auth/reset-password
 * body: { token, newPassword }
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    const rawToken = String(token || "").trim();
    const pw = String(newPassword || "");

    if (!rawToken || pw.length < 6) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const userRes = await db.query(
      `SELECT id, reset_token_expires
       FROM users
       WHERE reset_token_hash=$1`,
      [tokenHash]
    );

    const user = userRes.rows[0];
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const password_hash = await bcrypt.hash(pw, 10);

    await db.query(
      `UPDATE users
       SET password_hash=$1,
           reset_token_hash=NULL,
           reset_token_expires=NULL
       WHERE id=$2`,
      [password_hash, user.id]
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const me = await db.query(
    "SELECT id, name, email, role, created_at FROM users WHERE id=$1",
    [req.user.id]
  );
  return res.json(me.rows[0]);
});

/**
 * POST /auth/google
 *
 * ❌ Disabled by requirement:
 * After signup, users must log in using email + password, not Google OAuth.
 */
router.post("/google", (_, res) => {
  return res.status(410).json({
    message: "Google login is disabled. Use email + password.",
  });
});

export default router;
