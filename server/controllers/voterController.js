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

// ================= GET VOTER PROFILE =================
exports.getProfile = async (req, res) => {
  try {
    const voterId = req.user.id;

    const voter = await Voter.findById(voterId).select("-password -faceDescriptor").lean();
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Single source of truth for vote status across both decoupled and legacy records
    const [participationExists, legacyVoteExists] = await Promise.all([
      VoterParticipation.exists({ voterId: new mongoose.Types.ObjectId(voterId) }),
      Vote.exists({ voterId: new mongoose.Types.ObjectId(voterId) }),
    ]);

    voter.hasVoted = Boolean(participationExists || legacyVoteExists);

    res.json(voter);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: err.message });
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

    // Check if voter has already participated
    const [participationExists, legacyVoteExists] = await Promise.all([
      VoterParticipation.exists({ voterId: voter._id }),
      Vote.exists({ voterId: voter._id }),
    ]);

    if (participationExists || legacyVoteExists) {
      return res.status(400).json({ message: "Voter has already cast a ballot in this election" });
    }

    const distance = euclideanDistance(descriptor, voter.faceDescriptor);

    // Euclidean distance threshold for 128-d face embeddings
    if (distance < 0.55) {
      // Generate a single-use cryptographically random token valid for 5 minutes
      const randomSecret = crypto.randomBytes(32).toString("hex");
      const biometricToken = await BiometricToken.create({
        token: randomSecret,
        voterId: voter._id,
        electionId: electionId || null,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await logAuditEvent({
        action: "BIOMETRIC_VERIFICATION_SUCCESS",
        category: "AUDIT_EVENT",
        userId: voter._id,
        userRole: "voter",
        status: "SUCCESS",
        details: { distance },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        verified: true,
        biometricToken: biometricToken.token,
        distance,
        message: "Biometric identity verified successfully. Authorization token issued.",
      });
    } else {
      await logAuditEvent({
        action: "BIOMETRIC_VERIFICATION_FAILED_MISMATCH",
        category: "SECURITY_EVENT",
        userId: voter._id,
        userRole: "voter",
        status: "DENIED",
        details: { distance, threshold: 0.55 },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(400).json({ message: "Facial biometric verification failed (mismatch)", distance });
    }
  } catch (err) {
    console.error("Face verify error:", err);
    res.status(500).json({ message: err.message });
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
    let election = await Election.findOne({ phase: "VOTING" });
    if (!election) {
      // Auto-fallback/create default voting election if first run
      election = await Election.findOne({ isDefault: true });
      if (!election) {
        election = await Election.create({
          title: "General Election",
          phase: "VOTING",
          isDefault: true,
        });
      }
    }

    if (election.phase !== "VOTING") {
      return res.status(400).json({ message: `Voting is currently closed for this election (Phase: ${election.phase})` });
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
    console.error("Cast vote error:", err);
    res.status(500).json({ message: err.message || "Failed to process voting transaction" });
  }
};
