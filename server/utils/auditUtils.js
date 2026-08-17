const crypto = require("crypto");
const AuditLog = require("../models/AuditLog");

/**
 * Creates a cryptographically chained audit log entry.
 * Links each new record to the previous record's SHA-256 hash.
 * 
 * @param {Object} params
 * @param {string} params.action
 * @param {string} [params.category]
 * @param {mongoose.Types.ObjectId} [params.userId]
 * @param {string} [params.userRole]
 * @param {mongoose.Types.ObjectId} [params.electionId]
 * @param {string} [params.status]
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {Object} [params.details]
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<AuditLog>}
 */
async function logAuditEvent(params, session = null) {
  try {
    // 1. Retrieve the latest audit log entry to get previousHash
    const query = AuditLog.findOne().sort({ time: -1, _id: -1 });
    if (session) query.session(session);
    const lastEntry = await query.lean();

    const previousHash = lastEntry && lastEntry.currentHash
      ? lastEntry.currentHash
      : "0000000000000000000000000000000000000000000000000000000000000000";

    const timestamp = new Date();
    const action = params.action;
    const userRole = params.userRole || "system";
    const userId = params.userId ? params.userId.toString() : "anonymous";
    const detailsStr = JSON.stringify(params.details || {});

    // Compute deterministic SHA-256 hash for this record
    const payload = `${previousHash}|${timestamp.toISOString()}|${action}|${userRole}|${userId}|${detailsStr}`;
    const currentHash = crypto.createHash("sha256").update(payload).digest("hex");

    const newLog = new AuditLog({
      action: params.action,
      category: params.category || "AUDIT_EVENT",
      userId: params.userId || null,
      userRole: params.userRole || "system",
      electionId: params.electionId || null,
      status: params.status || "SUCCESS",
      ipAddress: params.ipAddress || "127.0.0.1",
      userAgent: params.userAgent || "Unknown",
      details: params.details || {},
      previousHash,
      currentHash,
      time: timestamp,
    });

    if (session) {
      await newLog.save({ session });
    } else {
      await newLog.save();
    }

    return newLog;
  } catch (err) {
    console.error("Audit logging error (non-fatal):", err);
    return null;
  }
}

/**
 * Validates the cryptographic integrity of the entire audit chain.
 * @returns {Promise<{ valid: boolean, totalRecords: number, brokenAt?: number }>}
 */
async function verifyAuditChain() {
  const logs = await AuditLog.find().sort({ time: 1, _id: 1 }).lean();
  if (logs.length === 0) return { valid: true, totalRecords: 0 };

  let expectedPrevHash = "0000000000000000000000000000000000000000000000000000000000000000";

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    if (entry.previousHash !== expectedPrevHash) {
      return { valid: false, totalRecords: logs.length, brokenAt: i };
    }

    const userId = entry.userId ? entry.userId.toString() : "anonymous";
    const detailsStr = JSON.stringify(entry.details || {});
    const payload = `${entry.previousHash}|${new Date(entry.time).toISOString()}|${entry.action}|${entry.userRole}|${userId}|${detailsStr}`;
    const calculatedHash = crypto.createHash("sha256").update(payload).digest("hex");

    if (entry.currentHash !== calculatedHash) {
      return { valid: false, totalRecords: logs.length, brokenAt: i };
    }

    expectedPrevHash = entry.currentHash;
  }

  return { valid: true, totalRecords: logs.length };
}

module.exports = { logAuditEvent, verifyAuditChain };
