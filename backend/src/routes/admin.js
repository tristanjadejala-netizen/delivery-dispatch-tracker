// backend/src/routes/admin.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * Admin-only guard
 */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
  next();
}

/**
 * Your DB allows only: AVAILABLE / BUSY / OFFLINE
 * This normalizes anything the UI might send.
 */
function normalizeDriverStatus(input) {
  const v = String(input || "").toUpperCase();

  // old UI wording support
  if (v === "ACTIVE") return "AVAILABLE";
  if (v === "INACTIVE") return "OFFLINE";

  // real DB values
  if (["AVAILABLE", "BUSY", "OFFLINE"].includes(v)) return v;

  return "AVAILABLE";
}

/**
 * Create a DRIVER user account (in users table)
 * POST /admin/users/driver
 * body: { name, email, password }
 */
router.post("/users/driver", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, password are required" });
    }

    // check duplicate email
    const existing = await db.query(`SELECT id FROM users WHERE email=$1`, [email]);
    if (existing.rows.length) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const password_hash = await bcrypt.hash(String(password), 10);

    const created = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1,$2,$3,'DRIVER')
       RETURNING id, name, email, role, created_at`,
      [name, email, password_hash]
    );

    return res.json(created.rows[0]);
  } catch (e) {
    console.error("POST /admin/users/driver error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * List DRIVER users that are NOT yet in drivers table
 * GET /admin/driver-users
 */
router.get("/driver-users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT u.id, u.name, u.email
       FROM users u
       WHERE u.role='DRIVER'
         AND NOT EXISTS (SELECT 1 FROM drivers d WHERE d.user_id=u.id)
       ORDER BY u.id DESC`
    );

    return res.json({ rows: r.rows });
  } catch (e) {
    console.error("GET /admin/driver-users error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * List drivers (drivers table) with user info
 * GET /admin/drivers
 */
router.get("/drivers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT
          d.id AS driver_id,
          d.user_id,
          d.status,
          u.name,
          u.email
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       ORDER BY d.id ASC`
    );

    return res.json({ rows: r.rows });
  } catch (e) {
    console.error("GET /admin/drivers error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * Create driver profile (insert into drivers table)
 * POST /admin/drivers
 * body: { user_id, status }
 */
router.post("/drivers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user_id = Number(req.body?.user_id);
    const status = normalizeDriverStatus(req.body?.status);

    if (!user_id) {
      return res.status(400).json({ message: "user_id is required" });
    }

    // Ensure user exists and is DRIVER role
    const u = await db.query(`SELECT id, role FROM users WHERE id=$1`, [user_id]);
    if (!u.rows.length) return res.status(404).json({ message: "User not found" });
    if (u.rows[0].role !== "DRIVER") {
      return res.status(400).json({ message: "Selected user is not a DRIVER role" });
    }

    // Prevent duplicates
    const exists = await db.query(`SELECT id FROM drivers WHERE user_id=$1`, [user_id]);
    if (exists.rows.length) {
      return res.status(400).json({ message: "Driver profile already exists for this user" });
    }

    const created = await db.query(
      `INSERT INTO drivers (user_id, status)
       VALUES ($1,$2)
       RETURNING id AS driver_id, user_id, status`,
      [user_id, status]
    );

    return res.json(created.rows[0]);
  } catch (e) {
    console.error("POST /admin/drivers error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * Update driver status
 * PATCH /admin/drivers/:id
 * body: { status }
 */
router.patch("/drivers/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const driverId = Number(req.params.id);
    if (!driverId) return res.status(400).json({ message: "Invalid driver id" });

    const status = normalizeDriverStatus(req.body?.status);

    const r = await db.query(
      `UPDATE drivers
       SET status=$1
       WHERE id=$2
       RETURNING id AS driver_id, user_id, status`,
      [status, driverId]
    );

    if (!r.rows.length) return res.status(404).json({ message: "Driver not found" });

    return res.json(r.rows[0]);
  } catch (e) {
    console.error("PATCH /admin/drivers/:id error:", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

export default router;
