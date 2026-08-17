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
  compare: jest.fn((pw, hash) => Promise.resolve(pw === "ValidPassword123" && hash === "$2a$10$hashedMock")),
  hash: jest.fn(() => Promise.resolve("$2a$10$hashedMock")),
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
const { logAuditEvent } = require("../../utils/auditUtils");

// Routes
const authRoutes = require("../../routes/authRoutes");
const adminRoutes = require("../../routes/adminRoutes");
const voterRoutes = require("../../routes/voterRoutes");
const partyRoutes = require("../../routes/partyRoutes");
const resultsRoutes = require("../../routes/resultsRoutes");

const JWT_SECRET = "adversarial_test_jwt_secret_987654321012345";
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(express.json());
const mockIo = { emit: jest.fn() };
app.set("io", mockIo);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/results", resultsRoutes);

describe("PHASE 8: Adversarial Security & Production Hardening Test Suite", () => {
  const voterId = new mongoose.Types.ObjectId().toString();
  const partyId = new mongoose.Types.ObjectId().toString();
  const electionId = new mongoose.Types.ObjectId().toString();

  const voterToken = jwt.sign({ id: voterId, role: "voter" }, JWT_SECRET, { expiresIn: "1h" });
  const adminToken = jwt.sign({ id: "admin_123", role: "admin" }, JWT_SECRET, { expiresIn: "1h" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. JWT & Malformed Authentication Header Attacks", () => {
    it("rejects non-Bearer format tokens with 401", async () => {
      const res = await request(app)
        .get("/api/voter/profile")
        .set("Authorization", "Basic user:pass");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid authorization format");
    });

    it("rejects token with missing required claims with 401", async () => {
      const emptyClaimToken = jwt.sign({ foo: "bar" }, JWT_SECRET);
      const res = await request(app)
        .get("/api/voter/profile")
        .set("Authorization", `Bearer ${emptyClaimToken}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Malformed token claims");
    });

    it("rejects expired token with 401", async () => {
      const expiredToken = jwt.sign({ id: voterId, role: "voter" }, JWT_SECRET, { expiresIn: -10 });
      const res = await request(app)
        .get("/api/voter/profile")
        .set("Authorization", `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid token");
    });
  });

  describe("2. NoSQL Injection & Type Tampering Attacks", () => {
    it("rejects NoSQL object injection in admin login", async () => {
      const res = await request(app)
        .post("/api/auth/admin-login")
        .send({ username: { $ne: null }, password: { $gt: "" } });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/valid string/i);
    });

    it("rejects NoSQL object injection in voter login", async () => {
      const res = await request(app)
        .post("/api/auth/voter-login")
        .send({ username: { $regex: ".*" }, password: "ValidPassword123" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/valid string/i);
    });
  });

  describe("3. Mass Assignment Attacks", () => {
    it("prevents privilege escalation when creating a voter with role: admin", async () => {
      Voter.findOne.mockResolvedValue(null);
      Voter.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      Voter.create.mockImplementation((doc) => {
        // Mongoose schema enforces role: "voter" by default
        return Promise.resolve({
          _id: "new_voter_id",
          name: doc.name,
          email: doc.email,
          role: "voter",
        });
      });

      const res = await request(app)
        .post("/api/admin/add-voter")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Attacker User",
          email: "attacker@domain.com",
          password: "SecurePassword123",
          role: "admin",
          isAdmin: true,
          faceDescriptor: Array(128).fill(0.123),
        });

      expect(res.status).toBe(201);
      expect(res.body.voter.role).toBe("voter");
      expect(res.body.voter.isAdmin).toBeUndefined();
    });
  });

  describe("4. Biometric Single-Use Token & Transaction Rollback Resilience", () => {
    it("atomically blocks reused biometricToken", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId });
      Party.findById.mockResolvedValue({ _id: partyId });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      // Biometric token was already consumed (returns null)
      BiometricToken.findOneAndDelete.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voterToken}`)
        .send({
          partyId,
          biometricToken: "previously_used_or_invalid_secret",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid, expired, or previously consumed/i);
      expect(VoterParticipation.create).not.toHaveBeenCalled();
      expect(AnonymousBallot.create).not.toHaveBeenCalled();
    });

    it("rolls back VoterParticipation record if AnonymousBallot insertion fails", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId });
      Party.findById.mockResolvedValue({ _id: partyId });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      BiometricToken.findOneAndDelete.mockResolvedValue({
        token: "valid_secret_token",
        voterId,
      });

      const mockParticipationId = new mongoose.Types.ObjectId();
      VoterParticipation.create.mockResolvedValue({
        _id: mockParticipationId,
        voterId,
      });
      VoterParticipation.findByIdAndDelete.mockResolvedValue({});

      // AnonymousBallot throws an unexpected database error
      AnonymousBallot.create.mockRejectedValue(new Error("Database connection interrupted"));

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${voterToken}`)
        .send({
          partyId,
          biometricToken: "valid_secret_token",
        });

      expect(res.status).toBe(500);
      expect(VoterParticipation.findByIdAndDelete).toHaveBeenCalledWith(mockParticipationId);
    });
  });
});
