// backend/src/utils/notify.js
// Minimal notification system (DB-backed) used by Dispatcher/Admin UI.

import { db } from "../db.js";

let _schemaReady = false;

export async function ensureNotificationSchema() {
  if (_schemaReady) return;

  // 1) notifications table
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,              -- ORDERS | DRIVERS | SYSTEM
      subtype TEXT NOT NULL,           -- ORDER_CREATED, ORDER_ASSIGNED, PICKED_UP, DELIVERED, FAILED, DRIVER_CREATED, SYSTEM_EVENT
      entity_id BIGINT NULL,           -- delivery_id / driver_id / etc
      reference_no TEXT NULL,          -- ORD-....
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_by INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 2) per-user read receipts
  await db.query(`
    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (notification_id, user_id)
    );
  `);

  // Helpful index for feed ordering
  await db.query(`
    CREATE INDEX IF NOT EXISTS notifications_created_at_idx
    ON notifications (created_at DESC);
  `);

  _schemaReady = true;
}

export async function createNotification({
  type,
  subtype,
  entity_id = null,
  reference_no = null,
  title,
  message,
  created_by = null,
}) {
  await ensureNotificationSchema();

  const r = await db.query(
    `INSERT INTO notifications (type, subtype, entity_id, reference_no, title, message, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      String(type),
      String(subtype),
      entity_id == null ? null : Number(entity_id),
      reference_no == null ? null : String(reference_no),
      String(title),
      String(message),
      created_by == null ? null : Number(created_by),
    ],
  );

  return r.rows[0];
}

export async function seedDefaultSystemEventIfEmpty() {
  await ensureNotificationSchema();
  const existing = await db.query(
    `SELECT 1 FROM notifications WHERE type='SYSTEM' LIMIT 1`,
  );
  if (existing.rows.length) return;

  await createNotification({
    type: "SYSTEM",
    subtype: "SYSTEM_EVENT",
    title: "System Update:",
    message:
      "FastPaSS notifications are now live. New delivery and driver events will appear here automatically.",
  });
}
