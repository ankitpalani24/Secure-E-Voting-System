const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Mock dependencies
jest.mock("../../models/Admin");
jest.mock("../../models/Voter");
jest.mock("../../models/Party");
jest.mock("../../models/Election");
jest.mock("../../models/ElectionApproval");
jest.mock("../../models/AuditLog");
jest.mock("../../utils/auditUtils");

const Admin = require("../../models/Admin");
const Voter = require("../../models/Voter");
const Party = require("../../models/Party");
const Election = require("../../models/Election");
const { ElectionApproval, APPROVAL_ACTIONS, APPROVAL_STATUS } = require("../../models/ElectionApproval");

const adminRoutes = require("../../routes/adminRoutes");
const authRoutes = require("../../routes/authRoutes");
const requestIdMiddleware = require("../../middleware/requestId");
const errorHandler = require("../../middleware/errorHandler");
const { ELECTION_PHASES } = require("../../utils/electionEngine");

const JWT_SECRET = "governance_security_testing_secret_key_32chars!";
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(requestIdMiddleware);
app.use(express.json());
const mockIo = { emit: jest.fn() };
app.set("io", mockIo);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use(errorHandler);

describe("PHASE 12: Election Governance, Multi-Admin Approvals & Operational Audit Suite", () => {
  const adminAId = new mongoose.Types.ObjectId().toString();
  const adminBId = new mongoose.Types.ObjectId().toString();
  const auditorId = new mongoose.Types.ObjectId().toString();
  const voterId = new mongoose.Types.ObjectId().toString();
  const partyId = new mongoose.Types.ObjectId().toString();
  const electionId = new mongoose.Types.ObjectId().toString();
  const proposalId = new mongoose.Types.ObjectId().toString();

  const tokenAdminA = jwt.sign({ id: adminAId, role: "ELECTION_ADMIN", username: "AdminA" }, JWT_SECRET, { expiresIn: "1h" });
  const tokenAdminB = jwt.sign({ id: adminBId, role: "ELECTION_ADMIN", username: "AdminB" }, JWT_SECRET, { expiresIn: "1h" });
  const tokenSuperAdmin = jwt.sign({ id: adminAId, role: "SUPER_ADMIN", username: "SuperAdmin" }, JWT_SECRET, { expiresIn: "1h" });
  const tokenAuditor = jwt.sign({ id: auditorId, role: "AUDITOR", username: "AuditorOfficer" }, JWT_SECRET, { expiresIn: "1h" });
  const tokenVoter = jwt.sign({ id: voterId, role: "voter" }, JWT_SECRET, { expiresIn: "1h" });
  const tokenParty = jwt.sign({ id: partyId, role: "party" }, JWT_SECRET, { expiresIn: "1h" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Administrative RBAC & Role Separation", () => {
    it("denies Voter from creating a governance proposal", async () => {
      const res = await request(app)
        .post("/api/admin/proposals")
        .set("Authorization", `Bearer ${tokenVoter}`)
        .send({ electionId, action: APPROVAL_ACTIONS.OPEN_VOTING });

      expect(res.status).toBe(403);
    });

    it("denies Party representative from creating a governance proposal", async () => {
      const res = await request(app)
        .post("/api/admin/proposals")
        .set("Authorization", `Bearer ${tokenParty}`)
        .send({ electionId, action: APPROVAL_ACTIONS.OPEN_VOTING });

      expect(res.status).toBe(403);
    });

    it("denies Auditor from creating or modifying election state (read-only enforcement)", async () => {
      const res = await request(app)
        .post("/api/admin/proposals")
        .set("Authorization", `Bearer ${tokenAuditor}`)
        .send({ electionId, action: APPROVAL_ACTIONS.OPEN_VOTING });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Unauthorized access/i);
    });

    it("allows Auditor to inspect governance summary and audit logs", async () => {
      ElectionApproval.countDocuments = jest.fn().mockResolvedValue(5);
      ElectionApproval.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const res = await request(app)
        .get("/api/admin/governance/summary")
        .set("Authorization", `Bearer ${tokenAuditor}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(5);
    });
  });

  describe("2. Proposal Creation & Workflow Initiation (Admin A)", () => {
    it("creates a PENDING proposal for OPEN_VOTING when election is in SCHEDULED phase", async () => {
      Election.findById.mockResolvedValue({
        _id: electionId,
        title: "Federal General Election",
        phase: ELECTION_PHASES.SCHEDULED,
      });

      ElectionApproval.findOne.mockResolvedValue(null);
      ElectionApproval.create.mockResolvedValue({
        _id: proposalId,
        electionId,
        action: APPROVAL_ACTIONS.OPEN_VOTING,
        targetPhase: ELECTION_PHASES.VOTING,
        requestedBy: adminAId,
        requestedByUsername: "AdminA",
        status: APPROVAL_STATUS.PENDING,
      });

      const res = await request(app)
        .post("/api/admin/proposals")
        .set("Authorization", `Bearer ${tokenAdminA}`)
        .send({
          electionId,
          action: APPROVAL_ACTIONS.OPEN_VOTING,
          reason: "Poll site opening certified across all districts.",
        });

      expect(res.status).toBe(201);
      expect(res.body.proposal.status).toBe(APPROVAL_STATUS.PENDING);
      expect(res.body.proposal.action).toBe(APPROVAL_ACTIONS.OPEN_VOTING);
    });

    it("rejects proposal creation if target phase transition is invalid from current state", async () => {
      Election.findById.mockResolvedValue({
        _id: electionId,
        phase: ELECTION_PHASES.DRAFT, // Cannot jump DRAFT -> VOTING directly
      });

      const res = await request(app)
        .post("/api/admin/proposals")
        .set("Authorization", `Bearer ${tokenAdminA}`)
        .send({
          electionId,
          action: APPROVAL_ACTIONS.OPEN_VOTING,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/illegal state transition/i);
    });

    it("rejects duplicate proposal creation if a PENDING proposal already exists", async () => {
      Election.findById.mockResolvedValue({
        _id: electionId,
        phase: ELECTION_PHASES.SCHEDULED,
      });

      ElectionApproval.findOne.mockResolvedValue({
        _id: new mongoose.Types.ObjectId().toString(),
        status: APPROVAL_STATUS.PENDING,
      });

      const res = await request(app)
        .post("/api/admin/proposals")
        .set("Authorization", `Bearer ${tokenAdminA}`)
        .send({
          electionId,
          action: APPROVAL_ACTIONS.OPEN_VOTING,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already awaiting administrator review/i);
    });
  });

  describe("3. Self-Approval Prevention (Two-Person Rule)", () => {
    it("strictly rejects Admin A from approving their own proposal (403 Forbidden)", async () => {
      const mockProposal = {
        _id: proposalId,
        electionId,
        action: APPROVAL_ACTIONS.OPEN_VOTING,
        targetPhase: ELECTION_PHASES.VOTING,
        requestedBy: adminAId, // Requested by Admin A
        status: APPROVAL_STATUS.PENDING,
        save: jest.fn(),
      };

      ElectionApproval.findById.mockResolvedValue(mockProposal);

      const res = await request(app)
        .post(`/api/admin/proposals/${proposalId}/approve`)
        .set("Authorization", `Bearer ${tokenAdminA}`) // Admin A attempting self-approval
        .send();

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Separation of duties violation: An administrator cannot approve their own election proposal/i);
      expect(mockProposal.save).not.toHaveBeenCalled();
    });
  });

  describe("4. Second Administrator Approval & Atomic Execution (Admin B)", () => {
    it("allows distinct Admin B to approve proposal and atomically executes state transition", async () => {
      const mockElection = {
        _id: electionId,
        phase: ELECTION_PHASES.SCHEDULED,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockProposal = {
        _id: proposalId,
        electionId,
        action: APPROVAL_ACTIONS.OPEN_VOTING,
        targetPhase: ELECTION_PHASES.VOTING,
        requestedBy: adminAId, // Requested by Admin A
        status: APPROVAL_STATUS.PENDING,
        save: jest.fn().mockResolvedValue(true),
      };

      ElectionApproval.findById.mockResolvedValue(mockProposal);
      Election.findById.mockResolvedValue(mockElection);

      const res = await request(app)
        .post(`/api/admin/proposals/${proposalId}/approve`)
        .set("Authorization", `Bearer ${tokenAdminB}`) // Approved by Admin B
        .send();

      expect(res.status).toBe(200);
      expect(mockProposal.status).toBe(APPROVAL_STATUS.EXECUTED);
      expect(mockProposal.approvedBy).toBe(adminBId);
      expect(mockElection.phase).toBe(ELECTION_PHASES.VOTING);
      expect(mockProposal.save).toHaveBeenCalled();
      expect(mockElection.save).toHaveBeenCalled();
    });

    it("allows distinct Admin B to reject proposal with recorded reason", async () => {
      const mockProposal = {
        _id: proposalId,
        electionId,
        action: APPROVAL_ACTIONS.OPEN_VOTING,
        requestedBy: adminAId,
        status: APPROVAL_STATUS.PENDING,
        save: jest.fn().mockResolvedValue(true),
      };

      ElectionApproval.findById.mockResolvedValue(mockProposal);

      const res = await request(app)
        .post(`/api/admin/proposals/${proposalId}/reject`)
        .set("Authorization", `Bearer ${tokenAdminB}`)
        .send({ reason: "Incomplete biometric terminal synchronization in Ward 2." });

      expect(res.status).toBe(200);
      expect(mockProposal.status).toBe(APPROVAL_STATUS.REJECTED);
      expect(mockProposal.rejectionReason).toMatch(/Incomplete biometric terminal synchronization/i);
    });
  });

  describe("5. Replay Protections & State Constraints", () => {
    it("rejects approval of an already EXECUTED proposal (Replay Protection)", async () => {
      const mockProposal = {
        _id: proposalId,
        requestedBy: adminAId,
        status: APPROVAL_STATUS.EXECUTED, // Already executed
      };

      ElectionApproval.findById.mockResolvedValue(mockProposal);

      const res = await request(app)
        .post(`/api/admin/proposals/${proposalId}/approve`)
        .set("Authorization", `Bearer ${tokenAdminB}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Approval replay blocked/i);
    });

    it("rejects approval of a REJECTED proposal", async () => {
      const mockProposal = {
        _id: proposalId,
        requestedBy: adminAId,
        status: APPROVAL_STATUS.REJECTED,
      };

      ElectionApproval.findById.mockResolvedValue(mockProposal);

      const res = await request(app)
        .post(`/api/admin/proposals/${proposalId}/approve`)
        .set("Authorization", `Bearer ${tokenAdminB}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Approval replay blocked/i);
    });

    it("rejects publishing results if election is not in CLOSED state", async () => {
      const mockElection = {
        _id: electionId,
        phase: ELECTION_PHASES.VOTING, // Still in VOTING phase
        save: jest.fn(),
      };

      const mockProposal = {
        _id: proposalId,
        electionId,
        action: APPROVAL_ACTIONS.PUBLISH_RESULTS,
        targetPhase: ELECTION_PHASES.RESULTS_PUBLISHED,
        requestedBy: adminAId,
        status: APPROVAL_STATUS.PENDING,
        save: jest.fn(),
      };

      ElectionApproval.findById.mockResolvedValue(mockProposal);
      Election.findById.mockResolvedValue(mockElection);

      const res = await request(app)
        .post(`/api/admin/proposals/${proposalId}/approve`)
        .set("Authorization", `Bearer ${tokenAdminB}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Results cannot be published because election is not in CLOSED phase/i);
    });
  });
});
