const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Mock dependencies
jest.mock("../../models/Admin");
jest.mock("../../models/Voter");
jest.mock("../../models/Party");
jest.mock("../../models/Election");
jest.mock("../../models/Jurisdiction");
jest.mock("../../models/VoterEligibility");
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
const Jurisdiction = require("../../models/Jurisdiction");
const VoterEligibility = require("../../models/VoterEligibility");
const BiometricToken = require("../../models/BiometricToken");
const VoterParticipation = require("../../models/VoterParticipation");
const AnonymousBallot = require("../../models/AnonymousBallot");
const Vote = require("../../models/Vote");
const { logAuditEvent } = require("../../utils/auditUtils");

const adminRoutes = require("../../routes/adminRoutes");
const voterRoutes = require("../../routes/voterRoutes");
const resultsRoutes = require("../../routes/resultsRoutes");
const requestIdMiddleware = require("../../middleware/requestId");
const errorHandler = require("../../middleware/errorHandler");
const { ELECTION_PHASES } = require("../../utils/electionEngine");

const JWT_SECRET = "multi_election_jurisdiction_test_secret_32chars!";
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(requestIdMiddleware);
app.use(express.json());
app.use("/api/admin", adminRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/results", resultsRoutes);
app.use(errorHandler);

describe("PHASE 18 — MULTI-ELECTION & JURISDICTION MANAGEMENT TEST SUITE", () => {
  let superAdminToken;
  let voter1Token;
  let voter2Token;

  const superAdminId = new mongoose.Types.ObjectId().toString();
  const voter1Id = new mongoose.Types.ObjectId().toString();
  const voter2Id = new mongoose.Types.ObjectId().toString();

  const countryJurisdictionId = new mongoose.Types.ObjectId().toString();
  const stateJurisdictionId = new mongoose.Types.ObjectId().toString();

  const electionAId = new mongoose.Types.ObjectId().toString(); // State Election
  const electionBId = new mongoose.Types.ObjectId().toString(); // National Election
  const party1Id = new mongoose.Types.ObjectId().toString();

  beforeAll(() => {
    superAdminToken = jwt.sign(
      { id: superAdminId, username: "superadmin", role: "SUPER_ADMIN" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    voter1Token = jwt.sign(
      { id: voter1Id, email: "voter1@test.org", role: "voter" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    voter2Token = jwt.sign(
      { id: voter2Id, email: "voter2@test.org", role: "voter" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    logAuditEvent.mockResolvedValue({ _id: "mock_audit_id" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ================= 1. JURISDICTION HIERARCHY =================
  describe("1. Geopolitical Jurisdiction Hierarchy", () => {
    test("Creates hierarchical jurisdiction (Country -> State) with unique code", async () => {
      Jurisdiction.findOne.mockResolvedValue(null);
      Jurisdiction.findById.mockResolvedValue({ _id: countryJurisdictionId, name: "Country Alpha", type: "COUNTRY" });
      Jurisdiction.create.mockImplementation((doc) => Promise.resolve({ _id: stateJurisdictionId, ...doc }));

      const res = await request(app)
        .post("/api/admin/jurisdictions")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "State Beta",
          type: "STATE",
          code: "STA-BETA",
          parentId: countryJurisdictionId,
        });

      expect(res.status).toBe(201);
      expect(res.body.jurisdiction.name).toBe("State Beta");
      expect(res.body.jurisdiction.type).toBe("STATE");
      expect(res.body.jurisdiction.code).toBe("STA-BETA");
    });

    test("Rejects duplicate jurisdiction code", async () => {
      Jurisdiction.findOne.mockResolvedValue({ _id: "existing_id", code: "STA-BETA" });

      const res = await request(app)
        .post("/api/admin/jurisdictions")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "Duplicate State",
          type: "STATE",
          code: "STA-BETA",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("already exists");
    });
  });

  // ================= 2. MULTI-ELECTION CREATION =================
  describe("2. Multi-Election Creation in DRAFT Phase", () => {
    test("Creates Election A (State) starting strictly in DRAFT phase", async () => {
      Election.create.mockImplementation((doc) =>
        Promise.resolve({
          _id: electionAId,
          ...doc,
          phase: ELECTION_PHASES.DRAFT,
        })
      );

      const res = await request(app)
        .post("/api/admin/elections")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          title: "State Assembly Election 2027",
          electionType: "STATE",
          electionCode: "STA-2027",
          jurisdictionId: stateJurisdictionId,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          publishLiveTally: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.election.phase).toBe("DRAFT");
      expect(res.body.election.title).toBe("State Assembly Election 2027");
      expect(res.body.election.electionType).toBe("STATE");
    });

    test("Creates Election B (National) starting strictly in DRAFT phase", async () => {
      Election.create.mockImplementation((doc) =>
        Promise.resolve({
          _id: electionBId,
          ...doc,
          phase: ELECTION_PHASES.DRAFT,
        })
      );

      const res = await request(app)
        .post("/api/admin/elections")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          title: "National General Election 2029",
          electionType: "NATIONAL",
          electionCode: "NAT-2029",
          jurisdictionId: countryJurisdictionId,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          publishLiveTally: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.election.phase).toBe("DRAFT");
      expect(res.body.election.title).toBe("National General Election 2029");
    });
  });

  // ================= 3. VOTER ELIGIBILITY SCOPING =================
  describe("3. Authoritative Server-Side Voter Eligibility", () => {
    test("Voter 1 is accredited for Election A & B, Voter 2 is accredited ONLY for Election A", async () => {
      Election.findById.mockImplementation((id) => {
        if (id.toString() === electionAId) {
          return Promise.resolve({
            _id: electionAId,
            title: "State Assembly Election 2027",
            phase: ELECTION_PHASES.VOTING,
            startDate: new Date(Date.now() - 3600000),
            endDate: new Date(Date.now() + 86400000),
            jurisdictionId: stateJurisdictionId,
          });
        }
        if (id.toString() === electionBId) {
          return Promise.resolve({
            _id: electionBId,
            title: "National General Election 2029",
            phase: ELECTION_PHASES.VOTING,
            startDate: new Date(Date.now() - 3600000),
            endDate: new Date(Date.now() + 86400000),
            jurisdictionId: countryJurisdictionId,
          });
        }
        return Promise.resolve(null);
      });

      Voter.findById.mockImplementation((id) => {
        return Promise.resolve({
          _id: id,
          name: "Test Voter",
          faceDescriptor: new Array(128).fill(0.1),
        });
      });

      // Mock eligibility: Voter 1 has ELIGIBLE for both; Voter 2 only for A
      VoterEligibility.findOne.mockImplementation(({ voterId, electionId }) => {
        const vId = voterId ? voterId.toString() : "";
        const eId = electionId ? electionId.toString() : "";

        if (vId === voter1Id && (eId === electionAId || eId === electionBId)) {
          return Promise.resolve({ voterId, electionId, status: "ELIGIBLE" });
        }
        if (vId === voter2Id && eId === electionAId) {
          return Promise.resolve({ voterId, electionId, status: "ELIGIBLE" });
        }
        return Promise.resolve(null);
      });

      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);
      BiometricToken.create.mockResolvedValue({ token: "valid_secret_token_123" });

      // Voter 1 scans face for Election A -> SUCCESS
      const res1A = await request(app)
        .post("/api/voter/face-verify")
        .set("Authorization", `Bearer ${voter1Token}`)
        .send({
          descriptor: new Array(128).fill(0.1),
          electionId: electionAId,
        });
      expect(res1A.status).toBe(200);
      expect(res1A.body.verified).toBe(true);

      // Voter 2 scans face for Election B (Not accredited) -> REJECTED (403 Ineligible)
      const res2B = await request(app)
        .post("/api/voter/face-verify")
        .set("Authorization", `Bearer ${voter2Token}`)
        .send({
          descriptor: new Array(128).fill(0.1),
          electionId: electionBId,
        });
      expect(res2B.status).toBe(403);
      expect(res2B.body.message).toContain("not accredited");
    });
  });

  // ================= 4. INDEPENDENT BALLOT CASTING =================
  describe("4. Multi-Election Ballot Casting & Isolation", () => {
    test("Voter 1 casts ballot in Election A, then legitimately casts ballot in Election B", async () => {
      Election.findById.mockImplementation((id) => {
        return Promise.resolve({
          _id: id,
          phase: ELECTION_PHASES.VOTING,
          startDate: new Date(Date.now() - 3600000),
          endDate: new Date(Date.now() + 86400000),
        });
      });

      Party.findById.mockResolvedValue({ _id: party1Id, partyName: "Progressive Party" });
      VoterEligibility.findOne.mockResolvedValue({ status: "ELIGIBLE" });

      // First vote: Not participated yet in Election A
      VoterParticipation.exists.mockImplementation(({ voterId, electionId }) => {
        return Promise.resolve(false);
      });

      BiometricToken.findOneAndDelete.mockResolvedValue({
        token: "token_for_election_a",
        voterId: new mongoose.Types.ObjectId(voter1Id),
        electionId: new mongoose.Types.ObjectId(electionAId),
        used: false,
      });

      AnonymousBallot.create.mockResolvedValue({ _id: "uuid-1", electionId: electionAId });
      VoterParticipation.create.mockResolvedValue({ _id: "vp-1", voterId: voter1Id, electionId: electionAId });

      // Cast vote in Election A
      const resVoteA = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voter1Token}`)
        .send({
          partyId: party1Id,
          biometricToken: "token_for_election_a",
          electionId: electionAId,
        });

      expect(resVoteA.status).toBe(200);
      expect(resVoteA.body.message).toBe("Vote cast successfully!");
      expect(resVoteA.body.receipt.electionId.toString()).toBe(electionAId.toString());

      // Second vote: Voter 1 votes in Election B (with distinct token for Election B)
      BiometricToken.findOneAndDelete.mockResolvedValue({
        token: "token_for_election_b",
        voterId: new mongoose.Types.ObjectId(voter1Id),
        electionId: new mongoose.Types.ObjectId(electionBId),
        used: false,
      });

      const resVoteB = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voter1Token}`)
        .send({
          partyId: party1Id,
          biometricToken: "token_for_election_b",
          electionId: electionBId,
        });

      expect(resVoteB.status).toBe(200);
      expect(resVoteB.body.receipt.electionId.toString()).toBe(electionBId.toString());
    });

    test("Voter 1 attempts double-voting in Election A -> strictly blocked", async () => {
      Election.findById.mockResolvedValue({
        _id: electionAId,
        phase: ELECTION_PHASES.VOTING,
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + 86400000),
      });

      Party.findById.mockResolvedValue({ _id: party1Id, partyName: "Progressive Party" });
      VoterEligibility.findOne.mockResolvedValue({ status: "ELIGIBLE" });

      // VoterParticipation exists for Election A
      VoterParticipation.exists.mockImplementation(({ voterId, electionId }) => {
        if (electionId.toString() === electionAId.toString()) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voter1Token}`)
        .send({
          partyId: party1Id,
          biometricToken: "another_token",
          electionId: electionAId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("already voted in this election");
    });
  });

  // ================= 5. CROSS-ELECTION ATTACKS =================
  describe("5. Cross-Election Security Attack Vectors", () => {
    test("Token Poisoning: Attempting to use Election A biometric token for Election B is rejected", async () => {
      Election.findById.mockResolvedValue({
        _id: electionBId,
        phase: ELECTION_PHASES.VOTING,
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + 86400000),
      });

      Party.findById.mockResolvedValue({ _id: party1Id, partyName: "Progressive Party" });
      VoterEligibility.findOne.mockResolvedValue({ status: "ELIGIBLE" });
      VoterParticipation.exists.mockResolvedValue(false);

      // Token returned was issued for Election A!
      BiometricToken.findOneAndDelete.mockResolvedValue({
        token: "token_for_election_a",
        voterId: new mongoose.Types.ObjectId(voter1Id),
        electionId: new mongoose.Types.ObjectId(electionAId), // Mismatch!
        used: false,
      });

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voter1Token}`)
        .send({
          partyId: party1Id,
          biometricToken: "token_for_election_a",
          electionId: electionBId,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("different election");
    });

    test("Result Isolation: GET /api/results?electionId=A scopes strictly to Election A", async () => {
      Election.findById.mockResolvedValue({
        _id: electionAId,
        phase: ELECTION_PHASES.RESULTS_PUBLISHED,
        publishLiveTally: true,
      });

      AnonymousBallot.aggregate.mockImplementation((pipeline) => {
        const match = pipeline[0].$match;
        expect(match.electionId.toString()).toBe(electionAId.toString());
        return Promise.resolve([
          { partyId: party1Id, partyName: "Progressive Party", symbol: "🌱", totalVotes: 5 },
        ]);
      });

      const res = await request(app)
        .get(`/api/results?electionId=${electionAId}`)
        .set("Authorization", `Bearer ${voter1Token}`);

      expect(res.status).toBe(200);
      expect(res.body[0].totalVotes).toBe(5);
    });

    test("Embargo Isolation: Non-admin cannot view results of an embargoed election", async () => {
      Election.findById.mockResolvedValue({
        _id: electionAId,
        phase: ELECTION_PHASES.VOTING,
        publishLiveTally: false, // Embargoed
      });

      const res = await request(app)
        .get(`/api/results?electionId=${electionAId}`)
        .set("Authorization", `Bearer ${voter1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("embargoed");
    });
  });
});
