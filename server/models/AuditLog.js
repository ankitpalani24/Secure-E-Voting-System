const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["AUDIT_EVENT", "SECURITY_EVENT", "SYSTEM_EVENT"],
      default: "AUDIT_EVENT",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    userRole: {
      type: String,
      default: "system",
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "DENIED", "WARNING"],
      default: "SUCCESS",
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    previousHash: {
      type: String,
      default: "0000000000000000000000000000000000000000000000000000000000000000",
    },
    currentHash: {
      type: String,
    },
    time: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ time: -1 });
auditLogSchema.index({ category: 1, action: 1 });
auditLogSchema.index({ electionId: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
