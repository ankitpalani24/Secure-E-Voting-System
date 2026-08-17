const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * Stores the cast vote record with ZERO link to the voter's identity.
 * Contains only the electionId, chosen party/candidate, and a cryptographic commitment hash.
 * 
 * PRIVACY HARDENING:
 * - Uses a cryptographically random UUID primary key (avoids MongoDB ObjectId sequential counters & epoch timestamps).
 * - Disables automatic mongoose timestamps (no createdAt/updatedAt millisecond leaks).
 * - Contains NO voterId, IP address, user-agent, session ID, or biometric tokens.
 */
const anonymousBallotSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
      required: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      default: null,
    },
    ballotCommitmentHash: {
      type: String,
      required: true,
    },
  },
  {
    // Strictly disable automatic timestamps to eliminate millisecond timing correlation
    timestamps: false,
    versionKey: false,
  }
);

anonymousBallotSchema.index({ electionId: 1, partyId: 1 });
anonymousBallotSchema.index({ electionId: 1, candidateId: 1 });
anonymousBallotSchema.index({ ballotCommitmentHash: 1 });

module.exports = mongoose.model("AnonymousBallot", anonymousBallotSchema);
