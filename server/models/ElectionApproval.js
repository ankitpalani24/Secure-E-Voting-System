const mongoose = require("mongoose");
const { ELECTION_PHASES } = require("../utils/electionEngine");

const APPROVAL_ACTIONS = Object.freeze({
  OPEN_VOTING: "OPEN_VOTING",
  CLOSE_VOTING: "CLOSE_VOTING",
  PUBLISH_RESULTS: "PUBLISH_RESULTS",
  ARCHIVE_ELECTION: "ARCHIVE_ELECTION",
  MODIFY_DATES: "MODIFY_DATES",
  EMERGENCY_LOCK: "EMERGENCY_LOCK",
  EMERGENCY_UNLOCK: "EMERGENCY_UNLOCK",
});

const APPROVAL_STATUS = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXECUTED: "EXECUTED",
  EXPIRED: "EXPIRED",
});

const electionApprovalSchema = new mongoose.Schema(
  {
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(APPROVAL_ACTIONS),
      required: true,
      index: true,
    },
    targetPhase: {
      type: String,
      enum: Object.values(ELECTION_PHASES),
      default: null,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    requestedByUsername: {
      type: String,
      default: "Admin",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },
    approvedByUsername: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.PENDING,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "Standard election operations proposal.",
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    executedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24-hour validity
    },
  },
  {
    timestamps: true,
  }
);

electionApprovalSchema.index({ electionId: 1, status: 1 });
electionApprovalSchema.index({ requestedBy: 1, status: 1 });
electionApprovalSchema.index({ status: 1, createdAt: -1 });

module.exports = {
  ElectionApproval: mongoose.model("ElectionApproval", electionApprovalSchema),
  APPROVAL_ACTIONS,
  APPROVAL_STATUS,
};
