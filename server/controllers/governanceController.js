/**
 * ==============================================================================
 * SECURE E-VOTING SYSTEM — ELECTION GOVERNANCE & MULTI-ADMIN CONTROLLER
 * ==============================================================================
 * Enforces Two-Person Rules (Separation of Duties), Self-Approval Rejection,
 * Replay Protections, and Atomic Operational Governance on Sensitive State Changes.
 * ==============================================================================
 */

const { ElectionApproval, APPROVAL_ACTIONS, APPROVAL_STATUS } = require("../models/ElectionApproval");
const Election = require("../models/Election");
const Admin = require("../models/Admin");
const { validatePhaseTransition, ELECTION_PHASES } = require("../utils/electionEngine");
const { logAuditEvent } = require("../utils/auditUtils");
const logger = require("../utils/logger");

const ACTION_TO_PHASE_MAP = Object.freeze({
  [APPROVAL_ACTIONS.OPEN_VOTING]: ELECTION_PHASES.VOTING,
  [APPROVAL_ACTIONS.CLOSE_VOTING]: ELECTION_PHASES.CLOSED,
  [APPROVAL_ACTIONS.PUBLISH_RESULTS]: ELECTION_PHASES.RESULTS_PUBLISHED,
  [APPROVAL_ACTIONS.ARCHIVE_ELECTION]: ELECTION_PHASES.ARCHIVED,
});

// ================= CREATE GOVERNANCE PROPOSAL (ADMIN A) =================
exports.createProposal = async (req, res) => {
  try {
    const { electionId, action, reason, metadata } = req.body;

    if (!electionId || !action) {
      return res.status(400).json({ message: "electionId and action are required" });
    }

    if (!Object.values(APPROVAL_ACTIONS).includes(action)) {
      return res.status(400).json({
        message: `Invalid action '${action}'. Permissible actions: ${Object.values(APPROVAL_ACTIONS).join(", ")}`,
      });
    }

    const election = await Election.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: "Election slate not found" });
    }

    const targetPhase = ACTION_TO_PHASE_MAP[action] || null;

    // Validate state transition if the action implies a phase change
    if (targetPhase) {
      const transitionCheck = validatePhaseTransition(election.phase, targetPhase);
      if (!transitionCheck.valid) {
        return res.status(400).json({ message: transitionCheck.error });
      }

      if (action === APPROVAL_ACTIONS.PUBLISH_RESULTS && election.phase !== ELECTION_PHASES.CLOSED) {
        return res.status(400).json({
          message: "Results can only be published once the election has been officially CLOSED.",
        });
      }
    }

    // Check for existing pending proposal for same action on this election
    const existingPending = await ElectionApproval.findOne({
      electionId: election._id,
      action,
      status: APPROVAL_STATUS.PENDING,
    });

    if (existingPending) {
      return res.status(400).json({
        message: `A pending proposal for action '${action}' is already awaiting administrator review.`,
      });
    }

    const proposal = await ElectionApproval.create({
      electionId: election._id,
      action,
      targetPhase,
      requestedBy: req.user.id,
      requestedByUsername: req.user.username || "Admin",
      reason: reason ? String(reason).trim() : "Standard operational governance proposal.",
      metadata: metadata || {},
      status: APPROVAL_STATUS.PENDING,
    });

    await logAuditEvent({
      action: "ELECTION_ACTION_PROPOSED",
      category: "AUDIT_EVENT",
      userId: req.user.id,
      userRole: req.user.role || "admin",
      electionId: election._id,
      status: "SUCCESS",
      details: {
        proposalId: proposal._id,
        action,
        targetPhase,
        currentPhase: election.phase,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("governanceProposalCreated", {
        proposalId: proposal._id,
        action: proposal.action,
        electionId: election._id,
        requestedBy: proposal.requestedByUsername,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(201).json({
      message: `Proposal to '${action}' successfully submitted. Awaiting secondary administrator authorization.`,
      proposal,
    });
  } catch (err) {
    logger.error("Create proposal error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to submit governance proposal" });
  }
};

// ================= LIST GOVERNANCE PROPOSALS =================
exports.getProposals = async (req, res) => {
  try {
    const { electionId, status } = req.query;
    const filter = {};

    if (electionId) filter.electionId = electionId;
    if (status) filter.status = status;

    const proposals = await ElectionApproval.find(filter)
      .populate("electionId", "title phase startDate endDate")
      .sort({ createdAt: -1 })
      .lean();

    res.json(proposals);
  } catch (err) {
    logger.error("Get proposals error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to load governance proposals" });
  }
};

// ================= APPROVE & ATOMICALLY EXECUTE PROPOSAL (ADMIN B) =================
exports.approveProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await ElectionApproval.findById(id);
    if (!proposal) {
      return res.status(404).json({ message: "Governance proposal not found" });
    }

    // 1. REPLAY & STATUS PROTECTION: Only PENDING proposals can be approved
    if (proposal.status !== APPROVAL_STATUS.PENDING) {
      return res.status(400).json({
        message: `Approval replay blocked: Proposal has status '${proposal.status}' and cannot be re-executed.`,
      });
    }

    // 2. EXPIRY CHECK
    if (proposal.expiresAt && new Date() > new Date(proposal.expiresAt)) {
      proposal.status = APPROVAL_STATUS.EXPIRED;
      await proposal.save();
      return res.status(400).json({ message: "Governance proposal has expired." });
    }

    // 3. SERVER-SIDE SELF-APPROVAL PREVENTION (SEPARATION OF DUTIES)
    if (proposal.requestedBy.toString() === req.user.id.toString()) {
      await logAuditEvent({
        action: "SELF_APPROVAL_ATTEMPT_BLOCKED",
        category: "SECURITY_EVENT",
        userId: req.user.id,
        userRole: req.user.role || "admin",
        electionId: proposal.electionId,
        status: "DENIED",
        details: { proposalId: proposal._id, action: proposal.action },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return res.status(403).json({
        message: "Separation of duties violation: An administrator cannot approve their own election proposal.",
      });
    }

    // 4. VALIDATE ELECTION STATE BEFORE ATOMIC EXECUTION
    const election = await Election.findById(proposal.electionId);
    if (!election) {
      return res.status(404).json({ message: "Target election slate no longer exists." });
    }

    if (proposal.targetPhase) {
      if (proposal.action === APPROVAL_ACTIONS.PUBLISH_RESULTS && election.phase !== ELECTION_PHASES.CLOSED) {
        return res.status(400).json({
          message: "Results cannot be published because election is not in CLOSED phase.",
        });
      }

      const transitionCheck = validatePhaseTransition(election.phase, proposal.targetPhase);
      if (!transitionCheck.valid) {
        return res.status(400).json({
          message: `Execution blocked: ${transitionCheck.error}`,
        });
      }

      election.phase = proposal.targetPhase;
      if (proposal.targetPhase === ELECTION_PHASES.RESULTS_PUBLISHED) {
        election.resultsPublishedAt = new Date();
      }
      await election.save();
    }

    // 5. ATOMICALLY MARK PROPOSAL AS EXECUTED
    proposal.status = APPROVAL_STATUS.EXECUTED;
    proposal.approvedBy = req.user.id;
    proposal.approvedByUsername = req.user.username || "Admin B";
    proposal.approvedAt = new Date();
    proposal.executedAt = new Date();
    await proposal.save();

    // 6. CHAINED AUDIT LOGGING (Zero voter-ballot correlation)
    await logAuditEvent({
      action: `ELECTION_ACTION_APPROVED_${proposal.action}`,
      category: "AUDIT_EVENT",
      userId: req.user.id,
      userRole: req.user.role || "admin",
      electionId: election._id,
      status: "SUCCESS",
      details: {
        proposalId: proposal._id,
        action: proposal.action,
        requestedBy: proposal.requestedByUsername,
        approvedBy: proposal.approvedByUsername,
        newPhase: election.phase,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("governanceProposalResolved", {
        proposalId: proposal._id,
        status: APPROVAL_STATUS.EXECUTED,
        action: proposal.action,
        electionId: election._id,
      });
      io.emit("electionPhaseUpdated", {
        electionId: election._id,
        phase: election.phase,
        title: election.title,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      message: `Governance proposal '${proposal.action}' authorized by dual-admin approval and successfully executed.`,
      proposal,
      election,
    });
  } catch (err) {
    logger.error("Approve proposal error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to authorize and execute governance proposal" });
  }
};

// ================= REJECT PROPOSAL =================
exports.rejectProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const proposal = await ElectionApproval.findById(id);
    if (!proposal) {
      return res.status(404).json({ message: "Governance proposal not found" });
    }

    if (proposal.status !== APPROVAL_STATUS.PENDING) {
      return res.status(400).json({
        message: `Cannot reject proposal with status '${proposal.status}'. Only PENDING requests may be rejected.`,
      });
    }

    proposal.status = APPROVAL_STATUS.REJECTED;
    proposal.rejectionReason = reason ? String(reason).trim() : "Rejected during peer administrative review.";
    proposal.approvedBy = req.user.id;
    proposal.approvedByUsername = req.user.username || "Admin";
    proposal.approvedAt = new Date();
    await proposal.save();

    await logAuditEvent({
      action: `ELECTION_ACTION_REJECTED_${proposal.action}`,
      category: "AUDIT_EVENT",
      userId: req.user.id,
      userRole: req.user.role || "admin",
      electionId: proposal.electionId,
      status: "SUCCESS",
      details: {
        proposalId: proposal._id,
        action: proposal.action,
        reason: proposal.rejectionReason,
        rejectedBy: proposal.approvedByUsername,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("governanceProposalResolved", {
        proposalId: proposal._id,
        status: APPROVAL_STATUS.REJECTED,
        action: proposal.action,
      });
    }

    res.json({
      message: `Governance proposal '${proposal.action}' rejected.`,
      proposal,
    });
  } catch (err) {
    logger.error("Reject proposal error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to reject governance proposal" });
  }
};

// ================= GOVERNANCE SUMMARY =================
exports.getGovernanceSummary = async (req, res) => {
  try {
    const [total, pending, executed, rejected] = await Promise.all([
      ElectionApproval.countDocuments(),
      ElectionApproval.countDocuments({ status: APPROVAL_STATUS.PENDING }),
      ElectionApproval.countDocuments({ status: APPROVAL_STATUS.EXECUTED }),
      ElectionApproval.countDocuments({ status: APPROVAL_STATUS.REJECTED }),
    ]);

    const recentPending = await ElectionApproval.find({ status: APPROVAL_STATUS.PENDING })
      .populate("electionId", "title phase")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      total,
      pending,
      executed,
      rejected,
      recentPending,
    });
  } catch (err) {
    logger.error("Governance summary error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to load governance summary" });
  }
};
