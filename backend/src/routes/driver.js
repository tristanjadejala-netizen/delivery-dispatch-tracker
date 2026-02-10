// backend/src/routes/driver.js
import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../upload.js";

const router = Router();

/**
 * Helpers
 */
async function getDriverIdFromUser(userId) {
  const d = await db.query("SELECT id FROM drivers WHERE user_id=$1", [userId]);
  if (!d.rows.length) return null;
  return d.rows[0].id;
}

async function ensureAssigned(deliveryId, driverId) {
  const r = await db.query(
    "SELECT * FROM deliveries WHERE id=$1 AND assigned_driver_id=$2",
    [deliveryId, driverId]
  );
  return r.rows[0] || null;
}

/**
 * =========================
 * DRIVER: Deliveries
 * =========================
 */

// DRIVER: list assigned deliveries
router.get("/deliveries", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "DRIVER") return res.status(403).json({ message: "Forbidden" });

    const driverId = await getDriverIdFromUser(req.user.id);
    if (!driverId) return res.status(404).json({ message: "Driver record not found" });

    const result = await db.query(
      `SELECT *
       FROM deliveries
       WHERE assigned_driver_id=$1
       ORDER BY created_at DESC`,
      [driverId]
    );

    return res.json({ rows: result.rows });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// DRIVER: get timeline events for an assigned delivery
router.get("/deliveries/:id/events", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "DRIVER") return res.status(403).json({ message: "Forbidden" });

    const deliveryId = Number(req.params.id);
    if (!deliveryId) return res.status(400).json({ message: "Invalid delivery id" });

    const driverId = await getDriverIdFromUser(req.user.id);
    if (!driverId) return res.status(404).json({ message: "Driver record not found" });

    const owned = await ensureAssigned(deliveryId, driverId);
    if (!owned) return res.status(404).json({ message: "Delivery not found or not assigned to you" });

    const r = await db.query(
      `SELECT id, delivery_id, status, note, created_at
       FROM delivery_events
       WHERE delivery_id=$1
       ORDER BY created_at ASC`,
      [deliveryId]
    );

    return res.json({ rows: r.rows });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// DRIVER: get POD for an assigned delivery
router.get("/deliveries/:id/pod", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "DRIVER") return res.status(403).json({ message: "Forbidden" });

    const deliveryId = Number(req.params.id);
    if (!deliveryId) return res.status(400).json({ message: "Invalid delivery id" });

    const driverId = await getDriverIdFromUser(req.user.id);
    if (!driverId) return res.status(404).json({ message: "Driver record not found" });

    const owned = await ensureAssigned(deliveryId, driverId);
    if (!owned) return res.status(404).json({ message: "Delivery not found or not assigned to you" });

    const r = await db.query(`SELECT * FROM pod WHERE delivery_id=$1`, [deliveryId]);
    if (!r.rows.length) return res.status(404).json({ message: "POD not found" });

    return res.json(r.rows[0]);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// DRIVER: get failure record for an assigned delivery
router.get("/deliveries/:id/failure", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "DRIVER") return res.status(403).json({ message: "Forbidden" });

    const deliveryId = Number(req.params.id);
    if (!deliveryId) return res.status(400).json({ message: "Invalid delivery id" });

    const driverId = await getDriverIdFromUser(req.user.id);
    if (!driverId) return res.status(404).json({ message: "Driver record not found" });

    const owned = await ensureAssigned(deliveryId, driverId);
    if (!owned) return res.status(404).json({ message: "Delivery not found or not assigned to you" });

    const r = await db.query(`SELECT * FROM delivery_failures WHERE delivery_id=$1`, [deliveryId]);
    if (!r.rows.length) return res.status(404).json({ message: "Failure record not found" });

    return res.json(r.rows[0]);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/**
 * =========================
 * DRIVER: Status Updates
 * =========================
 *
 * IMPORTANT:
 * - DELIVERED must be done via /pod
 * - FAILED must be done via /fail
 */

// DRIVER: update delivery status (Picked Up / In Transit)
// NOTE: DB may not allow PICKED_UP as deliveries.status, so we map it to IN_TRANSIT,
// but still log PICKED_UP in delivery_events for timeline visibility.
router.post("/deliveries/:id/status", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "DRIVER") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deliveryId = Number(req.params.id);
    const { status, note } = req.body;

    const allowedActions = ["PICKED_UP", "IN_TRANSIT"];
    if (!allowedActions.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const driverId = await getDriverIdFromUser(req.user.id);
    if (!driverId) {
      return res.status(404).json({ message: "Driver record not found" });
    }

    const delivery = await ensureAssigned(deliveryId, driverId);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found or not assigned to you" });
    }

    const current = delivery.status;

    // DB constraint-safe status
    const nextStoredStatus = "IN_TRANSIT";

    const allowedNextStored = {
      ASSIGNED: ["IN_TRANSIT"],
      IN_TRANSIT: ["IN_TRANSIT"],
      DELIVERED: [],
      FAILED: [],
      PENDING: [],
      CANCELLED: [],
    };

    if (!allowedNextStored[current]?.includes(nextStoredStatus)) {
      return res
        .status(400)
        .json({ message: `Invalid transition: ${current} -> ${nextStoredStatus}` });
    }

    // Update deliveries table only if needed
    if (current !== nextStoredStatus) {
      await db.query(
        `UPDATE deliveries
         SET status=$1
         WHERE id=$2`,
        [nextStoredStatus, deliveryId]
      );
    }

    // 1️⃣ Always log the actual driver action
    await db.query(
      `INSERT INTO delivery_events (delivery_id, status, note, created_by)
       VALUES ($1,$2,$3,$4)`,
      [deliveryId, status, note || null, req.user.id]
    );

    // 2️⃣ AUTO-ADD IN_TRANSIT when PICKED_UP (if not already present)
    if (status === "PICKED_UP") {
      const hasInTransit = await db.query(
        `SELECT 1
         FROM delivery_events
         WHERE delivery_id=$1 AND status='IN_TRANSIT'
         LIMIT 1`,
        [deliveryId]
      );

      if (!hasInTransit.rows.length) {
        await db.query(
          `INSERT INTO delivery_events (delivery_id, status, note, created_by)
           VALUES ($1,'IN_TRANSIT','In transit',$2)`,
          [deliveryId, req.user.id]
        );
      }
    }

    const updated = await db.query(
      `SELECT * FROM deliveries WHERE id=$1`,
      [deliveryId]
    );

    return res.json(updated.rows[0]);
  } catch (e) {
    return res.status(500).json({
      message: "Server error",
      error: e.message,
    });
  }
});

// DRIVER: mark delivery as FAILED (with reason + optional photo)
router.post("/deliveries/:id/fail", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    if (req.user.role !== "DRIVER") return res.status(403).json({ message: "Forbidden" });

    const deliveryId = Number(req.params.id);
    const { reason, notes } = req.body;

    const ALLOWED_REASONS = [
      "CUSTOMER_UNAVAILABLE",
      "WRONG_ADDRESS",
      "PACKAGE_DAMAGED",
      "REFUSED_BY_CUSTOMER",
      "NO_CONTACT",
      "RETURNED_TO_SENDER",
      "OTHER",
    ];

    if (!deliveryId) return res.status(400).json({ message: "Invalid delivery id" });
    if (!reason || !ALLOWED_REASONS.includes(reason)) {
      return res.status(400).json({ message: "Invalid reason" });
    }

    const driverId = await getDriverIdFromUser(req.user.id);
    if (!driverId) return res.status(404).json({ message: "Driver record not found" });

    const delivery = await ensureAssigned(deliveryId, driverId);
    if (!delivery) return res.status(404).json({ message: "Delivery not found or not assigned to you" });

    if (delivery.status === "DELIVERED") {
      return res.status(400).json({ message: "Cannot fail a delivered delivery" });
    }
    if (delivery.status === "FAILED") {
      return res.status(400).json({ message: "Delivery is already FAILED" });
    }
    if (delivery.status === "CANCELLED") {
      return res.status(400).json({ message: "Cannot fail a cancelled delivery" });
    }

    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    const failure = await db.query(
      `INSERT INTO delivery_failures (delivery_id, reason, notes, photo_url, failed_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (delivery_id)
       DO UPDATE SET
         reason=EXCLUDED.reason,
         notes=EXCLUDED.notes,
         photo_url=COALESCE(EXCLUDED.photo_url, delivery_failures.photo_url),
         failed_at=NOW()
       RETURNING *`,
      [deliveryId, reason, notes || null, photo_url]
    );

    const updated = await db.query(
      `UPDATE deliveries SET status='FAILED' WHERE id=$1 RETURNING *`,
      [deliveryId]
    );

    await db.query(
      `INSERT INTO delivery_events (delivery_id, status, note, created_by)
       VALUES ($1,'FAILED',$2,$3)`,
      [deliveryId, `Failed: ${reason}${notes ? ` - ${notes}` : ""}`, req.user.id]
    );

    return res.json({ delivery: updated.rows[0], failure: failure.rows[0] });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// DRIVER: submit Proof of Delivery (POD)
router.post(
  "/deliveries/:id/pod",
  requireAuth,
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "signature", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (req.user.role !== "DRIVER") return res.status(403).json({ message: "Forbidden" });

      const deliveryId = Number(req.params.id);
      const { recipient_name, note } = req.body;

      if (!deliveryId) return res.status(400).json({ message: "Invalid delivery id" });
      if (!recipient_name || String(recipient_name).trim().length === 0) {
        return res.status(400).json({ message: "recipient_name is required" });
      }

      const driverId = await getDriverIdFromUser(req.user.id);
      if (!driverId) return res.status(404).json({ message: "Driver record not found" });

      const delivery = await ensureAssigned(deliveryId, driverId);
      if (!delivery) return res.status(404).json({ message: "Delivery not found or not assigned to you" });

      if (delivery.status === "DELIVERED") {
        return res.status(400).json({ message: "Delivery is already DELIVERED" });
      }
      if (delivery.status === "FAILED") {
        return res.status(400).json({ message: "Cannot submit POD for FAILED delivery" });
      }
      if (delivery.status === "CANCELLED") {
        return res.status(400).json({ message: "Cannot submit POD for CANCELLED delivery" });
      }
      if (delivery.status !== "IN_TRANSIT") {
        return res.status(400).json({ message: "POD allowed only when status is IN_TRANSIT" });
      }

      const photoFile = req.files?.photo?.[0];
      const sigFile = req.files?.signature?.[0];

      if (!photoFile) return res.status(400).json({ message: "photo is required" });

      const photo_url = `/uploads/${photoFile.filename}`;
      const signature_url = sigFile ? `/uploads/${sigFile.filename}` : null;

      const pod = await db.query(
        `INSERT INTO pod (delivery_id, recipient_name, photo_url, signature_url, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (delivery_id)
         DO UPDATE SET
           recipient_name=EXCLUDED.recipient_name,
           photo_url=EXCLUDED.photo_url,
           signature_url=EXCLUDED.signature_url,
           note=EXCLUDED.note,
           created_by=EXCLUDED.created_by,
           delivered_at=NOW()
         RETURNING *`,
        [deliveryId, recipient_name.trim(), photo_url, signature_url, note || null, req.user.id]
      );

      const updated = await db.query(
        `UPDATE deliveries SET status='DELIVERED' WHERE id=$1 RETURNING *`,
        [deliveryId]
      );

      await db.query(
        `INSERT INTO delivery_events (delivery_id, status, note, created_by)
         VALUES ($1,'DELIVERED',$2,$3)`,
        [deliveryId, `POD submitted for ${recipient_name.trim()}`, req.user.id]
      );

      return res.json({ delivery: updated.rows[0], pod: pod.rows[0] });
    } catch (e) {
      return res.status(500).json({ message: "Server error", error: e.message });
    }
  }
);

/**
 * =========================
 * DRIVER: Location Tracking (Step 4)
 * =========================
 */

// DRIVER: update last known location
router.post("/location", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "DRIVER") return res.status(403).json({ message: "Forbidden" });

    const { lat, lng, accuracy, heading, speed } = req.body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ message: "lat and lng must be numbers" });
    }

    const driverId = await getDriverIdFromUser(req.user.id);
    if (!driverId) return res.status(404).json({ message: "Driver record not found" });

    const r = await db.query(
      `INSERT INTO driver_locations (driver_id, lat, lng, accuracy, heading, speed, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (driver_id)
       DO UPDATE SET
         lat=EXCLUDED.lat,
         lng=EXCLUDED.lng,
         accuracy=EXCLUDED.accuracy,
         heading=EXCLUDED.heading,
         speed=EXCLUDED.speed,
         updated_at=NOW()
       RETURNING *`,
      [driverId, lat, lng, accuracy ?? null, heading ?? null, speed ?? null]
    );

    return res.json(r.rows[0]);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// DRIVER: get own last known location
router.get("/location", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "DRIVER") return res.status(403).json({ message: "Forbidden" });

    const driverId = await getDriverIdFromUser(req.user.id);
    if (!driverId) return res.status(404).json({ message: "Driver record not found" });

    const r = await db.query(`SELECT * FROM driver_locations WHERE driver_id=$1`, [driverId]);
    return res.json(r.rows[0] || null);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

export default router;
