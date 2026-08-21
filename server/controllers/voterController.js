const crypto = require("crypto");
const mongoose = require("mongoose");
const Vote = require("../models/Vote");
const Voter = require("../models/Voter");
const Party = require("../models/Party");
const Election = require("../models/Election");
const AnonymousBallot = require("../models/AnonymousBallot");
const VoterParticipation = require("../models/VoterParticipation");
const BiometricToken = require("../models/BiometricToken");
const VoterEligibility = require("../models/VoterEligibility");
const { euclideanDistance } = require("../utils/faceUtils");
const { logAuditEvent } = require("../utils/auditUtils");
const { isVotingAllowed, ELECTION_PHASES } = require("../utils/electionEngine");
const { getBiometricProvider } = require("../utils/biometricProvider");
const { checkVoterEligibility, getVoterEligibleElections } = require("../utils/eligibilityEngine");
const logger = require("../utils/logger");

// Helper to safely format ID for MongoDB queries without throwing on mock strings
function safeId(id) {
  if (!id) return id;
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

// ================= GET ELIGIBLE ELECTIONS =================
exports.getElections = async (req, res) => {
  try {
    const voterId = req.user.id;
    const elections = await getVoterEligibleElections(voterId);
    res.json(elections);
  } catch (err) {
    logger.error("Get voter elections error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to retrieve eligible elections list" });
  }
};

// ================= GET VOTER PROFILE =================
exports.getProfile = async (req, res) => {
  try {
    const voterId = req.user.id;

    const voter = await Voter.findById(voterId).select("-password -faceDescriptor").lean();
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Retrieve all eligible elections for this voter
    const eligibleElections = await getVoterEligibleElections(voterId);

    // Active election metadata (default to the first active voting election or primary default)
    const activeVotingElection =
      eligibleElections.find((e) => e.phase === ELECTION_PHASES.VOTING && !e.hasVoted) ||
      eligibleElections.find((e) => e.phase === ELECTION_PHASES.VOTING) ||
      eligibleElections[0] ||
      null;

    const [participationExists, legacyVoteExists] = await Promise.all([
      VoterParticipation.exists({ voterId: safeId(voterId) }),
      Vote.exists({ voterId: safeId(voterId) }),
    ]);

    voter.hasVoted = Boolean(participationExists || legacyVoteExists);
    voter.election = activeVotingElection;
    voter.eligibleElectionsCount = eligibleElections.length;

    res.json(voter);
  } catch (err) {
    logger.error("Get profile error: " + err.message, { requestId: req.id, method: "GET", path: "/api/voter/profile" });
    res.status(500).json({ message: "Failed to retrieve voter profile" });
  }
};

// ================= FACE VERIFICATION =================
exports.faceVerify = async (req, res) => {
  try {
    const voterId = req.user.id;
    const { descriptor, electionId, faceDescriptor } = req.body;
    const rawDescriptor = descriptor || faceDescriptor;

    if (!rawDescriptor || !Array.isArray(rawDescriptor) || rawDescriptor.length !== 128) {
      return res.status(400).json({ message: "Invalid biometric descriptor format" });
    }

    const voter = await Voter.findById(voterId);
    if (!voter || !voter.faceDescriptor || voter.faceDescriptor.length === 0) {
      return res.status(400).json({ message: "No facial biometric data registered on file" });
    }

    // 1. Resolve Target Election
    let election = null;
    if (electionId) {
      election = await Election.findById(electionId);
    }
    if (!election) {
      election = (await Election.findOne({ phase: ELECTION_PHASES.VOTING })) || (await Election.findOne({ isDefault: true }));
    }

    // 2. Server-Side Eligibility Enforcement
    if (election) {
      const eligibility = await checkVoterEligibility(voter._id || voterId, election._id);
      if (!eligibility.eligible) {
        await logAuditEvent({
          action: "VOTER_INELIGIBLE_ACCESS_ATTEMPT",
          category: "SECURITY_EVENT",
          userId: voter._id || voterId,
          userRole: "voter",
          electionId: election._id,
          status: "DENIED",
          details: { reason: eligibility.reason },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
        return res.status(403).json({ message: eligibility.reason || "You are not accredited for this election." });
      }

      // 3. Voting Window Enforcement
      const windowCheck = isVotingAllowed(election);
      if (!windowCheck.allowed) {
        return res.status(400).json({ message: windowCheck.reason });
      }
    }

    // 4. Double-Voting Prevention Scoped to THIS Specific Election
    const [participationExists, legacyVoteExists] = await Promise.all([
      VoterParticipation.exists({
        voterId: safeId(voter._id || voterId),
        ...(election ? { electionId: election._id } : {}),
      }),
      Vote.exists({ voterId: safeId(voter._id || voterId) }),
    ]);

    if (participationExists || legacyVoteExists) {
      return res.status(400).json({ message: "Voter has already cast a ballot in this election" });
    }

    // 5. Biometric Comparison
    const provider = getBiometricProvider("face");
    const result = await provider.verify(voter.faceDescriptor, rawDescriptor);

    if (result.verified) {
      const randomSecret = crypto.randomBytes(32).toString("hex");
      const biometricToken = await BiometricToken.create({
        token: randomSecret,
        voterId: voter._id || voterId,
        electionId: election ? election._id : (electionId || null),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await logAuditEvent({
        action: "BIOMETRIC_VERIFICATION_SUCCESS",
        category: "AUDIT_EVENT",
        userId: voter._id || voterId,
        userRole: "voter",
        electionId: election ? election._id : null,
        status: "SUCCESS",
        details: { distance: result.score },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        verified: true,
        biometricToken: biometricToken.token,
        electionId: election ? election._id : null,
        distance: result.score,
        message: "Biometric identity verified successfully. Authorization token issued.",
      });
    } else {
      await logAuditEvent({
        action: "BIOMETRIC_VERIFICATION_FAILED_MISMATCH",
        category: "SECURITY_EVENT",
        userId: voter._id || voterId,
        userRole: "voter",
        electionId: election ? election._id : null,
        status: "DENIED",
        details: { distance: result.score, threshold: result.threshold },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(400).json({ message: "Facial biometric verification failed (mismatch)", distance: result.score });
    }
  } catch (err) {
    logger.error("Face verify error: " + err.message, { requestId: req.id, method: "POST", path: "/api/voter/face-verify" });
    res.status(500).json({ message: "Biometric verification service error" });
  }
};

// ================= CAST VOTE =================
exports.castVote = async (req, res) => {
  try {
    const voterId = req.user.id;
    const { partyId, candidateId, biometricToken, electionId } = req.body;

    if (!partyId) {
      return res.status(400).json({ message: "Political party selection is required" });
    }

    // 1. Verify Voter existence
    const voter = await Voter.findById(voterId);
    if (!voter) {
      return res.status(404).json({ message: "Voter record not found" });
    }

    // 2. Validate Selected Party
    const party = await Party.findById(partyId);
    if (!party) {
      return res.status(404).json({ message: "Selected political party is invalid or does not exist" });
    }

    // 3. Resolve Target Election
    let election = null;
    if (electionId) {
      election = await Election.findById(electionId);
    }
    if (!election) {
      election = (await Election.findOne({ phase: ELECTION_PHASES.VOTING })) || (await Election.findOne({ isDefault: true }));
      if (!election) {
        election = await Election.findOne().sort({ createdAt: -1 });
      }
    }

    if (!election) {
      return res.status(404).json({ message: "No active voting election found." });
    }

    // 4. Server-Side Eligibility Enforcement
    const eligibility = await checkVoterEligibility(voterId, election._id);
    if (!eligibility.eligible) {
      await logAuditEvent({
        action: "VOTER_INELIGIBLE_BALLOT_BLOCKED",
        category: "SECURITY_EVENT",
        userId: voterId,
        userRole: "voter",
        electionId: election._id,
        status: "DENIED",
        details: { reason: eligibility.reason },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(403).json({ message: eligibility.reason || "You are not accredited to vote in this election." });
    }

    // 5. Voting Window Enforcement
    const windowCheck = isVotingAllowed(election);
    if (!windowCheck.allowed) {
      return res.status(400).json({ message: windowCheck.reason });
    }

    // 6. Double-Voting Prevention Scoped to THIS Specific Election
    const [alreadyParticipated, legacyVoteExists] = await Promise.all([
      VoterParticipation.exists({
        voterId: safeId(voterId),
        electionId: election._id,
      }),
      Vote.exists({ voterId: safeId(voterId) }),
    ]);

    if (alreadyParticipated || (election.isDefault && legacyVoteExists)) {
      await logAuditEvent({
        action: "DUPLICATE_VOTE_ATTEMPT_BLOCKED",
        category: "SECURITY_EVENT",
        userId: voterId,
        userRole: "voter",
        electionId: election._id,
        status: "DENIED",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(400).json({ message: "You have already voted in this election." });
    }

    // 7. Mandatory Biometric Authorization Token Validation & Single-Use Consumption
    if (!biometricToken || typeof biometricToken !== "string" || biometricToken.trim() === "") {
      return res.status(400).json({ message: "Biometric authorization token is required to cast a ballot" });
    }

    const tokenQuery = {
      token: biometricToken.trim(),
      voterId: safeId(voterId),
      used: false,
      expiresAt: { $gt: new Date() },
    };

    const consumedToken = await BiometricToken.findOneAndDelete(tokenQuery);

    if (!consumedToken) {
      return res.status(400).json({ message: "Invalid, expired, or previously consumed biometric authorization token. Please scan face again." });
    }

    // Cross-Election Biometric Poisoning Defense
    if (consumedToken.electionId && election._id && consumedToken.electionId.toString() !== election._id.toString()) {
      await logAuditEvent({
        action: "CROSS_ELECTION_TOKEN_HIJACK_BLOCKED",
        category: "SECURITY_EVENT",
        userId: voterId,
        userRole: "voter",
        electionId: election._id,
        status: "DENIED",
        details: { tokenElectionId: consumedToken.electionId, targetElectionId: election._id },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return res.status(403).json({ message: "Biometric authorization token belongs to a different election." });
    }

    // 8. Generate Decoupled Cryptographic Commitment Hash for Ballot
    const serialNonce = crypto.randomBytes(24).toString("hex");
    const ballotCommitmentHash = crypto
      .createHash("sha256")
      .update(`${serialNonce}|${election._id}|${partyId}`)
      .digest("hex");

    // 9. Insert Decoupled Participation Record & Anonymous Ballot with atomic rollback resilience
    const coarseTimestamp = new Date(Math.floor(Date.now() / 3600000) * 3600000);
    let participationRecord = null;

    try {
      participationRecord = await VoterParticipation.create({
        voterId: safeId(voterId),
        electionId: election._id,
        participatedAt: coarseTimestamp,
        verificationMethod: "FACE_BIOMETRIC",
      });

      // 10. Insert Anonymous Ballot with cryptographically random UUID primary key (ZERO voter identity & NO millisecond timing)
      await AnonymousBallot.create({
        _id: crypto.randomUUID(),
        electionId: election._id,
        partyId: safeId(partyId),
        candidateId: candidateId ? safeId(candidateId) : null,
        ballotCommitmentHash,
      });
    } catch (ballotErr) {
      if (participationRecord && participationRecord._id) {
        await VoterParticipation.findByIdAndDelete(participationRecord._id).catch(() => {});
      }
      throw ballotErr;
    }

    // 11. Chained Audit Logging
    await logAuditEvent({
      action: "BALLOT_CAST_SUCCESS",
      category: "AUDIT_EVENT",
      userId: voterId,
      userRole: "voter",
      electionId: election._id,
      status: "SUCCESS",
      details: {
        verificationMethod: "FACE_BIOMETRIC",
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // 12. Real-Time Broadcast
    const io = req.app ? req.app.get("io") : null;
    if (io) {
      io.emit("newVote", {
        type: "vote-update",
        electionId: election._id,
      });
    }

    res.status(200).json({
      message: "Vote cast successfully!",
      receipt: {
        electionId: election._id,
        ballotCommitment: ballotCommitmentHash,
        ballotCommitmentHash: ballotCommitmentHash,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Vote already recorded for this election" });
    }
    logger.error("Cast vote error: " + err.message, { requestId: req.id, method: "POST", path: "/api/voter/vote" });
    res.status(500).json({ message: "Failed to process voting transaction" });
  }
};
