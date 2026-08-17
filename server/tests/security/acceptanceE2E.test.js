const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");

// 1. Mock dependencies BEFORE requiring controllers or routes
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
jest.mock("bcryptjs", () => ({
  compare: jest.fn((pw, hash) => Promise.resolve(pw === "CorrectPassword123" && hash === "$2a$10$mockHashedPassword")),
  hash: jest.fn(() => Promise.resolve("$2a$10$mockHashedPassword")),
  genSalt: jest.fn(() => Promise.resolve("salt")),
}));

// Models
const Admin = require("../../models/Admin");
const Voter = require("../../models/Voter");
const Party = require("../../models/Party");
const Election = require("../../models/Election");
const BiometricToken = require("../../models/BiometricToken");
const VoterParticipation = require("../../models/VoterParticipation");
const AnonymousBallot = require("../../models/AnonymousBallot");
const AuditLog = require("../../models/AuditLog");
const Vote = require("../../models/Vote");
const { logAuditEvent, verifyAuditChain } = require("../../utils/auditUtils");

// Routes
const authRoutes = require("../../routes/authRoutes");
const adminRoutes = require("../../routes/adminRoutes");
const voterRoutes = require("../../routes/voterRoutes");
const partyRoutes = require("../../routes/partyRoutes");
const resultsRoutes = require("../../routes/resultsRoutes");

const JWT_SECRET = "acceptance_test_secret_key_1234567890123456";
process.env.JWT_SECRET = JWT_SECRET;

// Build express app for end-to-end HTTP testing
const app = express();
app.use(express.json());

const mockIo = { emit: jest.fn() };
app.set("io", mockIo);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/results", resultsRoutes);

describe("PHASE 3.5 — Full End-to-End Acceptance Integration Suite", () => {
  const adminId = new mongoose.Types.ObjectId("65df00000000000000000001");
  const voter1Id = new mongoose.Types.ObjectId("65df00000000000000000002");
  const party1Id = new mongoose.Types.ObjectId("65df00000000000000000003");
  const electionId = new mongoose.Types.ObjectId("65df00000000000000000004");

  const adminToken = jwt.sign({ id: adminId.toString(), role: "admin", username: "electoral_admin" }, JWT_SECRET, { expiresIn: "1h" });
  const voterToken = jwt.sign({ id: voter1Id.toString(), role: "voter", name: "Eleanor Vance" }, JWT_SECRET, { expiresIn: "1h" });
  const partyToken = jwt.sign({ id: party1Id.toString(), role: "party", username: "alliance_rep" }, JWT_SECRET, { expiresIn: "1h" });

  beforeEach(() => {
    jest.clearAllMocks();

    logAuditEvent.mockResolvedValue({});
    verifyAuditChain.mockResolvedValue({ valid: true, totalRecords: 12, brokenAt: null });

    Vote.exists.mockResolvedValue(false);
    Vote.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Vote.countDocuments.mockResolvedValue(0);

    VoterParticipation.exists.mockResolvedValue(false);
    VoterParticipation.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    VoterParticipation.countDocuments.mockResolvedValue(0);
    VoterParticipation.create.mockResolvedValue({});

    AnonymousBallot.countDocuments.mockResolvedValue(0);
    AnonymousBallot.create.mockResolvedValue({});
    AnonymousBallot.aggregate.mockResolvedValue([]);

    Voter.countDocuments.mockResolvedValue(0);
    Voter.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Voter.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: voter1Id, name: "Eleanor Vance", email: "eleanor.vance@domain.com" }),
      }),
    });

    Party.countDocuments.mockResolvedValue(0);
    Party.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Party.findById.mockResolvedValue({ _id: party1Id, partyName: "Democratic Alliance", symbol: "⭐" });

    Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
  });

  // ==========================================
  // 1. AUTHENTICATION ACCEPTANCE
  // ==========================================
  describe("1. End-to-End Authentication & Role Verification", () => {
    test("A. Admin Login — Valid Credentials", async () => {
      Admin.findOne.mockResolvedValue({
        _id: adminId,
        username: "electoral_admin",
        password: "$2a$10$mockHashedPassword",
      });

      const res = await request(app)
        .post("/api/auth/admin-login")
        .send({ username: "electoral_admin", password: "CorrectPassword123" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.role).toBe("admin");
    });

    test("B. Admin Login — Invalid Password (HTTP 401)", async () => {
      Admin.findOne.mockResolvedValue({
        _id: adminId,
        username: "electoral_admin",
        password: "$2a$10$mockHashedPassword",
      });

      const res = await request(app)
        .post("/api/auth/admin-login")
        .send({ username: "electoral_admin", password: "WrongPassword" });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid.*credentials/i);
    });

    test("C. Voter Login — Valid Credentials", async () => {
      Voter.findOne.mockResolvedValue({
        _id: voter1Id,
        email: "eleanor.vance@domain.com",
        name: "Eleanor Vance",
        password: "$2a$10$mockHashedPassword",
      });

      const res = await request(app)
        .post("/api/auth/voter-login")
        .send({ username: "eleanor.vance@domain.com", password: "CorrectPassword123" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.role).toBe("voter");
      expect(res.body.name).toBe("Eleanor Vance");
    });

    test("D. Party Login — Valid Credentials", async () => {
      Party.findOne.mockResolvedValue({
        _id: party1Id,
        username: "alliance_rep",
        partyName: "Democratic Alliance",
        password: "$2a$10$mockHashedPassword",
      });

      const res = await request(app)
        .post("/api/auth/party-login")
        .send({ username: "alliance_rep", password: "CorrectPassword123" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.role).toBe("party");
    });
  });

  // ==========================================
  // 2. ADMIN ACTIONS END-TO-END
  // ==========================================
  describe("2. Admin Operations End-to-End", () => {
    test("A. Query Dashboard Statistics", async () => {
      Voter.countDocuments.mockResolvedValue(150);
      Party.countDocuments.mockResolvedValue(4);
      AnonymousBallot.countDocuments.mockResolvedValue(98);

      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        votersCount: 150,
        partiesCount: 4,
        votesCount: 98,
      });
    });

    test("B. Register Accredited Party Slate", async () => {
      Party.findOne.mockResolvedValue(null);
      Party.create.mockResolvedValue({
        _id: party1Id,
        partyName: "Democratic Alliance",
        symbol: "⭐",
        description: "Civic Freedom & Progress",
        username: "alliance_rep",
      });

      const res = await request(app)
        .post("/api/admin/add-party")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          partyName: "Democratic Alliance",
          symbol: "⭐",
          description: "Civic Freedom & Progress",
          manifesto: "Empower citizens through technology",
          username: "alliance_rep",
          password: "SecureRepPassword123",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/party added/i);
    });

    test("C. Enroll New Citizen Voter with 128-d Biometrics", async () => {
      Voter.findOne.mockResolvedValue(null);
      Voter.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      Voter.create.mockResolvedValue({
        _id: voter1Id,
        name: "Eleanor Vance",
        email: "eleanor.vance@domain.com",
        role: "voter",
      });

      const sampleDescriptor = Array.from({ length: 128 }, (_, i) => i * 0.007);

      const res = await request(app)
        .post("/api/admin/add-voter")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Eleanor Vance",
          email: "eleanor.vance@domain.com",
          password: "TempCitizenPassword123",
          voterId: "VOT-2026-8942",
          faceDescriptor: sampleDescriptor,
        });

      expect(res.status).toBe(201);
      expect(res.body.voter.email).toBe("eleanor.vance@domain.com");
      expect(res.body.voter.faceDescriptor).toBeUndefined(); // Biometrics sanitized from response
      expect(res.body.voter.password).toBeUndefined(); // Password sanitized
    });

    test("D. Query Official Voters Roll", async () => {
      Voter.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: voter1Id, name: "Eleanor Vance", email: "eleanor.vance@domain.com", role: "voter" },
        ]),
      });
      VoterParticipation.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      Vote.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .get("/api/admin/voters")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].hasVoted).toBe(false);
    });

    test("E. Verify Linear SHA-256 Audit Chain", async () => {
      const res = await request(app)
        .get("/api/admin/audit-verify")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.totalRecords).toBe(12);
    });
  });

  // ==========================================
  // 3. VOTER ACTIONS & DECOUPLED BALLOT FLOW
  // ==========================================
  describe("3. Citizen Voter Flow & Biometric Token Authorization", () => {
    test("A. Voter Profile Query", async () => {
      Voter.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: voter1Id,
            name: "Eleanor Vance",
            email: "eleanor.vance@domain.com",
          }),
        }),
      });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      const res = await request(app)
        .get("/api/voter/profile")
        .set("Authorization", `Bearer ${voterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Eleanor Vance");
      expect(res.body.hasVoted).toBe(false);
    });

    test("B. Face Liveness Verification & 5-min Token Issuance", async () => {
      const registeredDescriptor = Array.from({ length: 128 }, (_, i) => i * 0.007);
      const queryDescriptor = Array.from({ length: 128 }, (_, i) => i * 0.007 + 0.001); // euclidean distance < 0.55

      Voter.findById.mockResolvedValue({
        _id: voter1Id,
        faceDescriptor: registeredDescriptor,
      });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      BiometricToken.create.mockResolvedValue({
        token: "biometric_session_token_xyz999",
        voterId: voter1Id,
        expiresAt: new Date(Date.now() + 300000),
      });

      const res = await request(app)
        .post("/api/voter/face-verify")
        .set("Authorization", `Bearer ${voterToken}`)
        .send({ descriptor: queryDescriptor });

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.biometricToken).toBe("biometric_session_token_xyz999");
    });

    test("C. Cast Vote Successfully with Single-Use Token", async () => {
      Voter.findById.mockResolvedValue({ _id: voter1Id, name: "Eleanor Vance" });
      Party.findById.mockResolvedValue({ _id: party1Id, partyName: "Democratic Alliance" });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      BiometricToken.findOneAndDelete.mockResolvedValue({
        token: "biometric_session_token_xyz999",
        voterId: voter1Id,
      });

      VoterParticipation.create.mockResolvedValue({});
      AnonymousBallot.create.mockResolvedValue({});

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voterToken}`)
        .send({
          partyId: party1Id.toString(),
          biometricToken: "biometric_session_token_xyz999",
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/vote cast successfully/i);
      expect(res.body.receipt).toBeDefined();
      expect(res.body.receipt.ballotCommitment).toBeDefined();
    });

    test("D. Rejects Missing Biometric Token", async () => {
      Voter.findById.mockResolvedValue({ _id: voter1Id, name: "Eleanor Vance" });
      Party.findById.mockResolvedValue({ _id: party1Id, partyName: "Democratic Alliance" });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voterToken}`)
        .send({ partyId: party1Id.toString() }); // missing biometricToken

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/biometric.*required/i);
    });

    test("E. Rejects Reused / Expired Biometric Token", async () => {
      Voter.findById.mockResolvedValue({ _id: voter1Id, name: "Eleanor Vance" });
      Party.findById.mockResolvedValue({ _id: party1Id, partyName: "Democratic Alliance" });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      BiometricToken.findOneAndDelete.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voterToken}`)
        .send({
          partyId: party1Id.toString(),
          biometricToken: "already_consumed_or_expired_token",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid.*expired.*token/i);
    });

    test("F. Prevents Double Voting from Same Citizen", async () => {
      Voter.findById.mockResolvedValue({ _id: voter1Id, name: "Eleanor Vance" });
      Party.findById.mockResolvedValue({ _id: party1Id, partyName: "Democratic Alliance" });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      VoterParticipation.exists.mockResolvedValue(true); // Already voted
      Vote.exists.mockResolvedValue(false);

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voterToken}`)
        .send({
          partyId: party1Id.toString(),
          biometricToken: "new_token",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already voted/i);
    });
  });

  // ==========================================
  // 4. RBAC & UNAUTHORIZED BOUNDARY CHECKS
  // ==========================================
  describe("4. Role-Based Access Control Boundaries", () => {
    test("A. Citizen Voter blocked from Admin Voter Enrollment API", async () => {
      const res = await request(app)
        .post("/api/admin/add-voter")
        .set("Authorization", `Bearer ${voterToken}`)
        .send({ name: "Hacker", email: "hacker@test.com" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/unauthorized/i);
    });

    test("B. Party Representative blocked from Casting Ballots", async () => {
      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${partyToken}`)
        .send({ partyId: party1Id.toString(), biometricToken: "tok" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/unauthorized/i);
    });

    test("C. Unauthenticated request rejected with 403", async () => {
      const res = await request(app).get("/api/admin/stats");
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/no token/i);
    });
  });

  // ==========================================
  // 5. RESULTS AGGREGATION
  // ==========================================
  describe("5. Certified Results Aggregation", () => {
    test("Accurately returns aggregated totals from AnonymousBallot collection", async () => {
      AnonymousBallot.countDocuments.mockResolvedValue(1);
      AnonymousBallot.aggregate.mockResolvedValue([
        { _id: party1Id, partyName: "Democratic Alliance", symbol: "⭐", totalVotes: 1 },
      ]);

      const res = await request(app)
        .get("/api/results")
        .set("Authorization", `Bearer ${voterToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].totalVotes).toBe(1);
      expect(res.body[0].partyName).toBe("Democratic Alliance");
    });
  });
});
