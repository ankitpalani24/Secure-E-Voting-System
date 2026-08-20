const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Voter = require("../models/Voter");
const Admin = require("../models/Admin");
const Party = require("../models/Party");
const Vote = require("../models/Vote");
const VoterParticipation = require("../models/VoterParticipation");
const { logAuditEvent } = require("../utils/auditUtils");

// ================= ADMIN LOGIN =================
exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Username and password required as valid strings" });
    }

    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin) {
      await logAuditEvent({
        action: "ADMIN_LOGIN_FAILED_UNKNOWN_USER",
        category: "SECURITY_EVENT",
        userRole: "admin",
        status: "DENIED",
        details: { attemptedUsername: String(username) },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(401).json({ message: "Invalid administrative credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      await logAuditEvent({
        action: "ADMIN_LOGIN_FAILED_BAD_PASSWORD",
        category: "SECURITY_EVENT",
        userId: admin._id,
        userRole: "admin",
        status: "DENIED",
        details: { username: admin.username },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(401).json({ message: "Invalid administrative credentials" });
    }

    const role = admin.role || "admin";

    const token = jwt.sign(
      { id: admin._id, role, username: admin.username },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "2h" }
    );

    admin.lastLogin = new Date();
    if (typeof admin.save === "function") {
      await admin.save().catch(() => {});
    }

    await logAuditEvent({
      action: "ADMIN_LOGIN_SUCCESS",
      category: "AUDIT_EVENT",
      userId: admin._id,
      userRole: role,
      status: "SUCCESS",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ token, role, username: admin.username, fullName: admin.fullName || admin.username });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Authentication service error" });
  }
};

// ================= VOTER LOGIN =================
exports.voterLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password required as valid strings" });
    }

    const voter = await Voter.findOne({ email: username.toLowerCase().trim() });
    if (!voter) {
      await logAuditEvent({
        action: "VOTER_LOGIN_FAILED_UNKNOWN_EMAIL",
        category: "SECURITY_EVENT",
        userRole: "voter",
        status: "DENIED",
        details: { attemptedEmail: String(username) },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(401).json({ message: "Invalid voter credentials" });
    }

    const isMatch = await bcrypt.compare(password, voter.password);
    if (!isMatch) {
      await logAuditEvent({
        action: "VOTER_LOGIN_FAILED_BAD_PASSWORD",
        category: "SECURITY_EVENT",
        userId: voter._id,
        userRole: "voter",
        status: "DENIED",
        details: { email: voter.email },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(401).json({ message: "Invalid voter credentials" });
    }

    const token = jwt.sign(
      { id: voter._id, role: "voter", email: voter.email },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "2h" }
    );

    // Derive participation status from VoterParticipation and legacy Vote collection
    const [participationExists, legacyVoteExists] = await Promise.all([
      VoterParticipation.exists({ voterId: voter._id }),
      Vote.exists({ voterId: voter._id }),
    ]);
    const hasVoted = Boolean(participationExists || legacyVoteExists);

    await logAuditEvent({
      action: "Voter Logged In",
      category: "AUDIT_EVENT",
      userId: voter._id,
      userRole: "voter",
      status: "SUCCESS",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      token,
      role: "voter",
      name: voter.name,
      hasVoted,
    });
  } catch (err) {
    console.error("Voter login error:", err);
    res.status(500).json({ message: "Authentication service error" });
  }
};

// ================= PARTY LOGIN =================
exports.partyLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Username and password required as valid strings" });
    }

    const party = await Party.findOne({ username: username.toLowerCase().trim() });
    if (!party) {
      await logAuditEvent({
        action: "PARTY_LOGIN_FAILED_UNKNOWN_USER",
        category: "SECURITY_EVENT",
        userRole: "party",
        status: "DENIED",
        details: { attemptedUsername: username },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(401).json({ message: "Invalid party credentials" });
    }

    const isMatch = await bcrypt.compare(password, party.password);
    if (!isMatch) {
      await logAuditEvent({
        action: "PARTY_LOGIN_FAILED_BAD_PASSWORD",
        category: "SECURITY_EVENT",
        userId: party._id,
        userRole: "party",
        status: "DENIED",
        details: { username: party.username },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(401).json({ message: "Invalid party credentials" });
    }

    const token = jwt.sign(
      { id: party._id, role: "party", partyName: party.partyName },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "2h" }
    );

    await logAuditEvent({
      action: "Party Logged In",
      category: "AUDIT_EVENT",
      userId: party._id,
      userRole: "party",
      status: "SUCCESS",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      token,
      role: "party",
      partyName: party.partyName,
      symbol: party.symbol,
    });
  } catch (err) {
    console.error("Party login error:", err);
    res.status(500).json({ message: "Authentication service error" });
  }
};
