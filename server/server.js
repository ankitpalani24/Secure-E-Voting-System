// ================== IMPORTS ==================
const http = require("http");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const config = require("./config/config");
const logger = require("./utils/logger");
const requestIdMiddleware = require("./middleware/requestId");
const errorHandler = require("./middleware/errorHandler");

// ================== APP & SERVER INIT ==================
const app = express();
const server = http.createServer(app);

// ================== SOCKET.IO INIT ==================
const io = new Server(server, {
  cors: {
    origin: config.corsOrigin === "*" ? true : config.corsOrigin,
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e6, // 1MB message cap
});

io.on("connection", (socket) => {
  logger.debug("Socket client connected: " + socket.id);
  socket.on("disconnect", () => {
    logger.debug("Socket client disconnected: " + socket.id);
  });
});

app.set("io", io);

// ================== SECURITY HEADERS ==================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://cdn.socket.io",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "data:",
        ],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://cdn.socket.io",
          "ws:",
          "wss:",
        ],
        mediaSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true,
  })
);

// ================== REQUEST ID & PARSERS ==================
app.use(requestIdMiddleware);
app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
app.use(express.json({ limit: "5mb" })); // Sufficient for face descriptor arrays

// Inbound Request Observability Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${durationMs}ms)`, {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
    });
  });
  next();
});

// ================== RATE LIMITERS ==================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimits.globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again later." },
});
app.use("/api/", globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimits.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again after 15 minutes." },
});
app.use("/api/auth/", authLimiter);

const faceVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimits.faceVerifyMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many biometric verification attempts. Please try again after 15 minutes." },
});
app.use("/api/voter/face-verify", faceVerifyLimiter);

const voteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimits.voteMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many vote submissions from this IP. Please try again later." },
});
app.use("/api/voter/vote", voteLimiter);

// ================== HEALTH & READINESS PROBES ==================
// Liveness probe: Is the Node process running?
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: req.id,
  });
});

// Readiness probe: Is MongoDB connected and ready to process transactions?
app.get("/readyz", (req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  const status = isReady ? 200 : 503;
  res.status(status).json({
    status: isReady ? "ready" : "unavailable",
    database: isReady ? "connected" : "disconnected",
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
});

// ================== STATIC ASSETS ==================
app.use("/client", express.static(path.join(__dirname, "../client")));
app.use("/models", express.static(path.join(__dirname, "../client/models")));

// ================== API ROUTES ==================
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const voterRoutes = require("./routes/voterRoutes");
const partyRoutes = require("./routes/partyRoutes");
const resultsRoutes = require("./routes/resultsRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/results", resultsRoutes);

app.get("/", (req, res) => {
  res.redirect("/client/login/login.html");
});

// ================== CENTRALIZED ERROR HANDLER ==================
app.use(errorHandler);

// ================== DATABASE CONNECTION ==================
let cachedConnection = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!config.mongoUri) {
    throw new Error("MONGO_URI environment variable is missing. Set MONGO_URI in your cloud deployment settings.");
  }
  if (!cachedConnection) {
    cachedConnection = mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
  }
  await cachedConnection;
  logger.info("MongoDB Connected Successfully");
  return cachedConnection;
}

// Database Connection Lifecycle Observers
mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB connection lost. Reconnecting...");
});
mongoose.connection.on("error", (err) => {
  logger.error("MongoDB connection error: " + err.message);
});
mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected successfully.");
});

// ================== GRACEFUL SHUTDOWN ==================
function handleGracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    logger.info("HTTP & WebSocket server closed.");
    try {
      await mongoose.connection.close(false);
      logger.info("MongoDB connection closed.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during MongoDB disconnection: " + err.message);
      process.exit(1);
    }
  });

  // Force close if graceful shutdown takes longer than 10 seconds
  setTimeout(() => {
    logger.error("Forcefully terminating process after shutdown timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

// ================== SERVERLESS EXPORT (Vercel Handler) ==================
module.exports = async (req, res) => {
  try {
    await connectToDatabase();
  } catch (err) {
    logger.error("Serverless MongoDB Connection Failed: " + err.message);
    return res.status(500).json({
      message: "Database connection failed. Ensure MONGO_URI is configured in cloud environment variables.",
      error: process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
  return app(req, res);
};

// ================== STANDALONE SERVER BOOT ==================
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  connectToDatabase()
    .then(() => {
      server.listen(config.port, () => {
        logger.info(`Secure Voting System running on port ${config.port} [env: ${config.env}]`);
      });
    })
    .catch((err) => {
      logger.error("Server startup failed: " + err.message);
    });
}
