const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Voter = require("../models/Voter");
const Party = require("../models/Party");
const Vote = require("../models/Vote");
const AnonymousBallot = require("../models/AnonymousBallot");
const VoterParticipation = require("../models/VoterParticipation");
const Election = require("../models/Election");
const Jurisdiction = require("../models/Jurisdiction");
const VoterEligibility = require("../models/VoterEligibility");
const AuditLog = require("../models/AuditLog");
const { euclideanDistance } = require("../utils/faceUtils");
const { logAuditEvent } = require("../utils/auditUtils");
const { validatePhaseTransition, validateElectionDates, ELECTION_PHASES } = require("../utils/electionEngine");
const logger = require("../utils/logger");

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
    logger.error("Add voter error: " + err.message, { requestId: req.id, method: "POST", path: "/api/admin/add-voter" });
    res.status(500).json({ message: "Failed to register voter" });
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
    logger.error("Add party error: " + err.message, { requestId: req.id, method: "POST", path: "/api/admin/add-party" });
    res.status(500).json({ message: "Failed to register party" });
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
    logger.error("Get voters error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to retrieve voters list" });
  }
};

// ================= VIEW ALL PARTIES =================
exports.getParties = async (req, res) => {
  try {
    const parties = await Party.find({}, "-password").lean();
    res.json(parties);
  } catch (err) {
    logger.error("Get parties error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to retrieve parties list" });
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
    logger.error("Get stats error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to load dashboard statistics" });
  }
};

// ================= JURISDICTION MANAGEMENT =================
exports.createJurisdiction = async (req, res) => {
  try {
    const { name, type, code, parentId } = req.body;

    if (!name || !type || !code || typeof name !== "string" || typeof type !== "string" || typeof code !== "string") {
      return res.status(400).json({ message: "Name, type, and code are required strings for jurisdiction creation." });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Jurisdiction.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ message: `Jurisdiction code '${cleanCode}' already exists.` });
    }

    let parentJurisdiction = null;
    if (parentId) {
      parentJurisdiction = await Jurisdiction.findById(parentId);
      if (!parentJurisdiction) {
        return res.status(404).json({ message: "Specified parent jurisdiction not found." });
      }
    }

    const jurisdiction = await Jurisdiction.create({
      name: name.trim(),
      type: type.toUpperCase().trim(),
      code: cleanCode,
      parentId: parentJurisdiction ? parentJurisdiction._id : null,
    });

    await logAuditEvent({
      action: "JURISDICTION_CREATED",
      category: "AUDIT_EVENT",
      userId: req.user.id,
      userRole: "admin",
      status: "SUCCESS",
      details: { name: jurisdiction.name, type: jurisdiction.type, code: jurisdiction.code },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ message: "Jurisdiction created successfully", jurisdiction });
  } catch (err) {
    logger.error("Create jurisdiction error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to create jurisdiction" });
  }
};

exports.getJurisdictions = async (req, res) => {
  try {
    const { ensureDefaultJurisdictions } = require("../utils/jurisdictionUtils");
    await ensureDefaultJurisdictions();

    const jurisdictions = await Jurisdiction.find().populate("parentId", "name code type").sort({ type: 1, name: 1 }).lean();
    res.json(jurisdictions);
  } catch (err) {
    logger.error("Get jurisdictions error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to load jurisdictions" });
  }
};

// ================= ELECTION MANAGEMENT =================
exports.createElection = async (req, res) => {
  try {
    const {
      title,
      description,
      electionType,
      jurisdictionId,
      startDate,
      endDate,
      electionCode,
      publishLiveTally,
      configuration,
    } = req.body;

    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ message: "Election title is required" });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const dateValidation = validateElectionDates(start, end);
    if (!dateValidation.valid) {
      return res.status(400).json({ message: dateValidation.error });
    }

    // Resolve or fallback jurisdiction
    let assignedJurisdictionId = jurisdictionId;
    if (!assignedJurisdictionId) {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const { ensureDefaultJurisdictions } = require("../utils/jurisdictionUtils");
        await ensureDefaultJurisdictions();
        const defaultJurisdiction = await Jurisdiction.findOne({ type: "COUNTRY" });
        if (defaultJurisdiction) assignedJurisdictionId = defaultJurisdiction._id;
      }
    }

    const newElection = await Election.create({
      title: title.trim(),
      description: description ? description.trim() : "Standard electronic democratic election.",
      electionType: electionType || "NATIONAL",
      electionCode: electionCode ? electionCode.trim() : undefined,
      jurisdictionId: assignedJurisdictionId || null,
      phase: ELECTION_PHASES.DRAFT, // All elections strictly start in DRAFT state
      startDate: start,
      endDate: end,
      publishLiveTally: Boolean(publishLiveTally),
      configuration: configuration || {
        allowBiometricVerification: true,
        maxBallotChoices: 1,
        requireTwoPersonGovernance: true,
      },
      createdBy: req.user ? req.user.id : null,
      isDefault: false,
    });

    await logAuditEvent({
      action: "ELECTION_CREATED",
      category: "AUDIT_EVENT",
      userId: req.user.id,
      userRole: "admin",
      electionId: newElection._id,
      status: "SUCCESS",
      details: { title: newElection.title, phase: newElection.phase, type: newElection.electionType },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ message: "Election created successfully in DRAFT state", election: newElection });
  } catch (err) {
    logger.error("Create election error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to create election configuration" });
  }
};

exports.getElections = async (req, res) => {
  try {
    const { phase, type, jurisdictionId, search } = req.query;
    const filter = { status: { $ne: "INACTIVE" } };

    if (phase && phase !== "ALL") filter.phase = phase;
    if (type && type !== "ALL") filter.electionType = type;
    if (jurisdictionId) filter.jurisdictionId = jurisdictionId;
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { electionCode: { $regex: search.trim(), $options: "i" } },
      ];
    }

    let elections = await Election.find(filter)
      .populate("jurisdictionId", "name code type")
      .sort({ createdAt: -1 })
      .lean();

    if (elections.length === 0 && (!phase && !type && !search)) {
      // Initialize default active general election if none exist
      const { ensureDefaultJurisdictions } = require("../utils/jurisdictionUtils");
      await ensureDefaultJurisdictions();
      const defaultJurisdiction = await Jurisdiction.findOne({ type: "COUNTRY" });

      const defaultElection = await Election.create({
        title: "National General Election",
        description: "Official secure electronic ballot general election.",
        electionType: "NATIONAL",
        jurisdictionId: defaultJurisdiction ? defaultJurisdiction._id : null,
        phase: ELECTION_PHASES.VOTING,
        isDefault: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      elections = [defaultElection];
    }

    res.json(elections);
  } catch (err) {
    logger.error("Get elections error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to load election configurations" });
  }
};

exports.getElectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const election = await Election.findById(id).populate("jurisdictionId", "name code type").lean();
    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }

    // Query scoped election metrics
    const [votesCount, participationCount, registeredEligibleCount] = await Promise.all([
      AnonymousBallot.countDocuments({ electionId: election._id }),
      VoterParticipation.countDocuments({ electionId: election._id }),
      VoterEligibility.countDocuments({ electionId: election._id, status: "ELIGIBLE" }),
    ]);

    const totalVoters = registeredEligibleCount > 0 ? registeredEligibleCount : await Voter.countDocuments();
    const effectiveBallots = Math.max(votesCount, participationCount);
    const turnoutPct = totalVoters > 0 ? ((effectiveBallots / totalVoters) * 100).toFixed(1) : "0.0";

    res.json({
      election,
      metrics: {
        registeredVoters: totalVoters,
        votesCast: effectiveBallots,
        turnoutPercentage: `${turnoutPct}%`,
      },
    });
  } catch (err) {
    logger.error("Get election by ID error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to load election details" });
  }
};

exports.enrollVotersToElection = async (req, res) => {
  try {
    const { id } = req.params;
    const { voterIds, enrollAllRegistered } = req.body;

    const election = await Election.findById(id);
    if (!election) {
      return res.status(404).json({ message: "Target election not found" });
    }

    let targetVoters = [];
    if (enrollAllRegistered) {
      targetVoters = await Voter.find().select("_id").lean();
    } else if (Array.isArray(voterIds)) {
      targetVoters = voterIds.map(vid => ({ _id: vid }));
    }

    if (targetVoters.length === 0) {
      return res.status(400).json({ message: "No eligible voter IDs supplied for accreditation." });
    }

    const operations = targetVoters.map(v => ({
      updateOne: {
        filter: { voterId: v._id, electionId: election._id },
        update: {
          $set: {
            voterId: v._id,
            electionId: election._id,
            jurisdictionId: election.jurisdictionId || null,
            status: "ELIGIBLE",
            assignedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const bulkResult = await VoterEligibility.bulkWrite(operations);

    await logAuditEvent({
      action: "ELECTION_VOTERS_ENROLLED",
      category: "AUDIT_EVENT",
      userId: req.user.id,
      userRole: "admin",
      electionId: election._id,
      status: "SUCCESS",
      details: { enrolledCount: targetVoters.length },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      message: `Successfully accredited ${targetVoters.length} citizen voters for ${election.title}.`,
      result: bulkResult,
    });
  } catch (err) {
    logger.error("Enroll voters error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to enroll voters for election" });
  }
};

exports.updateElectionPhase = async (req, res) => {
  try {
    const { electionId, phase } = req.body;

    if (!phase || typeof phase !== "string") {
      return res.status(400).json({ message: "Target election phase is required" });
    }

    const election = await Election.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: "Election not found" });
    }

    const transitionCheck = validatePhaseTransition(election.phase, phase);
    if (!transitionCheck.valid) {
      return res.status(400).json({ message: transitionCheck.error });
    }

    if (phase === ELECTION_PHASES.RESULTS_PUBLISHED && election.phase !== ELECTION_PHASES.CLOSED) {
      return res.status(400).json({
        message: "Results can only be published once the election has been officially CLOSED.",
      });
    }

    election.phase = phase;
    if (phase === ELECTION_PHASES.RESULTS_PUBLISHED) {
      election.resultsPublishedAt = new Date();
    }
    await election.save();

    await logAuditEvent({
      action: `ELECTION_PHASE_TRANSITION_${phase}`,
      category: "AUDIT_EVENT",
      userId: req.user.id,
      userRole: "admin",
      electionId: election._id,
      status: "SUCCESS",
      details: { previousPhase: election.phase, newPhase: phase },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("electionPhaseUpdated", {
        electionId: election._id,
        phase: election.phase,
        title: election.title,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ message: `Election phase updated to ${phase}`, election });
  } catch (err) {
    logger.error("Update election phase error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to update election phase" });
  }
};

// ================= AUDIT LOG INSPECTOR =================
exports.getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
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
    logger.error("Get audit logs error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to retrieve audit log records" });
  }
};

exports.verifyAuditChainEndpoint = async (req, res) => {
  try {
    const { verifyAuditChain } = require("../utils/auditUtils");
    const result = await verifyAuditChain();
    res.json(result);
  } catch (err) {
    logger.error("Verify audit chain error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to verify cryptographic audit chain" });
  }
};

