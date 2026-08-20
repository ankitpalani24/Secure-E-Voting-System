const dns = require("dns");
const dotenv = require("dotenv");
dotenv.config();

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore in environments where custom DNS servers cannot be set
}

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// Validate mandatory environment variables in production
const MONGO_URI = process.env.MONGO_URI || (isProd ? null : "mongodb://127.0.0.1:27017/voting-system");
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? null : "dev_jwt_secret_key_voting_system_local_32chars_min");

if (isProd) {
  if (!MONGO_URI) {
    throw new Error("CRITICAL CONFIGURATION ERROR: MONGO_URI environment variable is required in production.");
  }
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("CRITICAL CONFIGURATION ERROR: JWT_SECRET must be at least 32 characters long in production.");
  }
}

const config = {
  env: NODE_ENV,
  isProd,
  port: parseInt(process.env.PORT || "5000", 10),
  mongoUri: MONGO_URI,
  jwtSecret: JWT_SECRET,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  rateLimits: {
    globalMax: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || "300", 10),
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "30", 10),
    faceVerifyMax: parseInt(process.env.RATE_LIMIT_FACE_MAX || "20", 10),
    voteMax: parseInt(process.env.RATE_LIMIT_VOTE_MAX || "30", 10),
  },
};

module.exports = config;
