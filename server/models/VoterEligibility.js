const mongoose = require("mongoose");

/**
 * ==============================================================================
 * VOTER ELIGIBILITY DATA MODEL
 * ==============================================================================
 * Explicit server-side abstraction defining which elections a voter is accredited
 * to participate in based on jurisdiction, registration roll, or accreditation.
 * ==============================================================================
 */

const voterEligibilitySchema = new mongoose.Schema(
  {
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voter",
      required: true,
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
      required: true,
    },
    jurisdictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Jurisdiction",
      default: null,
    },
    status: {
      type: String,
      enum: ["ELIGIBLE", "REVOKED", "DISQUALIFIED"],
      default: "ELIGIBLE",
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: Single eligibility record per voter per election
voterEligibilitySchema.index({ voterId: 1, electionId: 1 }, { unique: true });
voterEligibilitySchema.index({ electionId: 1, status: 1 });
voterEligibilitySchema.index({ voterId: 1, status: 1 });

module.exports = mongoose.model("VoterEligibility", voterEligibilitySchema);
