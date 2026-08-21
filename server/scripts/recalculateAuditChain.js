const crypto = require("crypto");
const mongoose = require("mongoose");
const config = require("../config/config");
const AuditLog = require("../models/AuditLog");
const { verifyAuditChain } = require("../utils/auditUtils");

function calculateLogHash(previousHash, timeStr, action, userRole, userId, details) {
  const detailsStr = JSON.stringify(details || {});
  const payload = `${previousHash}|${timeStr}|${action}|${userRole}|${userId}|${detailsStr}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function fixAuditChain() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB for audit chain repair...");

    const logs = await AuditLog.find().sort({ createdAt: 1, _id: 1 });
    console.log(`Auditing ${logs.length} total audit log entries...`);

    let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
    let repairedCount = 0;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const timestamp = log.time || log.createdAt || new Date();
      const timeStr = timestamp.toISOString();

      const expectedHash = calculateLogHash(
        prevHash,
        timeStr,
        log.action,
        log.userRole || "system",
        log.userId ? log.userId.toString() : "anonymous",
        log.details || {}
      );

      await AuditLog.findByIdAndUpdate(log._id, {
        time: timestamp,
        previousHash: prevHash,
        currentHash: expectedHash,
      });
      repairedCount++;

      prevHash = expectedHash;
    }

    console.log(`Repaired and re-chained ${repairedCount} audit blocks.`);

    const verification = await verifyAuditChain();
    console.log("Verification Result:", verification);

    process.exit(0);
  } catch (err) {
    console.error("Audit chain repair error:", err);
    process.exit(1);
  }
}

fixAuditChain();
