// ================== IMPORTS ==================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load env variables
dotenv.config();

// ================== APP INIT ==================
const app = express();

// ================== MIDDLEWARE ==================
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Security Headers (configured to allow face-api models and local assets)
app.use(
  helmet({
    contentSecurityPolicy: false, // disabled for hybrid local dev/CDN assets flexibility
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// Global Rate Limiter: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again later." }
});
app.use("/api/", globalLimiter);

// Authentication Rate Limiter (Brute-force protection: 20 login attempts per 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again after 15 minutes." }
});
app.use("/api/auth/", authLimiter);

app.use(cors());
app.use(express.json({ limit: "5mb" })); // Sufficient for face descriptor arrays
const path = require("path");

// ================== HEALTH CHECK ==================
app.get("/healthz", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    uptime: process.uptime()
  });
});

// ================== STATIC FILES (Local Dev) ==================
// When running locally, serve frontend files
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.use("/client", express.static(path.join(__dirname, "../client")));
  app.use("/models", express.static(path.join(__dirname, "../models")));
}

// ================== ROUTES IMPORT ==================
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const voterRoutes = require("./routes/voterRoutes");
const partyRoutes = require("./routes/partyRoutes");
const resultsRoutes = require("./routes/resultsRoutes");

// ================== ROUTES ==================
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/results", resultsRoutes);

// ================== DEFAULT ROUTE ==================
app.get("/", (req, res) => {
  res.send("Secure Online Voting System API is running...");
});

// ================== ERROR HANDLER ==================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// ================== SERVERLESS-SAFE DB CONNECTION ==================
// Cache the connection promise so warm serverless invocations don't re-connect.
let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  cachedConnection = mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  await cachedConnection;
  console.log("MongoDB Connected Successfully");
  return cachedConnection;
}

// ================== HANDLER EXPORT ==================
// Vercel calls module.exports as the serverless function handler.
// We await the DB connection before forwarding the request to Express.
module.exports = async (req, res) => {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error("MongoDB Connection Failed:", err);
    return res.status(500).json({ message: "Database connection failed" });
  }
  return app(req, res);
};

// ================== LOCAL DEV SERVER ==================
// Start HTTP server only when running locally (not on Vercel).
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  connectToDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Startup failed:", err);
    });
}
