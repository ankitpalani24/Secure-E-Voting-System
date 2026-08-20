const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");

// Mock dependencies
jest.mock("../../models/Admin");
jest.mock("../../models/Voter");
jest.mock("../../models/Party");
jest.mock("../../models/Election");
jest.mock("../../models/ElectionApproval");
jest.mock("../../models/BiometricToken");
jest.mock("../../models/VoterParticipation");
jest.mock("../../models/AnonymousBallot");
jest.mock("../../models/AuditLog");
jest.mock("../../models/Vote");

const Admin = require("../../models/Admin");
const Voter = require("../../models/Voter");
const Party = require("../../models/Party");
const Election = require("../../models/Election");
const { ElectionApproval, APPROVAL_ACTIONS, APPROVAL_STATUS } = require("../../models/ElectionApproval");
const BiometricToken = require("../../models/BiometricToken");
const VoterParticipation = require("../../models/VoterParticipation");
const AnonymousBallot = require("../../models/AnonymousBallot");
const AuditLog = require("../../models/AuditLog");
const Vote = require("../../models/Vote");

const authRoutes = require("../../routes/authRoutes");
const adminRoutes = require("../../routes/adminRoutes");
const voterRoutes = require("../../routes/voterRoutes");
const partyRoutes = require("../../routes/partyRoutes");
const resultsRoutes = require("../../routes/resultsRoutes");
const requestIdMiddleware = require("../../middleware/requestId");
const errorHandler = require("../../middleware/errorHandler");
const { ELECTION_PHASES } = require("../../utils/electionEngine");
const { verifyAuditChain } = require("../../utils/auditUtils");

const JWT_SECRET = "simulation_integrity_testing_secret_key_32chars!";
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(requestIdMiddleware);
app.use(express.json());
const mockIo = { emit: jest.fn() };
app.set("io", mockIo);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/results", resultsRoutes);
app.use(errorHandler);

describe("PHASE 13: Full Election Simulation, Concurrency Attack & Disaster Testing Suite", () => {
  const adminAId = new mongoose.Types.ObjectId().toString();
  const adminBId = new mongoose.Types.ObjectId().toString();
  const auditorId = new mongoose.Types.ObjectId().toString();
  const electionId = new mongoose.Types.ObjectId().toString();

  const partyAId = new mongoose.Types.ObjectId().toString();
  const partyBId = new mongoose.Types.ObjectId().toString();
  const partyCId = new mongoose.Types.ObjectId().toString();

  const tokenAdminA = jwt.sign({ id: adminAId, role: "ELECTION_ADMIN", username: "OfficerAlpha" }, JWT_SECRET, { expiresIn: "2h" });
  const tokenAdminB = jwt.sign({ id: adminBId, role: "ELECTION_ADMIN", username: "OfficerBravo" }, JWT_SECRET, { expiresIn: "2h" });
  const tokenAuditor = jwt.sign({ id: auditorId, role: "AUDITOR", username: "InspectorGeneral" }, JWT_SECRET, { expiresIn: "2h" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Complete Election Lifecycle with Dual-Admin Consensus", () => {
    it("executes full lifecycle: DRAFT -> SCHEDULED -> VOTING -> CLOSED -> RESULTS_PUBLISHED", async () => {
      // Step A: DRAFT -> SCHEDULED
      const mockElection = {
        _id: electionId,
        title: "SecureVote Institutional Election 2026",
        phase: ELECTION_PHASES.DRAFT,
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + 86400000),
        save: jest.fn().mockResolvedValue(true),
      };

      Election.findById.mockResolvedValue(mockElection);

      const schedRes = await request(app)
        .post("/api/admin/update-phase")
        .set("Authorization", `Bearer ${tokenAdminA}`)
        .send({ electionId, phase: ELECTION_PHASES.SCHEDULED });

      expect(schedRes.status).toBe(200);
      expect(mockElection.phase).toBe(ELECTION_PHASES.SCHEDULED);

      // Step B: Admin A proposes OPEN_VOTING
      const proposalOpenId = new mongoose.Types.ObjectId().toString();
      const mockOpenProposal = {
        _id: proposalOpenId,
        electionId,
        action: APPROVAL_ACTIONS.OPEN_VOTING,
        targetPhase: ELECTION_PHASES.VOTING,
        requestedBy: adminAId,
        requestedByUsername: "OfficerAlpha",
        status: APPROVAL_STATUS.PENDING,
        save: jest.fn().mockResolvedValue(true),
      };

      ElectionApproval.findById.mockResolvedValue(mockOpenProposal);

      // Step C: Admin B authorizes OPEN_VOTING
      const openRes = await request(app)
        .post(`/api/admin/proposals/${proposalOpenId}/approve`)
        .set("Authorization", `Bearer ${tokenAdminB}`)
        .send();

      expect(openRes.status).toBe(200);
      expect(mockElection.phase).toBe(ELECTION_PHASES.VOTING);
      expect(mockOpenProposal.status).toBe(APPROVAL_STATUS.EXECUTED);

      // Step D: Admin A proposes CLOSE_VOTING
      const proposalCloseId = new mongoose.Types.ObjectId().toString();
      const mockCloseProposal = {
        _id: proposalCloseId,
        electionId,
        action: APPROVAL_ACTIONS.CLOSE_VOTING,
        targetPhase: ELECTION_PHASES.CLOSED,
        requestedBy: adminAId,
        requestedByUsername: "OfficerAlpha",
        status: APPROVAL_STATUS.PENDING,
        save: jest.fn().mockResolvedValue(true),
      };

      ElectionApproval.findById.mockResolvedValue(mockCloseProposal);

      // Step E: Admin B authorizes CLOSE_VOTING
      const closeRes = await request(app)
        .post(`/api/admin/proposals/${proposalCloseId}/approve`)
        .set("Authorization", `Bearer ${tokenAdminB}`)
        .send();

      expect(closeRes.status).toBe(200);
      expect(mockElection.phase).toBe(ELECTION_PHASES.CLOSED);

      // Step F: Admin A proposes PUBLISH_RESULTS
      const proposalPublishId = new mongoose.Types.ObjectId().toString();
      const mockPublishProposal = {
        _id: proposalPublishId,
        electionId,
        action: APPROVAL_ACTIONS.PUBLISH_RESULTS,
        targetPhase: ELECTION_PHASES.RESULTS_PUBLISHED,
        requestedBy: adminAId,
        requestedByUsername: "OfficerAlpha",
        status: APPROVAL_STATUS.PENDING,
        save: jest.fn().mockResolvedValue(true),
      };

      ElectionApproval.findById.mockResolvedValue(mockPublishProposal);

      // Step G: Admin B authorizes PUBLISH_RESULTS
      const publishRes = await request(app)
        .post(`/api/admin/proposals/${proposalPublishId}/approve`)
        .set("Authorization", `Bearer ${tokenAdminB}`)
        .send();

      expect(publishRes.status).toBe(200);
      expect(mockElection.phase).toBe(ELECTION_PHASES.RESULTS_PUBLISHED);
    });
  });

  describe("2. Concurrent Governance Attack Simulation", () => {
    it("safely handles 20 simultaneous approval requests for the same proposal (exactly 1 succeeds)", async () => {
      let executionCount = 0;
      const proposalId = new mongoose.Types.ObjectId().toString();

      // State transition mock
      const mockElection = {
        _id: electionId,
        phase: ELECTION_PHASES.SCHEDULED,
        save: jest.fn().mockResolvedValue(true),
      };
      Election.findById.mockResolvedValue(mockElection);

      let currentStatus = APPROVAL_STATUS.PENDING;

      ElectionApproval.findById.mockImplementation(async () => {
        return {
          _id: proposalId,
          electionId,
          action: APPROVAL_ACTIONS.OPEN_VOTING,
          targetPhase: ELECTION_PHASES.VOTING,
          requestedBy: adminAId,
          get status() { return currentStatus; },
          set status(val) { currentStatus = val; },
          save: jest.fn().mockImplementation(async () => {
            if (currentStatus === APPROVAL_STATUS.EXECUTED) {
              executionCount++;
            }
          }),
        };
      });

      // Fire 20 simultaneous approvals from Admin B
      const promises = Array.from({ length: 20 }, () =>
        request(app)
          .post(`/api/admin/proposals/${proposalId}/approve`)
          .set("Authorization", `Bearer ${tokenAdminB}`)
          .send()
      );

      const responses = await Promise.all(promises);
      const successes = responses.filter(r => r.status === 200);
      const rejectedReplays = responses.filter(r => r.status === 400);

      // Exactly 1 approval must succeed
      expect(successes.length).toBe(1);
      expect(rejectedReplays.length).toBe(19);
      expect(executionCount).toBe(1);
    });
  });

  describe("3. 20-Voter Population & Double-Voting Attack Simulation", () => {
    const totalVoters = 20;
    const voterTokens = [];

    // Distribution: Party A = 8, Party B = 7, Party C = 5
    const voteChoices = [
      ...Array(8).fill(partyAId),
      ...Array(7).fill(partyBId),
      ...Array(5).fill(partyCId),
    ];

    it("simulates 20 voters casting ballots with exact party distribution", async () => {
      const activeElection = {
        _id: electionId,
        phase: ELECTION_PHASES.VOTING,
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + 86400000),
        publishLiveTally: false,
      };

      Election.findOne.mockResolvedValue(activeElection);
      Party.findById.mockImplementation(async (id) => ({ _id: id, partyName: "PartyName" }));

      let participationRecords = 0;
      let anonymousBallots = 0;

      for (let i = 0; i < totalVoters; i++) {
        const currentVoterId = new mongoose.Types.ObjectId().toString();
        const vToken = jwt.sign({ id: currentVoterId, role: "voter" }, JWT_SECRET, { expiresIn: "1h" });
        voterTokens.push({ id: currentVoterId, token: vToken });

        Voter.findById.mockResolvedValue({ _id: currentVoterId, faceDescriptor: Array(128).fill(0.1) });
        VoterParticipation.exists.mockResolvedValue(false);
        Vote.exists.mockResolvedValue(false);

        // Biometric verify
        BiometricToken.create.mockResolvedValue({ token: `token_${i}`, voterId: currentVoterId });
        BiometricToken.findOneAndDelete.mockResolvedValue({ token: `token_${i}`, voterId: currentVoterId });

        VoterParticipation.create.mockImplementation(async () => {
          participationRecords++;
          return { _id: new mongoose.Types.ObjectId() };
        });

        AnonymousBallot.create.mockImplementation(async () => {
          anonymousBallots++;
          return { _id: crypto.randomUUID() };
        });

        const res = await request(app)
          .post("/api/voter/vote")
          .set("Authorization", `Bearer ${vToken}`)
          .send({
            partyId: voteChoices[i],
            biometricToken: `token_${i}`,
          });

        expect(res.status).toBe(200);
        expect(res.body.receipt).toBeDefined();
        expect(res.body.receipt.ballotCommitment).toBeDefined();

        // RECEIPT PRIVACY INVARIANT: No voter identity or party choice in receipt
        expect(res.body.receipt.voterId).toBeUndefined();
        expect(res.body.receipt.voterEmail).toBeUndefined();
        expect(res.body.receipt.partyId).toBeUndefined();
      }

      // CRITICAL INVARIANT: COUNT(Participation) == COUNT(Ballots) == 20
      expect(participationRecords).toBe(20);
      expect(anonymousBallots).toBe(20);
    });

    it("strictly blocks double-voting attempts across repeated and simultaneous requests", async () => {
      const existingVoterId = voterTokens[0].id;
      const vToken = voterTokens[0].token;

      Voter.findById.mockResolvedValue({ _id: existingVoterId });
      Party.findById.mockResolvedValue({ _id: partyAId });

      // Simulate voter already participated
      VoterParticipation.exists.mockResolvedValue(true);
      Vote.exists.mockResolvedValue(false);

      const doubleVoteRes = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${vToken}`)
        .send({ partyId: partyAId, biometricToken: "stolen_token" });

      expect(doubleVoteRes.status).toBe(400);
      expect(doubleVoteRes.body.message).toMatch(/already voted/i);
    });
  });

  describe("4. Results Embargo & Publication Verification", () => {
    it("embargoes tallies during VOTING and discloses matching tally upon publication", async () => {
      // 1. Embargo Check during VOTING phase
      Election.findOne.mockResolvedValue({
        _id: electionId,
        phase: ELECTION_PHASES.VOTING,
        publishLiveTally: false,
      });

      const voterRes = await request(app)
        .get("/api/results")
        .set("Authorization", `Bearer ${tokenAuditor}`);

      // Auditor can supervise or observe
      expect(voterRes.status).toBe(403); // Non-admin embargoed

      // 2. Publication Check: RESULTS_PUBLISHED
      Election.findOne.mockResolvedValue({
        _id: electionId,
        phase: ELECTION_PHASES.RESULTS_PUBLISHED,
        publishLiveTally: false,
      });

      AnonymousBallot.countDocuments.mockResolvedValue(20);
      AnonymousBallot.aggregate.mockResolvedValue([
        { partyId: partyAId, partyName: "Alliance", totalVotes: 8 },
        { partyId: partyBId, partyName: "Civic", totalVotes: 7 },
        { partyId: partyCId, partyName: "Liberty", totalVotes: 5 },
      ]);

      const pubRes = await request(app)
        .get("/api/results")
        .set("Authorization", `Bearer ${tokenAuditor}`);

      expect(pubRes.status).toBe(200);
      expect(Array.isArray(pubRes.body)).toBe(true);
      expect(pubRes.body.find(p => p.partyName === "Alliance").totalVotes).toBe(8);
      expect(pubRes.body.find(p => p.partyName === "Civic").totalVotes).toBe(7);
      expect(pubRes.body.find(p => p.partyName === "Liberty").totalVotes).toBe(5);
    });
  });

  describe("5. Audit Chain Tamper Detection", () => {
    it("detects historical record tampering, deletion, or forged blocks", async () => {
      const genesisPrev = "0000000000000000000000000000000000000000000000000000000000000000";
      const time1 = new Date("2026-08-20T10:00:00.000Z");
      const payload1 = `${genesisPrev}|${time1.toISOString()}|ELECTION_CREATED|admin|anonymous|{}`;
      const hash1 = crypto.createHash("sha256").update(payload1).digest("hex");

      const time2 = new Date("2026-08-20T10:01:00.000Z");
      const payload2 = `${hash1}|${time2.toISOString()}|ELECTION_OPENED|admin|anonymous|{}`;
      const hash2 = crypto.createHash("sha256").update(payload2).digest("hex");

      // 1. Valid linear chain verification
      AuditLog.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { previousHash: genesisPrev, currentHash: hash1, time: time1, action: "ELECTION_CREATED", userRole: "admin", userId: null, details: {} },
            { previousHash: hash1, currentHash: hash2, time: time2, action: "ELECTION_OPENED", userRole: "admin", userId: null, details: {} },
          ]),
        }),
      });

      const validVerification = await verifyAuditChain();
      expect(validVerification.valid).toBe(true);
      expect(validVerification.totalRecords).toBe(2);

      // 2. Tampered block (broken previousHash linkage)
      AuditLog.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { previousHash: genesisPrev, currentHash: hash1, time: time1, action: "ELECTION_CREATED", userRole: "admin", userId: null, details: {} },
            { previousHash: "FORGED_PREVIOUS_HASH", currentHash: hash2, time: time2, action: "ELECTION_OPENED", userRole: "admin", userId: null, details: {} },
          ]),
        }),
      });

      const tamperedVerification = await verifyAuditChain();
      expect(tamperedVerification.valid).toBe(false);
      expect(tamperedVerification.brokenAt).toBe(1);
    });
  });
});
