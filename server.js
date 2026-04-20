import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import advancedRoutes from "./routes/advancedRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";

dotenv.config();

const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to Database
connectDB();

const app = express();

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: process.env.NODE_ENV === "production" ? { policy: "same-site" } : false,
  })
);
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(globalLimiter);

// Main Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MITAOE Smart Attendance System API",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/advanced", advancedRoutes);
app.use("/api/profile", profileRoutes);

// Return JSON 404 for undefined API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ message: "API route not found" });
});

// In production, serve the built React app from the same Express server
if (process.env.NODE_ENV === "production") {
  const clientDistPath = path.resolve(__dirname, "../client/dist");
  app.use(express.static(clientDistPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
