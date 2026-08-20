const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Mock dependencies
jest.mock("../../models/Admin");
jest.mock("../../models/Voter");
jest.mock("../../models/Party");
jest.mock("../../models/Election");
jest.mock("../../models/BiometricToken");
jest.mock("../../models/VoterParticipation");
jest.mock("../../models/AnonymousBallot");
jest.mock("../../models/AuditLog");
jest.mock("../../models/Vote");
jest.mock("../../utils/auditUtils");

const Admin = require("../../models/Admin");
const Voter = require("../../models/Voter");
const Party = require("../../models/Party");
const Election = require("../../models/Election");
const BiometricToken = require("../../models/BiometricToken");
const VoterParticipation = require("../../models/VoterParticipation");
const AnonymousBallot = require("../../models/AnonymousBallot");
const Vote = require("../../models/Vote");

const authRoutes = require("../../routes/authRoutes");
const adminRoutes = require("../../routes/adminRoutes");
const voterRoutes = require("../../routes/voterRoutes");
const partyRoutes = require("../../routes/partyRoutes");
const resultsRoutes = require("../../routes/resultsRoutes");
const requestIdMiddleware = require("../../middleware/requestId");
const errorHandler = require("../../middleware/errorHandler");
const { ELECTION_PHASES } = require("../../utils/electionEngine");

const JWT_SECRET = "election_lifecycle_testing_secret_key_32chars!";
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

describe("PHASE 11: Election Lifecycle Operations & Enforcement Suite", () => {
  const adminId = new mongoose.Types.ObjectId().toString();
  const voterId = new mongoose.Types.ObjectId().toString();
  const partyId = new mongoose.Types.ObjectId().toString();
  const electionId = new mongoose.Types.ObjectId().toString();

  const validAdminToken = jwt.sign({ id: adminId, role: "admin" }, JWT_SECRET, { expiresIn: "1h" });
  const validVoterToken = jwt.sign({ id: voterId, role: "voter" }, JWT_SECRET, { expiresIn: "1h" });
  const validPartyToken = jwt.sign({ id: partyId, role: "party" }, JWT_SECRET, { expiresIn: "1h" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Election Creation & Date Validation", () => {
    it("creates a new election in DRAFT phase with valid dates", async () => {
      const now = Date.now();
      const startDate = new Date(now + 3600000).toISOString();
      const endDate = new Date(now + 86400000).toISOString();

      Election.create.mockResolvedValue({
        _id: electionId,
        title: "City Council Election 2026",
        phase: ELECTION_PHASES.DRAFT,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      const res = await request(app)
        .post("/api/admin/create-election")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .send({
          title: "City Council Election 2026",
          startDate,
          endDate,
        });

      expect(res.status).toBe(201);
      expect(res.body.election.phase).toBe(ELECTION_PHASES.DRAFT);
      expect(Election.create).toHaveBeenCalled();
    });

    it("rejects election creation if endDate is before or equal to startDate", async () => {
      const now = Date.now();
      const startDate = new Date(now + 86400000).toISOString();
      const endDate = new Date(now + 3600000).toISOString(); // End before start

      const res = await request(app)
        .post("/api/admin/create-election")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .send({
          title: "Invalid Dates Election",
          startDate,
          endDate,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/end date must be strictly after the start date/i);
    });
  });

  describe("2. Deterministic State Machine Transitions", () => {
    it("permits legal sequence DRAFT -> SCHEDULED -> VOTING -> CLOSED -> RESULTS_PUBLISHED", async () => {
      const mockElection = {
        _id: electionId,
        title: "State Senate Election",
        phase: ELECTION_PHASES.DRAFT,
        save: jest.fn().mockResolvedValue(true),
      };

      Election.findById.mockResolvedValue(mockElection);

      // DRAFT -> SCHEDULED
      const res1 = await request(app)
        .post("/api/admin/update-phase")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .send({ electionId, phase: ELECTION_PHASES.SCHEDULED });

      expect(res1.status).toBe(200);
      expect(mockElection.phase).toBe(ELECTION_PHASES.SCHEDULED);

      // SCHEDULED -> VOTING
      const res2 = await request(app)
        .post("/api/admin/update-phase")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .send({ electionId, phase: ELECTION_PHASES.VOTING });

      expect(res2.status).toBe(200);
      expect(mockElection.phase).toBe(ELECTION_PHASES.VOTING);

      // VOTING -> CLOSED
      const res3 = await request(app)
        .post("/api/admin/update-phase")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .send({ electionId, phase: ELECTION_PHASES.CLOSED });

      expect(res3.status).toBe(200);
      expect(mockElection.phase).toBe(ELECTION_PHASES.CLOSED);

      // CLOSED -> RESULTS_PUBLISHED
      const res4 = await request(app)
        .post("/api/admin/update-phase")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .send({ electionId, phase: ELECTION_PHASES.RESULTS_PUBLISHED });

      expect(res4.status).toBe(200);
      expect(mockElection.phase).toBe(ELECTION_PHASES.RESULTS_PUBLISHED);
      expect(mockElection.resultsPublishedAt).toBeDefined();
    });

    it("strictly rejects illegal transition DRAFT -> VOTING", async () => {
      const mockElection = {
        _id: electionId,
        phase: ELECTION_PHASES.DRAFT,
        save: jest.fn(),
      };
      Election.findById.mockResolvedValue(mockElection);

      const res = await request(app)
        .post("/api/admin/update-phase")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .send({ electionId, phase: ELECTION_PHASES.VOTING });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/illegal state transition/i);
    });

    it("strictly rejects illegal backward transition VOTING -> DRAFT", async () => {
      const mockElection = {
        _id: electionId,
        phase: ELECTION_PHASES.VOTING,
        save: jest.fn(),
      };
      Election.findById.mockResolvedValue(mockElection);

      const res = await request(app)
        .post("/api/admin/update-phase")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .send({ electionId, phase: ELECTION_PHASES.DRAFT });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/illegal state transition/i);
    });
  });

  describe("3. Authoritative Voting Window Enforcement", () => {
    it("rejects ballot casting if election phase is not VOTING (e.g. SCHEDULED)", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId });
      Party.findById.mockResolvedValue({ _id: partyId });
      Election.findOne.mockResolvedValue({
        _id: electionId,
        phase: ELECTION_PHASES.SCHEDULED,
        startDate: new Date(Date.now() + 3600000),
        endDate: new Date(Date.now() + 86400000),
      });

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({ partyId, biometricToken: "valid_token" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/voting is currently prohibited/i);
    });

    it("rejects ballot casting if current server time is after endDate (election window concluded)", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId });
      Party.findById.mockResolvedValue({ _id: partyId });
      Election.findOne.mockResolvedValue({
        _id: electionId,
        phase: ELECTION_PHASES.VOTING,
        startDate: new Date(Date.now() - 7200000), // Opened 2 hours ago
        endDate: new Date(Date.now() - 1000), // Concluded 1 second ago
      });

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({ partyId, biometricToken: "valid_token" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/voting window has concluded/i);
    });
  });

  describe("4. Results Publication Embargo Enforcement", () => {
    it("embargoes results to Voter and Party during active VOTING phase", async () => {
      Election.findOne.mockResolvedValue({
        _id: electionId,
        phase: ELECTION_PHASES.VOTING,
        publishLiveTally: false,
      });

      // Voter request
      const voterRes = await request(app)
        .get("/api/results")
        .set("Authorization", `Bearer ${validVoterToken}`);

      expect(voterRes.status).toBe(403);
      expect(voterRes.body.message).toMatch(/embargoed until voting concludes/i);

      // Party representative request
      const partyRes = await request(app)
        .get("/api/results")
        .set("Authorization", `Bearer ${validPartyToken}`);

      expect(partyRes.status).toBe(403);
    });

    it("allows Admin to inspect results during active VOTING phase for supervisory monitoring", async () => {
      Election.findOne.mockResolvedValue({
        _id: electionId,
        phase: ELECTION_PHASES.VOTING,
        publishLiveTally: false,
      });
      AnonymousBallot.countDocuments.mockResolvedValue(1);
      AnonymousBallot.aggregate.mockResolvedValue([{ partyName: "Alliance", totalVotes: 10 }]);

      const adminRes = await request(app)
        .get("/api/results")
        .set("Authorization", `Bearer ${validAdminToken}`);

      expect(adminRes.status).toBe(200);
      expect(Array.isArray(adminRes.body)).toBe(true);
    });

    it("releases results to Voters and Parties once phase is RESULTS_PUBLISHED", async () => {
      Election.findOne.mockResolvedValue({
        _id: electionId,
        phase: ELECTION_PHASES.RESULTS_PUBLISHED,
        publishLiveTally: false,
      });
      AnonymousBallot.countDocuments.mockResolvedValue(1);
      AnonymousBallot.aggregate.mockResolvedValue([{ partyName: "Alliance", totalVotes: 50 }]);

      const voterRes = await request(app)
        .get("/api/results")
        .set("Authorization", `Bearer ${validVoterToken}`);

      expect(voterRes.status).toBe(200);
      expect(Array.isArray(voterRes.body)).toBe(true);
      expect(voterRes.body[0].partyName).toBe("Alliance");
    });
  });
});
