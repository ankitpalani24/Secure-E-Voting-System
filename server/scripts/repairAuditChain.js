const crypto = require("crypto");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const config = require("../config/config");
const AuditLog = require("../models/AuditLog");

async function repairChain() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log("Connected to MongoDB for audit chain repair...");

  const logs = await AuditLog.find().sort({ time: 1, _id: 1 });
  console.log(`Auditing and sealing ${logs.length} records...`);

  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000";

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const timeStr = log.time ? new Date(log.time).toISOString() : new Date().toISOString();
    const action = log.action || "UNKNOWN_ACTION";
    const userRole = log.userRole || "system";
    const userId = log.userId ? log.userId.toString() : "anonymous";
    const detailsStr = JSON.stringify(log.details || {});

    // Compute canonical payload
    const payload = `${previousHash}|${timeStr}|${action}|${userRole}|${userId}|${detailsStr}`;
    const currentHash = crypto.createHash("sha256").update(payload).digest("hex");

    if (log.previousHash !== previousHash || log.currentHash !== currentHash) {
      console.log(`Repairing block #${i} (${action})`);
      log.previousHash = previousHash;
      log.currentHash = currentHash;
      await log.save();
    }

    previousHash = currentHash;
  }

  console.log(`Successfully verified and sealed all ${logs.length} audit chain blocks.`);
  await mongoose.disconnect();
}

repairChain().catch(console.error);
