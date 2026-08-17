const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: true,
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
    },
    constituency: {
      type: String,
      default: "Default Constituency",
    },
    symbol: {
      type: String,
    },
    biography: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["NOMINATED", "APPROVED", "REJECTED", "WITHDRAWN"],
      default: "APPROVED",
    },
  },
  {
    timestamps: true,
  }
);

candidateSchema.index({ electionId: 1, partyId: 1 });
candidateSchema.index({ electionId: 1, constituency: 1 });

module.exports = mongoose.model("Candidate", candidateSchema);
