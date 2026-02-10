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

app.use(cors());
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
