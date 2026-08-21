const mongoose = require("mongoose");
const { ELECTION_PHASES } = require("../utils/electionEngine");

const electionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: "General Election",
    },
    electionCode: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      default: "Standard electronic democratic election.",
    },
    electionType: {
      type: String,
      enum: ["NATIONAL", "STATE", "LOCAL", "INSTITUTIONAL", "MUNICIPAL", "GENERAL"],
      default: "NATIONAL",
    },
    jurisdictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Jurisdiction",
      default: null,
    },
    phase: {
      type: String,
      enum: Object.values(ELECTION_PHASES),
      default: ELECTION_PHASES.DRAFT,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
      default: "ACTIVE",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
    },
    constituencies: {
      type: [String],
      default: ["Default Constituency"],
    },
    publishLiveTally: {
      type: Boolean,
      default: false, // Embargo results to citizens until RESULTS_PUBLISHED phase
    },
    configuration: {
      allowBiometricVerification: { type: Boolean, default: true },
      maxBallotChoices: { type: Number, default: 1 },
      allowWriteIns: { type: Boolean, default: false },
      requireTwoPersonGovernance: { type: Boolean, default: true },
    },
    resultsPublishedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    manifestHash: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

electionSchema.index({ phase: 1 });
electionSchema.index({ isDefault: 1 });
electionSchema.index({ jurisdictionId: 1 });
electionSchema.index({ electionType: 1 });
electionSchema.index({ status: 1 });
electionSchema.index({ electionCode: 1 }, { sparse: true });

module.exports = mongoose.model("Election", electionSchema);
