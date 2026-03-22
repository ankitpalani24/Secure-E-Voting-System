const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema({
  voterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Voter",
    unique: true, // VERY IMPORTANT (one vote per voter)
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Vote", voteSchema);
