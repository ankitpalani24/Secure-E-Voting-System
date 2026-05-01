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
    type: [Number], // 128-element face recognition embedding
  },
  role: {
    type: String,
    default: "voter",
  },
});

module.exports = mongoose.model("Voter", voterSchema);
