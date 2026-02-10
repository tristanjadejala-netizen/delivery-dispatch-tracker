import { db } from "./db.js";

const run = async () => {
  const r = await db.query("SELECT NOW() as now");
  console.log("✅ DB connected. Server time:", r.rows[0].now);
  process.exit(0);
};

run().catch((e) => {
  console.error("❌ DB connection failed:", e.message);
  process.exit(1);
});
