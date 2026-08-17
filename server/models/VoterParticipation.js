const mongoose = require("mongoose");

/**
 * Tracks THAT a voter has participated in a specific election,
 * WITHOUT storing or linking WHAT candidate or party they voted for.
 * 
 * PRIVACY & INTEGRITY CONTROLS:
 * - Strict compound unique index on { voterId, electionId } enforces one-person-one-vote.
 * - Coarse timestamping prevents millisecond side-channel correlation with the anonymous ballot collection.
 * - Automatically disallows storage of partyId, candidateId, or ballot identifiers.
 */
const voterParticipationSchema = new mongoose.Schema(
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
    participatedAt: {
      type: Date,
      default: () => new Date(Math.floor(Date.now() / 3600000) * 3600000), // Hourly coarse bucket
    },
    verificationMethod: {
      type: String,
      enum: ["FACE_BIOMETRIC", "PASSWORD_ONLY", "MFA_OTP"],
      default: "FACE_BIOMETRIC",
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound Unique Index: Prevents duplicate voting in the same election
voterParticipationSchema.index({ voterId: 1, electionId: 1 }, { unique: true });

module.exports = mongoose.model("VoterParticipation", voterParticipationSchema);
