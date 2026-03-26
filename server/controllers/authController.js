const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Voter = require("../models/Voter");
const Admin = require("../models/Admin");
const Party = require("../models/Party");
const AuditLog = require("../models/AuditLog");

// ================= ADMIN LOGIN =================
exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(400).json({ message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    await AuditLog.create({
      action: "Admin Logged In",
      userId: admin._id,
    });

    res.json({ token, role: "admin" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= VOTER LOGIN =================
exports.voterLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const voter = await Voter.findOne({ email: username });
    if (!voter) {
      return res.status(400).json({ message: "Voter not found" });
    }

    const isMatch = await bcrypt.compare(password, voter.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: voter._id, role: "voter" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    await AuditLog.create({
      action: "Voter Logged In",
      userId: voter._id,
    });

    res.json({
      token,
      role: "voter",
      name: voter.name,
      hasVoted: voter.hasVoted,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= PARTY LOGIN =================
exports.partyLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const party = await Party.findOne({ username });
    if (!party) {
      return res.status(400).json({ message: "Party not found" });
    }

    const isMatch = await bcrypt.compare(password, party.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: party._id, role: "party" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    await AuditLog.create({
      action: "Party Logged In",
      userId: party._id,
    });

    res.json({ token, role: "party" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

