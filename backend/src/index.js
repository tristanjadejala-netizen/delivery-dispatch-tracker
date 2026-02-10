import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import authRoutes from "./routes/auth.js";
import deliveriesRoutes from "./routes/deliveries.js";
import driverRoutes from "./routes/driver.js";
import adminRoutes from "./routes/admin.js"; // ✅ ADD

import path from "path";
import { fileURLToPath } from "url";

const app = express();


const allowedOriginPatterns = [
  /^http:\/\/localhost:5173$/,
  /^https:\/\/delivery-dispatch-tracker\.vercel\.app$/,
  /^https:\/\/delivery-dispatch-tracker-[a-z0-9-]+\.vercel\.app$/, // preview deployments
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman / server-to-server

    const ok = allowedOriginPatterns.some((re) => re.test(origin));
    return ok ? callback(null, true) : callback(new Error("CORS not allowed"));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // IMPORTANT for preflight

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/deliveries", deliveriesRoutes);
app.use("/driver", driverRoutes);
app.use("/admin", adminRoutes); // ✅ ADD

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("✅ API running on port", PORT);
});
