import dotenv from "dotenv";
dotenv.config();

import pkg from "pg";
const { Pool } = pkg;

const config = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
};

// Only set password if it exists
if (process.env.DB_PASSWORD != null && process.env.DB_PASSWORD !== "") {
  config.password = String(process.env.DB_PASSWORD);
}

// ✅ Supabase requires SSL for remote connections
// Set DB_SSL=true in Render env vars
if (String(process.env.DB_SSL).toLowerCase() === "true") {
  config.ssl = { rejectUnauthorized: false };
}

export const db = new Pool(config);
export default db;
