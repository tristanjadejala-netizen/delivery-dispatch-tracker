import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router = Router();

// Helper: generate simple reference no (you can improve later)
function makeRef() {
  const n = Math.floor(Math.random() * 900000) + 100000;
  return `ORD-${new Date().getFullYear()}${n}`;
}

/**
 * Fetch helper:
 * - Node 18+ has global fetch
 * - If your Node is older, it will fallback to node-fetch if installed
 */
async function getFetch() {
  if (typeof fetch !== "undefined") return fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

/** Address hash: used to detect when an address changed */
function addrHash(s) {
  return crypto.createHash("sha1").update(String(s || "").trim()).digest("hex");
}

/** Route cache key: changes if pickup/dropoff coords change */
function routeKey(pickup, dropoff) {
  const a = `${pickup?.lat ?? ""},${pickup?.lng ?? ""}|${dropoff?.lat ?? ""},${dropoff?.lng ?? ""}`;
  return crypto.createHash("sha1").update(a).digest("hex");
}

/** Safe JSON parse (for json/jsonb columns that may come back as string) */
function safeJsonParse(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "object") return v; // already parsed by driver in some configs
  if (typeof v !== "string") return null;

  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/**
 * ✅ Ensure a PENDING event exists for timeline completeness.
 * This backfills older deliveries created before event-logging existed.
 */
async function ensurePendingEvent(deliveryId, createdBy = null) {
  const exists = await db.query(
    `SELECT 1 FROM delivery_events WHERE delivery_id=$1 AND status='PENDING' LIMIT 1`,
    [deliveryId]
  );
  if (exists.rows.length) return;

  await db.query(
    `INSERT INTO delivery_events (delivery_id, status, note, created_by)
     VALUES ($1,'PENDING','Order created',$2)`,
    [deliveryId, createdBy]
  );
}

/**
 * Geocode helper (OpenStreetMap Nominatim)
 * NOTE:
 * - Requires a User-Agent
 * - Keep usage reasonable (no tight loops)
 */
async function geocodeAddress(address) {
  const a = String(address || "").trim();
  if (!a) return null;

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: a,
      format: "json",
      limit: "1",
    });

  try {
    const _fetch = await getFetch();
    const res = await _fetch(url, {
      headers: {
        "User-Agent": "DeliveryDispatchTracker/1.0 (student project)",
        Accept: "application/json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}

/**
 * Road routing helper (OSRM public server)
 * Returns route as [[lat,lng], ...] for react-leaflet Polyline
 * OSRM expects lon,lat pairs.
 */
async function getRoadRoutePickupDropoff(pickup, dropoff) {
  if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) return null;

  const coordStr = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;

  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordStr}?` +
    new URLSearchParams({
      overview: "full",
      geometries: "geojson",
      steps: "false",
    });

  try {
    const _fetch = await getFetch();
    const res = await _fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;

    // OSRM returns [lon,lat]. Convert to [lat,lng].
    if (!Array.isArray(coords) || coords.length < 2) return null;

    return coords.map(([lon, lat]) => [lat, lon]);
  } catch {
    return null;
  }
}

/* =========================================
   CUSTOMER TRACKING
   GET /deliveries/track?ref=ORD-...
   - Cached geocoding in deliveries table
   - Cached route_points (pickup->dropoff) in deliveries table
   ========================================= */
router.get("/track", requireAuth, async (req, res) => {
  try {
    const { ref } = req.query;
    if (!ref) return res.status(400).json({ message: "ref is required" });

    const d = await db.query(
      `SELECT *
       FROM deliveries
       WHERE reference_no=$1
       LIMIT 1`,
      [String(ref).trim()]
    );

    if (!d.rows.length) return res.status(404).json({ message: "Reference not found" });

    let delivery = d.rows[0];

    // Driver name + last known location (if assigned)
    let driver = null;
    let driver_location = null;

    if (delivery.assigned_driver_id) {
      const who = await db.query(
        `SELECT d.id AS driver_id, u.name
         FROM drivers d
         JOIN users u ON u.id = d.user_id
         WHERE d.id=$1`,
        [delivery.assigned_driver_id]
      );

      if (who.rows.length) {
        driver = { name: who.rows[0].name || `Driver #${who.rows[0].driver_id}` };
      }

      const loc = await db.query(
        `SELECT lat, lng, updated_at
         FROM driver_locations
         WHERE driver_id=$1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [delivery.assigned_driver_id]
      );

      if (loc.rows.length) driver_location = loc.rows[0];
    }

    // ===== Cached geocoding =====
    const pHash = addrHash(delivery.pickup_address);
    const dHash = addrHash(delivery.dropoff_address);

    const pickupNeedsGeo =
      !delivery.pickup_lat ||
      !delivery.pickup_lng ||
      delivery.pickup_address_hash !== pHash;

    const dropoffNeedsGeo =
      !delivery.dropoff_lat ||
      !delivery.dropoff_lng ||
      delivery.dropoff_address_hash !== dHash;

    let pickupLat = delivery.pickup_lat;
    let pickupLng = delivery.pickup_lng;
    let dropoffLat = delivery.dropoff_lat;
    let dropoffLng = delivery.dropoff_lng;

    if (pickupNeedsGeo) {
      const p = await geocodeAddress(delivery.pickup_address);
      if (p?.lat && p?.lng) {
        pickupLat = p.lat;
        pickupLng = p.lng;
      }
    }

    if (dropoffNeedsGeo) {
      const dd = await geocodeAddress(delivery.dropoff_address);
      if (dd?.lat && dd?.lng) {
        dropoffLat = dd.lat;
        dropoffLng = dd.lng;
      }
    }

    const shouldUpdateGeo =
      (pickupNeedsGeo && pickupLat && pickupLng) ||
      (dropoffNeedsGeo && dropoffLat && dropoffLng);

    if (shouldUpdateGeo) {
      await db.query(
        `UPDATE deliveries
         SET pickup_lat=$1, pickup_lng=$2,
             dropoff_lat=$3, dropoff_lng=$4,
             pickup_address_hash=$5,
             dropoff_address_hash=$6,
             geocoded_at=NOW()
         WHERE id=$7`,
        [
          pickupLat || null,
          pickupLng || null,
          dropoffLat || null,
          dropoffLng || null,
          pHash,
          dHash,
          delivery.id,
        ]
      );

      const refreshed = await db.query(`SELECT * FROM deliveries WHERE id=$1`, [delivery.id]);
      if (refreshed.rows.length) delivery = refreshed.rows[0];
    }

    const pickup =
      delivery.pickup_lat && delivery.pickup_lng
        ? { lat: Number(delivery.pickup_lat), lng: Number(delivery.pickup_lng) }
        : null;

    const dropoff =
      delivery.dropoff_lat && delivery.dropoff_lng
        ? { lat: Number(delivery.dropoff_lat), lng: Number(delivery.dropoff_lng) }
        : null;

    // ===== Route caching (pickup -> dropoff only) =====
    let route = null;

    if (pickup && dropoff) {
      const key = routeKey(pickup, dropoff);

      const cached = safeJsonParse(delivery.route_points);
      const cacheOk =
        delivery.route_cache_key === key &&
        Array.isArray(cached) &&
        cached.length >= 2;

      if (cacheOk) {
        route = cached;
      } else {
        const road = await getRoadRoutePickupDropoff(pickup, dropoff);

        if (Array.isArray(road) && road.length >= 2) {
          route = road;

          await db.query(
            `UPDATE deliveries
             SET route_points=$1,
                 route_cache_key=$2,
                 route_cached_at=NOW()
             WHERE id=$3`,
            [JSON.stringify(route), key, delivery.id]
          );

          const refreshed = await db.query(`SELECT * FROM deliveries WHERE id=$1`, [delivery.id]);
          if (refreshed.rows.length) delivery = refreshed.rows[0];
        } else {
          route = [
            [pickup.lat, pickup.lng],
            [dropoff.lat, dropoff.lng],
          ];
        }
      }
    } else {
      route = null;
    }

    return res.json({
      delivery,
      driver,
      driver_location,
      pickup,
      dropoff,
      route,
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   FEEDBACK REPORTS (Admin/Dispatcher)
   GET /deliveries/feedback
   Query params:
     - q: search in reference_no, customer name/email, comment
     - min_rating, max_rating
     - limit, offset
   ========================================= */
router.get("/feedback", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const q = String(req.query.q || "").trim();
    const minRating = req.query.min_rating != null ? Number(req.query.min_rating) : null;
    const maxRating = req.query.max_rating != null ? Number(req.query.max_rating) : null;
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const where = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(
        `(d.reference_no ILIKE $${i} OR COALESCE(u.name,'') ILIKE $${i} OR COALESCE(u.email,'') ILIKE $${i} OR COALESCE(f.comment,'') ILIKE $${i})`
      );
    }

    if (Number.isFinite(minRating)) {
      params.push(minRating);
      where.push(`f.rating >= $${params.length}`);
    }

    if (Number.isFinite(maxRating)) {
      params.push(maxRating);
      where.push(`f.rating <= $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countR = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM delivery_feedback f
       JOIN deliveries d ON d.id=f.delivery_id
       LEFT JOIN users u ON u.id=f.created_by
       ${whereSql}`,
      params
    );

    params.push(limit);
    params.push(offset);

    const rowsR = await db.query(
      `SELECT
         f.delivery_id,
         f.rating,
         f.comment,
         f.created_at,

         u.id AS customer_user_id,
         u.name AS customer_name,
         u.email AS customer_email,

         d.reference_no,
         d.status,
         d.pickup_address,
         d.dropoff_address,

         d.assigned_driver_id,
         du.name AS driver_name,
         du.email AS driver_email

       FROM delivery_feedback f
       JOIN deliveries d ON d.id=f.delivery_id
       LEFT JOIN users u ON u.id=f.created_by

       -- driver join (delivery.assigned_driver_id -> drivers -> users)
       LEFT JOIN drivers drv ON drv.id = d.assigned_driver_id
       LEFT JOIN users du ON du.id = drv.user_id

       ${whereSql}
       ORDER BY f.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const summaryR = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS avg_rating,
         SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END)::int AS five_star,
         SUM(CASE WHEN rating=4 THEN 1 ELSE 0 END)::int AS four_star,
         SUM(CASE WHEN rating=3 THEN 1 ELSE 0 END)::int AS three_star,
         SUM(CASE WHEN rating=2 THEN 1 ELSE 0 END)::int AS two_star,
         SUM(CASE WHEN rating=1 THEN 1 ELSE 0 END)::int AS one_star
       FROM delivery_feedback`,
      []
    );

    return res.json({
      count: countR.rows?.[0]?.count || 0,
      rows: rowsR.rows || [],
      summary: summaryR.rows?.[0] || {
        total: 0,
        avg_rating: 0,
        five_star: 0,
        four_star: 0,
        three_star: 0,
        two_star: 0,
        one_star: 0,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   LIST DELIVERIES (Admin/Dispatcher)
   GET /deliveries
   ========================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { status = "ALL", q = "", limit = "20", offset = "0" } = req.query;

    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const off = parseInt(offset, 10) || 0;

    const where = [];
    const params = [];

    if (status && status !== "ALL") {
      params.push(status);
      where.push(`d.status = $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      const p = `$${params.length}`;
      where.push(`(
        d.reference_no ILIKE ${p} OR
        d.customer_name ILIKE ${p} OR
        d.pickup_address ILIKE ${p} OR
        d.dropoff_address ILIKE ${p}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const count = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM deliveries d
       ${whereSql}`,
      params
    );

    params.push(lim);
    params.push(off);

    const list = await db.query(
      `SELECT d.*
       FROM deliveries d
       ${whereSql}
       ORDER BY d.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params
    );

    res.json({ total: count.rows[0].total, rows: list.rows });
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   ADMIN: create a DRIVER user account
   POST /deliveries/driver-users
   ========================================= */
router.post("/driver-users", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, and password are required" });
    }

    const exists = await db.query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.rows.length) return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const created = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1,$2,$3,'DRIVER')
       RETURNING id, name, email, role`,
      [name, email, hashed]
    );

    return res.json(created.rows[0]);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   LIST DRIVERS (Admin/Dispatcher)
   GET /deliveries/drivers
   ========================================= */
router.get("/drivers", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const users = await db.query(
      `SELECT id, name, email
       FROM users
       WHERE role='DRIVER'
       ORDER BY id ASC`
    );

    if (users.rows.length) {
      const existing = await db.query(`SELECT id AS driver_id, user_id, status FROM drivers`);
      const byUserId = new Map(existing.rows.map((r) => [Number(r.user_id), r]));

      for (const u of users.rows) {
        if (!byUserId.has(Number(u.id))) {
          await db.query(`INSERT INTO drivers (user_id, status) VALUES ($1,$2)`, [u.id, "AVAILABLE"]);
        }
      }
    }

    const r = await db.query(
      `SELECT
          d.id AS driver_id,
          d.user_id,
          COALESCE(d.status, 'AVAILABLE') AS status,
          u.name,
          u.email
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       WHERE u.role='DRIVER'
       ORDER BY d.id ASC`
    );

    return res.json({ rows: r.rows });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   LIST DRIVER LOCATIONS (Admin/Dispatcher)
   GET /deliveries/driver-locations
   ========================================= */
router.get("/driver-locations", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const r = await db.query(
      `SELECT
          dl.driver_id,
          dl.lat,
          dl.lng,
          dl.accuracy,
          dl.heading,
          dl.speed,
          dl.updated_at,
          u.name,
          u.email
       FROM driver_locations dl
       JOIN drivers d ON d.id = dl.driver_id
       JOIN users u ON u.id = d.user_id
       ORDER BY dl.updated_at DESC`
    );

    return res.json({ rows: r.rows });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   ADMIN: CREATE DRIVER record
   POST /deliveries/drivers
   ========================================= */
router.post("/drivers", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });

    const { user_id, status } = req.body;
    if (!user_id) return res.status(400).json({ message: "user_id is required" });

    const u = await db.query("SELECT id FROM users WHERE id=$1", [user_id]);
    if (!u.rows.length) return res.status(404).json({ message: "User not found" });

    const existing = await db.query("SELECT id FROM drivers WHERE user_id=$1", [user_id]);
    if (existing.rows.length) return res.status(400).json({ message: "Driver already exists" });

    const r = await db.query(
      `INSERT INTO drivers (user_id, status)
       VALUES ($1, $2)
       RETURNING id AS driver_id, user_id, status`,
      [user_id, (status || "AVAILABLE").toUpperCase()]
    );

    return res.json({ ...r.rows[0], name: `Driver #${r.rows[0].driver_id}` });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   ADMIN: UPDATE DRIVER STATUS
   PATCH /deliveries/drivers/:driverId
   ========================================= */
router.patch("/drivers/:driverId", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });

    const driverId = Number(req.params.driverId);
    const { status } = req.body;

    if (!driverId) return res.status(400).json({ message: "Invalid driver id" });
    if (!status) return res.status(400).json({ message: "status is required" });

    const r = await db.query(
      `UPDATE drivers
       SET status=$1
       WHERE id=$2
       RETURNING id AS driver_id, user_id, status`,
      [String(status).toUpperCase(), driverId]
    );

    if (!r.rows.length) return res.status(404).json({ message: "Driver not found" });
    return res.json({ ...r.rows[0], name: `Driver #${r.rows[0].driver_id}` });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   ADMIN: list users that can be turned into drivers
   GET /deliveries/driver-users
   ========================================= */
router.get("/driver-users", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });

    const r = await db.query(
      `SELECT u.id, u.name, u.email
       FROM users u
       LEFT JOIN drivers d ON d.user_id = u.id
       WHERE u.role = 'DRIVER'
         AND d.id IS NULL
       ORDER BY u.id ASC`
    );

    return res.json({ rows: r.rows });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   CREATE DELIVERY (Admin/Dispatcher)
   POST /deliveries
   ========================================= */
router.post("/", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const {
      customer_name,
      customer_contact,
      pickup_address,
      dropoff_address,
      package_type,
      package_weight,
      package_notes,
      delivery_date,
      delivery_priority,
    } = req.body;

    if (!customer_name || !pickup_address || !dropoff_address) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const cleanStr = (v) => {
      const s = String(v ?? "").trim();
      return s ? s : null;
    };

    const cleanNum = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      const s = String(v).trim();
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };

    // Accept YYYY-MM-DD or MM/DD/YYYY
    const normalizeDate = (v) => {
      const s = String(v ?? "").trim();
      if (!s) return null;

      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

      const mdy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (mdy) {
        const mm = Number(mdy[1]);
        const dd = Number(mdy[2]);
        const yyyy = Number(mdy[3]);
        if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
          return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        }
      }

      return null;
    };

    const normalizedDate = normalizeDate(delivery_date);

    if (delivery_date && !normalizedDate) {
      return res.status(400).json({
        message: "Invalid delivery_date format. Use YYYY-MM-DD or MM/DD/YYYY.",
      });
    }

    const reference_no = makeRef();

    const result = await db.query(
      `INSERT INTO deliveries
        (reference_no, customer_name, customer_contact, pickup_address, dropoff_address,
         package_type, package_weight, package_notes, delivery_date, delivery_priority,
         status, created_by)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING',$11)
       RETURNING *`,
      [
        reference_no,
        cleanStr(customer_name),
        cleanStr(customer_contact),
        cleanStr(pickup_address),
        cleanStr(dropoff_address),
        cleanStr(package_type),
        cleanNum(package_weight),
        cleanStr(package_notes),
        normalizedDate,
        String(delivery_priority || "NORMAL").toUpperCase(),
        req.user.id,
      ]
    );

    // PENDING event for timeline
    await ensurePendingEvent(result.rows[0].id, req.user.id);

    return res.json(result.rows[0]);
  } catch (e) {
    // IMPORTANT: expose real error so you can debug in the browser
    return res.status(500).json({
      message: "Server error",
      error: e?.message || String(e),
    });
  }
});

/* =========================================
   ASSIGN DRIVER (Admin/Dispatcher)
   POST /deliveries/:id/assign
   ========================================= */
router.post("/:id/assign", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deliveryId = Number(req.params.id);

    const raw =
      req.body?.driver_id ??
      req.body?.driverId ??
      req.body?.driverID ??
      req.body?.assigned_driver_id ??
      req.body?.assignedDriverId;

    const driver_id = Number(raw);

    if (!deliveryId || !driver_id) {
      return res.status(400).json({ message: "Missing delivery id or driverId" });
    }

    const driver = await db.query("SELECT id FROM drivers WHERE id=$1", [driver_id]);
    if (!driver.rows.length) return res.status(404).json({ message: "Driver not found" });

    const before = await db.query(
      `SELECT assigned_driver_id
       FROM deliveries
       WHERE id=$1`,
      [deliveryId]
    );
    if (!before.rows.length) return res.status(404).json({ message: "Delivery not found" });

    const prevDriverId = before.rows[0].assigned_driver_id
      ? Number(before.rows[0].assigned_driver_id)
      : null;
    const isReassign = prevDriverId && prevDriverId !== driver_id;

    const updated = await db.query(
      `UPDATE deliveries
       SET assigned_driver_id=$1,
           status='ASSIGNED'
       WHERE id=$2
       RETURNING *`,
      [driver_id, deliveryId]
    );

    if (!updated.rows.length) return res.status(404).json({ message: "Delivery not found" });

    // ✅ Backfill PENDING for older deliveries (so timeline always starts correctly)
    await ensurePendingEvent(deliveryId, req.user.id);

    // ✅ Log ASSIGNED for timeline
    await db.query(
      `INSERT INTO delivery_events (delivery_id, status, note, created_by)
       VALUES ($1,'ASSIGNED',$2,$3)`,
      [
        deliveryId,
        isReassign ? `Reassigned ${prevDriverId} -> ${driver_id}` : `Assigned to driver_id=${driver_id}`,
        req.user.id,
      ]
    );

    return res.json(updated.rows[0]);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   GET DELIVERY EVENTS (Admin/Dispatcher)
   GET /deliveries/:id/events
   ========================================= */
router.get("/:id/events", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deliveryId = Number(req.params.id);

    // ✅ Backfill PENDING whenever someone views the timeline
    // (covers old deliveries created before event-logging)
    await ensurePendingEvent(deliveryId, req.user.id);

    const r = await db.query(
      `SELECT id, delivery_id, status, note, created_by, created_at
       FROM delivery_events
       WHERE delivery_id=$1
       ORDER BY created_at ASC`,
      [deliveryId]
    );

    res.json({ rows: r.rows });
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   GET POD (Admin/Dispatcher)
   GET /deliveries/:id/pod
   ========================================= */
router.get("/:id/pod", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deliveryId = Number(req.params.id);

    const r = await db.query(
      `SELECT *
       FROM pod
       WHERE delivery_id=$1`,
      [deliveryId]
    );

    if (!r.rows.length) return res.status(404).json({ message: "POD not found" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   GET FAILURE (Admin/Dispatcher)
   GET /deliveries/:id/failure
   ========================================= */
router.get("/:id/failure", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deliveryId = Number(req.params.id);

    const r = await db.query(
      `SELECT *
       FROM delivery_failures
       WHERE delivery_id=$1`,
      [deliveryId]
    );

    if (!r.rows.length) return res.status(404).json({ message: "Failure record not found" });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   CUSTOMER FEEDBACK (Delivered only)
   POST /deliveries/:id/feedback
   ========================================= */
router.post("/:id/feedback", requireAuth, async (req, res) => {
  try {
    const deliveryId = Number(req.params.id);
    const { rating, comment } = req.body;

    if (!deliveryId) return res.status(400).json({ message: "Invalid delivery id" });

    const rNum = Number(rating);
    if (!rNum || rNum < 1 || rNum > 5) {
      return res.status(400).json({ message: "rating must be 1-5" });
    }

    const d = await db.query("SELECT id, status FROM deliveries WHERE id=$1", [deliveryId]);
    if (!d.rows.length) return res.status(404).json({ message: "Delivery not found" });
    if (d.rows[0].status !== "DELIVERED") {
      return res.status(400).json({ message: "Feedback allowed only after DELIVERED" });
    }

    await db.query(
      `INSERT INTO delivery_feedback (delivery_id, rating, comment, created_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (delivery_id, created_by)
       DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment, created_at=NOW()`,
      [deliveryId, rNum, comment || null, req.user.id]
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

/* =========================================
   DELETE DELIVERY (Admin/Dispatcher)
   DELETE /deliveries/:id
   ========================================= */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deliveryId = Number(req.params.id);
    if (!deliveryId) return res.status(400).json({ message: "Invalid delivery id" });

    const check = await db.query("SELECT id, status FROM deliveries WHERE id=$1", [deliveryId]);
    if (!check.rows.length) return res.status(404).json({ message: "Delivery not found" });

    if (check.rows[0].status === "DELIVERED") {
      return res.status(400).json({ message: "Cannot delete a delivered delivery" });
    }

    const tryDelete = async (sql, params) => {
      try {
        await db.query(sql, params);
      } catch {}
    };

    await tryDelete("DELETE FROM pod WHERE delivery_id=$1", [deliveryId]);
    await tryDelete("DELETE FROM delivery_events WHERE delivery_id=$1", [deliveryId]);
    await tryDelete("DELETE FROM delivery_failures WHERE delivery_id=$1", [deliveryId]);
    await tryDelete("DELETE FROM delivery_failure WHERE delivery_id=$1", [deliveryId]);
    await tryDelete("DELETE FROM failures WHERE delivery_id=$1", [deliveryId]);
    await tryDelete("DELETE FROM delivery_feedback WHERE delivery_id=$1", [deliveryId]);

    const del = await db.query("DELETE FROM deliveries WHERE id=$1 RETURNING id", [deliveryId]);
    if (!del.rows.length) return res.status(404).json({ message: "Delivery not found" });

    return res.json({ ok: true, deleted_id: del.rows[0].id });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

// DISPATCHER/ADMIN: cancel a delivery
router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    if (!["ADMIN", "DISPATCHER"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deliveryId = Number(req.params.id);
    if (!deliveryId) return res.status(400).json({ message: "Invalid delivery id" });

    const cur = await db.query("SELECT id, status, reference_no FROM deliveries WHERE id=$1", [deliveryId]);
    if (!cur.rows.length) return res.status(404).json({ message: "Delivery not found" });

    const current = cur.rows[0].status;
    if (["DELIVERED", "FAILED", "CANCELLED"].includes(current)) {
      return res.status(400).json({ message: `Cannot cancel a ${current} delivery` });
    }

    const updated = await db.query(`UPDATE deliveries SET status='CANCELLED' WHERE id=$1 RETURNING *`, [
      deliveryId,
    ]);

    // ✅ Backfill PENDING just in case timeline is missing it (older data)
    await ensurePendingEvent(deliveryId, req.user.id);

    await db.query(
      `INSERT INTO delivery_events (delivery_id, status, note, created_by)
       VALUES ($1,'CANCELLED',$2,$3)`,
      [deliveryId, `Cancelled by ${req.user.role}`, req.user.id]
    );

    return res.json(updated.rows[0]);
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

export default router;
