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
jest.mock("bcryptjs", () => ({
  compare: jest.fn((pw, hash) => Promise.resolve(pw === "ValidPassword123" && hash === "$2a$10$hashedMock")),
  hash: jest.fn(() => Promise.resolve("$2a$10$hashedMock")),
}));

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

const authRoutes = require("../../routes/authRoutes");
const adminRoutes = require("../../routes/adminRoutes");
const voterRoutes = require("../../routes/voterRoutes");
const partyRoutes = require("../../routes/partyRoutes");
const resultsRoutes = require("../../routes/resultsRoutes");
const requestIdMiddleware = require("../../middleware/requestId");
const errorHandler = require("../../middleware/errorHandler");

const JWT_SECRET = "api_contract_testing_secret_key_32chars_min!";
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(requestIdMiddleware);
app.use(express.json());
const mockIo = { emit: jest.fn() };
app.set("io", mockIo);

// Health endpoints
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: req.id,
  });
});

app.get("/readyz", (req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "unavailable",
    database: isReady ? "connected" : "disconnected",
    readyState: mongoose.connection.readyState,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/results", resultsRoutes);
app.use(errorHandler);

describe("PHASE 9: API Contract & Error Boundary Test Suite", () => {
  const voterId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();
  const partyId = new mongoose.Types.ObjectId().toString();
  const electionId = new mongoose.Types.ObjectId().toString();

  const validVoterToken = jwt.sign({ id: voterId, role: "voter" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
  const validAdminToken = jwt.sign({ id: adminId, role: "admin" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
  const validPartyToken = jwt.sign({ id: partyId, role: "party" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Health & Readiness Probes Contract", () => {
    it("GET /healthz returns 200 OK with correlation ID and uptime", async () => {
      const res = await request(app).get("/healthz");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(typeof res.body.uptime).toBe("number");
      expect(res.headers["x-request-id"]).toBeDefined();
    });

    it("GET /readyz returns 503 when database is disconnected", async () => {
      const originalReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 0; // disconnected

      const res = await request(app).get("/readyz");
      expect(res.status).toBe(503);
      expect(res.body.status).toBe("unavailable");
      expect(res.body.database).toBe("disconnected");

      mongoose.connection.readyState = originalReadyState;
    });

    it("GET /readyz returns 200 when database is connected", async () => {
      const originalReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 1; // connected

      const res = await request(app).get("/readyz");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ready");
      expect(res.body.database).toBe("connected");

      mongoose.connection.readyState = originalReadyState;
    });
  });

  describe("2. Authentication Endpoints Contract", () => {
    it("POST /api/auth/admin-login rejects missing username or password with 400", async () => {
      const res = await request(app).post("/api/auth/admin-login").send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/required as valid strings/i);
    });

    it("POST /api/auth/admin-login rejects non-string credentials with 400", async () => {
      const res = await request(app).post("/api/auth/admin-login").send({ username: 12345, password: true });
      expect(res.status).toBe(400);
    });

    it("POST /api/auth/admin-login returns 401 on unknown user", async () => {
      Admin.findOne.mockResolvedValue(null);
      const res = await request(app).post("/api/auth/admin-login").send({ username: "unknownAdmin", password: "SomePassword123" });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid/i);
    });

    it("POST /api/auth/voter-login rejects missing email/password with 400", async () => {
      const res = await request(app).post("/api/auth/voter-login").send({ username: "" });
      expect(res.status).toBe(400);
    });

    it("POST /api/auth/party-login rejects missing fields with 400", async () => {
      const res = await request(app).post("/api/auth/party-login").send({ username: "party_rep" });
      expect(res.status).toBe(400);
    });
  });

  describe("3. Role-Based Access Control (RBAC) Boundaries", () => {
    it("rejects voter attempting to access admin-only endpoint with 403", async () => {
      const res = await request(app)
        .post("/api/admin/add-party")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({ partyName: "Hack Party", symbol: "H", username: "h", password: "p" });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Unauthorized access");
    });

    it("rejects party attempting to access voter vote endpoint with 403", async () => {
      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${validPartyToken}`)
        .send({ partyId, biometricToken: "secret" });
      expect(res.status).toBe(403);
    });

    it("rejects unauthenticated request with 403/401", async () => {
      const res = await request(app).get("/api/voter/profile");
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("No token provided");
    });
  });

  describe("4. Biometric Face Verification Contract", () => {
    it("rejects non-array or invalid length descriptor with 400", async () => {
      const res = await request(app)
        .post("/api/voter/face-verify")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({ descriptor: [0.1, 0.2] });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid biometric descriptor format/i);
    });

    it("rejects verification if voter has no enrolled face descriptor with 400", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId, faceDescriptor: [] });
      const res = await request(app)
        .post("/api/voter/face-verify")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({ descriptor: Array(128).fill(0.1) });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no facial biometric data/i);
    });

    it("rejects verification if voter has already participated with 400", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId, faceDescriptor: Array(128).fill(0.1) });
      VoterParticipation.exists.mockResolvedValue(true);
      Vote.exists.mockResolvedValue(false);

      const res = await request(app)
        .post("/api/voter/face-verify")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({ descriptor: Array(128).fill(0.1) });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already cast a ballot/i);
    });
  });

  describe("5. Ballot Casting & Rollback Contract", () => {
    it("rejects vote submission without political party selection with 400", async () => {
      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({ biometricToken: "valid_secret" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/party selection is required/i);
    });

    it("returns 404 if selected political party does not exist", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId });
      Party.findById.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({ partyId: new mongoose.Types.ObjectId().toString(), biometricToken: "valid_token" });
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/does not exist/i);
    });

    it("returns 400 when biometric token is missing or empty string", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId });
      Party.findById.mockResolvedValue({ _id: partyId });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({ partyId, biometricToken: "   " });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/biometric authorization token is required/i);
    });
  });

  describe("6. Admin Registration Contracts & Audit Chain", () => {
    it("rejects password shorter than 6 characters in voter registration with 400", async () => {
      const res = await request(app)
        .post("/api/admin/add-voter")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .send({
          name: "Short Pw",
          email: "short@voter.com",
          password: "123",
          faceDescriptor: Array(128).fill(0.2),
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least 6 characters/i);
    });

    it("clamps audit logs pagination between 1 and 100", async () => {
      AuditLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      AuditLog.countDocuments.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/admin/audit-logs?limit=500&page=-5")
        .set("Authorization", `Bearer ${validAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(100); // clamped to 100
      expect(res.body.page).toBe(1); // clamped to 1
    });
  });
});
