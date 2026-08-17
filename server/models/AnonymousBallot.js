const mongoose = require("mongoose");

/**
 * Stores the cast vote record with ZERO link to the voter's identity.
 * Contains only the electionId, chosen party/candidate, and a cryptographic commitment hash.
 */
const anonymousBallotSchema = new mongoose.Schema(
  {
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
    },
    ballotCommitmentHash: {
      type: String,
      required: true,
    },
    castAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

anonymousBallotSchema.index({ electionId: 1, partyId: 1 });
anonymousBallotSchema.index({ electionId: 1, candidateId: 1 });
anonymousBallotSchema.index({ ballotCommitmentHash: 1 });

module.exports = mongoose.model("AnonymousBallot", anonymousBallotSchema);
