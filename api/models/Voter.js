const mongoose = require("mongoose");

const voterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  faceDescriptor: {
    type: [Number], // face recognition data
  },
  hasVoted: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    default: "voter",
  },
});

module.exports = mongoose.model("Voter", voterSchema);
