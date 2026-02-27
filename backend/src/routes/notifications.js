// backend/src/routes/notifications.js
import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  ensureNotificationSchema,
  seedDefaultSystemEventIfEmpty,
} from "../utils/notify.js";

const router = Router();

function requireDispatcherOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

// GET /notifications
router.get("/", requireAuth, requireDispatcherOrAdmin, async (req, res) => {
  try {
    await ensureNotificationSchema();
    await seedDefaultSystemEventIfEmpty();

    const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 100)));
    const type = req.query?.type ? String(req.query.type).toUpperCase() : null; // ORDERS/DRIVERS/SYSTEM
    const q = req.query?.q ? String(req.query.q).trim() : "";

    const params = [req.user.id, limit];
    let where = "WHERE 1=1";

    if (type && ["ORDERS", "DRIVERS", "SYSTEM"].includes(type)) {
      params.push(type);
      where += ` AND n.type=$${params.length}`;
    }

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      const p = `$${params.length}`;
      where += ` AND (LOWER(n.title) LIKE ${p} OR LOWER(n.message) LIKE ${p} OR LOWER(COALESCE(n.reference_no,'')) LIKE ${p})`;
    }

    const sql = `
      SELECT
        n.id,
        n.type,
        n.subtype,
        n.entity_id,
        n.reference_no,
        n.title,
        n.message,
        n.created_at,
        CASE WHEN r.notification_id IS NULL THEN TRUE ELSE FALSE END AS unread
      FROM notifications n
      LEFT JOIN notification_reads r
        ON r.notification_id = n.id AND r.user_id = $1
      ${where}
      ORDER BY n.created_at DESC
      LIMIT $2
    `;

    const out = await db.query(sql, params);
    return res.json({ rows: out.rows });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// POST /notifications/mark-all-read
router.post(
  "/mark-all-read",
  requireAuth,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      await ensureNotificationSchema();

      await db.query(
        `INSERT INTO notification_reads (notification_id, user_id)
         SELECT n.id, $1
         FROM notifications n
         LEFT JOIN notification_reads r
           ON r.notification_id = n.id AND r.user_id = $1
         WHERE r.notification_id IS NULL`,
        [req.user.id],
      );

      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ message: "Server error", error: e.message });
    }
  },
);

// POST /notifications/:id/read
router.post(
  "/:id/read",
  requireAuth,
  requireDispatcherOrAdmin,
  async (req, res) => {
    try {
      await ensureNotificationSchema();
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid notification id" });

      await db.query(
        `INSERT INTO notification_reads (notification_id, user_id)
         VALUES ($1,$2)
         ON CONFLICT (notification_id, user_id) DO NOTHING`,
        [id, req.user.id],
      );

      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ message: "Server error", error: e.message });
    }
  },
);

// OPTIONAL: create a system event (Admin/Dispatcher)
// POST /notifications/system
router.post("/system", requireAuth, requireDispatcherOrAdmin, async (req, res) => {
  try {
    await ensureNotificationSchema();
    const title = String(req.body?.title || "System Update:").trim() || "System Update:";
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ message: "message is required" });

    const r = await db.query(
      `INSERT INTO notifications (type, subtype, title, message, created_by)
       VALUES ('SYSTEM','SYSTEM_EVENT',$1,$2,$3)
       RETURNING *`,
      [title, message, req.user.id],
    );

    return res.json(r.rows[0]);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});



function requireCustomer(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "CUSTOMER") return res.status(403).json({ message: "Forbidden" });
  next();
}

function parseRefs(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  return Array.from(
    new Set(
      s
        .split(",")
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .slice(0, 100),
    ),
  );
}

// CUSTOMER: Get notifications tied to reference numbers the customer is tracking.
// GET /notifications/customer?refs=REF1,REF2&limit=80&q=...
router.get("/customer", requireAuth, requireCustomer, async (req, res) => {
  try {
    await ensureNotificationSchema();

    const refs = parseRefs(req.query?.refs);
    if (!refs.length) return res.json({ rows: [] });

    const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 80)));
    const q = req.query?.q ? String(req.query.q).trim().toLowerCase() : "";

    const params = [req.user.id, limit, refs];
    let where = "WHERE n.reference_no = ANY($3)";

    if (q) {
      params.push(`%${q}%`);
      const p = `$${params.length}`;
      where += ` AND (LOWER(n.title) LIKE ${p} OR LOWER(n.message) LIKE ${p} OR LOWER(COALESCE(n.reference_no,'')) LIKE ${p})`;
    }

    const sql = `
      SELECT
        n.id,
        n.type,
        n.subtype,
        n.entity_id,
        n.reference_no,
        n.title,
        n.message,
        n.created_at,
        CASE WHEN r.notification_id IS NULL THEN TRUE ELSE FALSE END AS unread
      FROM notifications n
      LEFT JOIN notification_reads r
        ON r.notification_id = n.id AND r.user_id = $1
      ${where}
      ORDER BY n.created_at DESC
      LIMIT $2
    `;

    const out = await db.query(sql, params);
    return res.json({ rows: out.rows });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// CUSTOMER: mark all read for the refs the customer is tracking
// POST /notifications/customer/mark-all-read  { refs: ["REF1","REF2"] }
router.post("/customer/mark-all-read", requireAuth, requireCustomer, async (req, res) => {
  try {
    await ensureNotificationSchema();
    const refs = Array.isArray(req.body?.refs) ? req.body.refs.map(String) : [];
    const uniq = Array.from(new Set(refs.map((r) => r.trim()).filter(Boolean))).slice(0, 100);
    if (!uniq.length) return res.json({ ok: true });

    await db.query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, $1
       FROM notifications n
       LEFT JOIN notification_reads r
         ON r.notification_id = n.id AND r.user_id = $1
       WHERE r.notification_id IS NULL
         AND n.reference_no = ANY($2)`,
      [req.user.id, uniq],
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// CUSTOMER: mark one notification as read (only if it belongs to the provided refs)
// POST /notifications/customer/:id/read  { refs: ["REF1","REF2"] }
router.post("/customer/:id/read", requireAuth, requireCustomer, async (req, res) => {
  try {
    await ensureNotificationSchema();
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid notification id" });

    const refs = Array.isArray(req.body?.refs) ? req.body.refs.map(String) : [];
    const uniq = Array.from(new Set(refs.map((r) => r.trim()).filter(Boolean))).slice(0, 100);
    if (!uniq.length) return res.status(403).json({ message: "Forbidden" });

    const check = await db.query(
      `SELECT 1 FROM notifications WHERE id=$1 AND reference_no = ANY($2) LIMIT 1`,
      [id, uniq],
    );
    if (!check.rows.length) return res.status(403).json({ message: "Forbidden" });

    await db.query(
      `INSERT INTO notification_reads (notification_id, user_id)
       VALUES ($1,$2)
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [id, req.user.id],
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});


export default router;
