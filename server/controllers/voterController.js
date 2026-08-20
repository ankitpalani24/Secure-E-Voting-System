const crypto = require("crypto");
const mongoose = require("mongoose");
const Vote = require("../models/Vote");
const Voter = require("../models/Voter");
const Party = require("../models/Party");
const Election = require("../models/Election");
const AnonymousBallot = require("../models/AnonymousBallot");
const VoterParticipation = require("../models/VoterParticipation");
const BiometricToken = require("../models/BiometricToken");
const { euclideanDistance } = require("../utils/faceUtils");
const { logAuditEvent } = require("../utils/auditUtils");
const { isVotingAllowed, ELECTION_PHASES } = require("../utils/electionEngine");
const { getBiometricProvider } = require("../utils/biometricProvider");
const logger = require("../utils/logger");

// ================= GET VOTER PROFILE =================
exports.getProfile = async (req, res) => {
  try {
    const voterId = req.user.id;

    const voter = await Voter.findById(voterId).select("-password -faceDescriptor").lean();
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Active election metadata
    let election = null;
    try {
      const q = Election.findOne({ isDefault: true });
      election = q && typeof q.lean === "function" ? await q.lean() : await q;
      if (!election) {
        const q2 = Election.findOne({ phase: ELECTION_PHASES.VOTING });
        election = q2 && typeof q2.lean === "function" ? await q2.lean() : await q2;
      }
    } catch (e) {
      election = null;
    }

    // Single source of truth for vote status across both decoupled and legacy records
    const [participationExists, legacyVoteExists] = await Promise.all([
      VoterParticipation.exists({ voterId: new mongoose.Types.ObjectId(voterId) }),
      Vote.exists({ voterId: new mongoose.Types.ObjectId(voterId) }),
    ]);

    voter.hasVoted = Boolean(participationExists || legacyVoteExists);
    voter.election = election
      ? {
          _id: election._id,
          title: election.title,
          phase: election.phase,
          startDate: election.startDate,
          endDate: election.endDate,
          publishLiveTally: election.publishLiveTally,
        }
      : null;

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
    const { descriptor, electionId } = req.body;

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ message: "Invalid biometric descriptor format" });
    }

    const voter = await Voter.findById(voterId);
    if (!voter || !voter.faceDescriptor || voter.faceDescriptor.length === 0) {
      return res.status(400).json({ message: "No facial biometric data registered on file" });
    }

    // Look up election and enforce voting window
    let election = null;
    if (electionId) {
      election = await Election.findById(electionId);
    }
    if (!election) {
      election = await Election.findOne({ phase: ELECTION_PHASES.VOTING }) || await Election.findOne({ isDefault: true });
    }

    if (election) {
      const windowCheck = isVotingAllowed(election);
      if (!windowCheck.allowed) {
        return res.status(400).json({ message: windowCheck.reason });
      }
    }

    // Check if voter has already participated
    const [participationExists, legacyVoteExists] = await Promise.all([
      VoterParticipation.exists({ voterId: voter._id }),
      Vote.exists({ voterId: voter._id }),
    ]);

    if (participationExists || legacyVoteExists) {
      return res.status(400).json({ message: "Voter has already cast a ballot in this election" });
    }

    // Use BiometricProvider abstraction
    const provider = getBiometricProvider("face");
    const result = await provider.verify(voter.faceDescriptor, descriptor);

    if (result.verified) {
      // Generate a single-use cryptographically random token valid for 5 minutes
      const randomSecret = crypto.randomBytes(32).toString("hex");
      const biometricToken = await BiometricToken.create({
        token: randomSecret,
        voterId: voter._id,
        electionId: election ? election._id : (electionId || null),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await logAuditEvent({
        action: "BIOMETRIC_VERIFICATION_SUCCESS",
        category: "AUDIT_EVENT",
        userId: voter._id,
        userRole: "voter",
        status: "SUCCESS",
        details: { distance: result.score },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        verified: true,
        biometricToken: biometricToken.token,
        distance: result.score,
        message: "Biometric identity verified successfully. Authorization token issued.",
      });
    } else {
      await logAuditEvent({
        action: "BIOMETRIC_VERIFICATION_FAILED_MISMATCH",
        category: "SECURITY_EVENT",
        userId: voter._id,
        userRole: "voter",
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
    const { partyId, candidateId, biometricToken } = req.body;

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

    // 3. Find Active Election
    let election = await Election.findOne({ phase: ELECTION_PHASES.VOTING });
    if (!election) {
      // Auto-fallback/create default voting election if first run
      election = await Election.findOne({ isDefault: true });
      if (!election) {
        election = await Election.create({
          title: "General Election",
          phase: ELECTION_PHASES.VOTING,
          isDefault: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }
    }

    const windowCheck = isVotingAllowed(election);
    if (!windowCheck.allowed) {
      return res.status(400).json({ message: windowCheck.reason });
    }

    // 4. Verify Double-Voting Prevention (both decoupled and legacy)
    const [alreadyParticipated, legacyVoteExists] = await Promise.all([
      VoterParticipation.exists({ voterId, electionId: election._id }),
      Vote.exists({ voterId: new mongoose.Types.ObjectId(voterId) }),
    ]);

    if (alreadyParticipated || legacyVoteExists) {
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

    // 5. Mandatory Biometric Authorization Token Validation & Single-Use Consumption
    if (!biometricToken || typeof biometricToken !== "string" || biometricToken.trim() === "") {
      return res.status(400).json({ message: "Biometric authorization token is required to cast a ballot" });
    }

    const consumedToken = await BiometricToken.findOneAndDelete({
      token: biometricToken.trim(),
      voterId: new mongoose.Types.ObjectId(voterId),
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!consumedToken) {
      return res.status(400).json({ message: "Invalid, expired, or previously consumed biometric authorization token. Please scan face again." });
    }

    // 6. Generate Decoupled Cryptographic Commitment Hash for Ballot
    const serialNonce = crypto.randomBytes(24).toString("hex");
    const ballotCommitmentHash = crypto
      .createHash("sha256")
      .update(`${serialNonce}|${election._id}|${partyId}`)
      .digest("hex");

    // 7. Insert Decoupled Participation Record & Anonymous Ballot with atomic rollback resilience
    const coarseTimestamp = new Date(Math.floor(Date.now() / 3600000) * 3600000);
    let participationRecord = null;

    try {
      participationRecord = await VoterParticipation.create({
        voterId,
        electionId: election._id,
        participatedAt: coarseTimestamp,
        verificationMethod: "FACE_BIOMETRIC",
      });

      // 8. Insert Anonymous Ballot with cryptographically random UUID primary key (ZERO voter identity & NO millisecond timing)
      await AnonymousBallot.create({
        _id: crypto.randomUUID(),
        electionId: election._id,
        partyId,
        candidateId: candidateId || null,
        ballotCommitmentHash,
      });
    } catch (ballotErr) {
      // If ballot insertion fails after participation record was created, roll back participation record to prevent permanent voter lockout
      if (participationRecord && participationRecord._id) {
        await VoterParticipation.findByIdAndDelete(participationRecord._id).catch(() => {});
      }
      throw ballotErr;
    }

    // 9. Chained Audit Logging (NEVER records partyId, candidateId, or ballotCommitmentHash to eliminate database correlation)
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

    // 10. Real-Time Broadcast: Sanitized event without partyId, voterId, candidateId, or individual choices
    const io = req.app.get("io");
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
