const bcrypt = require("bcryptjs");
const Voter = require("../models/Voter");
const Party = require("../models/Party");
const Vote = require("../models/Vote");
const AnonymousBallot = require("../models/AnonymousBallot");
const VoterParticipation = require("../models/VoterParticipation");
const Election = require("../models/Election");
const { euclideanDistance } = require("../utils/faceUtils");
const { logAuditEvent } = require("../utils/auditUtils");

// ================= ADD VOTER =================
exports.addVoter = async (req, res) => {
  try {
    const { name, email, password, faceDescriptor } = req.body;

    if (!name || !email || !password || typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "All registration fields are required as valid strings" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const existingVoter = await Voter.findOne({ email: email.toLowerCase().trim() });
    if (existingVoter) {
      return res.status(400).json({ message: "Email already registered" });
    }

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ message: "Invalid or missing face biometric data (128-float vector required)" });
    }

    // Check for duplicate faces (bounded scan with projections)
    const existingFaces = await Voter.find({ faceDescriptor: { $exists: true, $ne: [] } }, "faceDescriptor email").lean();
    for (let i = 0; i < existingFaces.length; i++) {
      const v = existingFaces[i];
      if (v.faceDescriptor && v.faceDescriptor.length === 128) {
        const distance = euclideanDistance(faceDescriptor, v.faceDescriptor);
        if (distance < 0.50) {
          await logAuditEvent({
            action: "VOTER_REGISTRATION_FAILED_DUPLICATE_FACE",
            category: "SECURITY_EVENT",
            userId: req.user ? req.user.id : null,
            userRole: "admin",
            status: "DENIED",
            details: { emailAttempt: email },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
          return res.status(400).json({ message: "Facial biometric data is already registered under another account." });
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const voter = await Voter.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      faceDescriptor,
    });

    await logAuditEvent({
      action: "Voter Registered",
      category: "AUDIT_EVENT",
      userId: voter._id,
      userRole: "voter",
      status: "SUCCESS",
      details: { email: voter.email, name: voter.name },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Return sanitized voter response (NEVER return password hash or biometric vector)
    res.status(201).json({
      message: "Voter added successfully",
      voter: {
        _id: voter._id,
        name: voter.name,
        email: voter.email,
        role: voter.role,
      },
    });
  } catch (err) {
    console.error("Add voter error:", err);
    res.status(500).json({ message: err.message || "Failed to register voter" });
  }
};

// ================= ADD PARTY =================
exports.addParty = async (req, res) => {
  try {
    const { partyName, symbol, description, manifesto, username, password } = req.body;

    if (
      !partyName ||
      !symbol ||
      !username ||
      !password ||
      typeof partyName !== "string" ||
      typeof symbol !== "string" ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({ message: "Party name, symbol, username, and password must be valid strings" });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanPartyName = partyName.trim();

    const existingByName = await Party.findOne({ partyName: cleanPartyName });
    if (existingByName) {
      return res.status(400).json({ message: "A party with that name already exists" });
    }

    const existingByUsername = await Party.findOne({ username: cleanUsername });
    if (existingByUsername) {
      return res.status(400).json({ message: "That party username is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const party = await Party.create({
      partyName: cleanPartyName,
      symbol: symbol.trim(),
      description: (description || "").trim(),
      manifesto: (manifesto || "").trim(),
      username: cleanUsername,
      password: hashedPassword,
    });

    await logAuditEvent({
      action: "Party Registered",
      category: "AUDIT_EVENT",
      userId: party._id,
      userRole: "party",
      status: "SUCCESS",
      details: { partyName: party.partyName, username: party.username },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Sanitized response without password
    res.status(201).json({
      message: "Party added successfully",
      party: {
        _id: party._id,
        partyName: party.partyName,
        symbol: party.symbol,
        description: party.description,
        username: party.username,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Party name or username already exists" });
    }
    res.status(500).json({ message: err.message || "Failed to register party" });
  }
};

// ================= VIEW ALL VOTERS =================
exports.getVoters = async (req, res) => {
  try {
    // Strictly exclude password AND faceDescriptor to prevent sensitive data leakage
    const voters = await Voter.find({}, "-password -faceDescriptor").lean();

    // Check participation status across both VoterParticipation and legacy Vote collection
    const [participations, legacyVotes] = await Promise.all([
      VoterParticipation.find({}, "voterId participatedAt").lean(),
      Vote.find({}, "voterId timestamp").lean(),
    ]);

    const voteMap = {};
    participations.forEach((p) => {
      voteMap[p.voterId.toString()] = p.participatedAt;
    });
    legacyVotes.forEach((v) => {
      if (!voteMap[v.voterId.toString()]) {
        voteMap[v.voterId.toString()] = v.timestamp;
      }
    });

    voters.forEach((voter) => {
      const voteTimestamp = voteMap[voter._id.toString()];
      voter.hasVoted = !!voteTimestamp;
      if (voteTimestamp) voter.voteTimestamp = voteTimestamp;
    });

    res.json(voters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= VIEW ALL PARTIES =================
exports.getParties = async (req, res) => {
  try {
    const parties = await Party.find({}, "-password").lean();
    res.json(parties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= DASHBOARD STATS =================
exports.getDashboardStats = async (req, res) => {
  try {
    const [votersCount, partiesCount, anonymousBallotsCount, legacyVotesCount] = await Promise.all([
      Voter.countDocuments({}),
      Party.countDocuments({}),
      AnonymousBallot.countDocuments({}),
      Vote.countDocuments({}),
    ]);

    const totalVotes = Math.max(anonymousBallotsCount, legacyVotesCount);

    res.json({
      votersCount,
      partiesCount,
      votesCount: totalVotes,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= ELECTION MANAGEMENT (NEW) =================
exports.getElections = async (req, res) => {
  try {
    let elections = await Election.find().sort({ createdAt: -1 }).lean();
    if (elections.length === 0) {
      // Initialize default active general election if none exist
      const defaultElection = await Election.create({
        title: "National General Election",
        description: "Official secure electronic ballot general election.",
        phase: "VOTING",
        isDefault: true,
      });
      elections = [defaultElection];
    }
    res.json(elections);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateElectionPhase = async (req, res) => {
  try {
    const { electionId, phase } = req.body;
    const validPhases = ["DRAFT", "REGISTRATION", "SCHEDULED", "VOTING", "CLOSED", "TALLIED", "PUBLISHED", "ARCHIVED"];

    if (!validPhases.includes(phase)) {
      return res.status(400).json({ message: "Invalid election phase state" });
    }

    const election = await Election.findByIdAndUpdate(
      electionId,
      { phase },
      { new: true }
    );

    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }

    await logAuditEvent({
      action: `ELECTION_PHASE_CHANGED_TO_${phase}`,
      category: "AUDIT_EVENT",
      userId: req.user.id,
      userRole: "admin",
      electionId: election._id,
      status: "SUCCESS",
      details: { newPhase: phase },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: `Election phase updated to ${phase}`, election });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= AUDIT LOG INSPECTOR =================
exports.getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ time: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      logs,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verifyAuditChainEndpoint = async (req, res) => {
  try {
    const { verifyAuditChain } = require("../utils/auditUtils");
    const result = await verifyAuditChain();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

