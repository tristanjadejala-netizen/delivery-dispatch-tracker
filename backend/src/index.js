import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import authRoutes from "./routes/auth.js";
import deliveriesRoutes from "./routes/deliveries.js";
import driverRoutes from "./routes/driver.js";
import adminRoutes from "./routes/admin.js";

import path from "path";
import { fileURLToPath } from "url";

const app = express();


const allowedOriginPatterns = [
  /^http:\/\/localhost:5173$/,
  // Your production Vercel domain
  /^https:\/\/delivery-dispatch-tracker\.vercel\.app$/,
  // Any Vercel preview deployment for this project
  /^https:\/\/delivery-dispatch-tracker-[a-z0-9-]+\.vercel\.app$/,
];

// Optional: allow a single env-based frontend URL (ex: https://your-domain.com)
if (process.env.FRONTEND_BASE_URL) {
  const envOrigin = process.env.FRONTEND_BASE_URL.trim().replace(/\/$/, "");
  // Escape for regex
  const escaped = envOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  allowedOriginPatterns.push(new RegExp(`^${escaped}$`));
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow Postman / server-to-server (no Origin header)
    if (!origin) return callback(null, true);

    const ok = allowedOriginPatterns.some((re) => re.test(origin));
    return ok ? callback(null, true) : callback(new Error("CORS not allowed"));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // IMPORTANT: preflight (no "*" string)

app.use(express.json());

// Static uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get("/", (req, res) => res.json({ ok: true }));

// Routes
app.use("/auth", authRoutes);
app.use("/deliveries", deliveriesRoutes);
app.use("/driver", driverRoutes);
app.use("/admin", adminRoutes);

// Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("✅ API running on port", PORT);
});
