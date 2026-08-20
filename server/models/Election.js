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
      sparse: true,
    },
    description: {
      type: String,
      default: "Standard electronic democratic election.",
    },
    electionType: {
      type: String,
      enum: ["NATIONAL", "STATE", "MUNICIPAL", "ORGANIZATIONAL", "GENERAL"],
      default: "GENERAL",
    },
    phase: {
      type: String,
      enum: Object.values(ELECTION_PHASES),
      default: ELECTION_PHASES.VOTING, // Default to VOTING for non-breaking backward compatibility
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
      default: true,
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
electionSchema.index({ electionCode: 1 }, { sparse: true });

module.exports = mongoose.model("Election", electionSchema);
