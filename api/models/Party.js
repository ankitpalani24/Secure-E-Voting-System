const mongoose = require("mongoose");

const partySchema = new mongoose.Schema({
  partyName: {
    type: String,
    required: true,
    unique: true,
  },

  symbol: String,
  description: String,

  // 🔐 Add login credentials
  username: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    default: "party",
  }
});

module.exports = mongoose.model("Party", partySchema);