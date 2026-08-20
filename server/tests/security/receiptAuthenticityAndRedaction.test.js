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
jest.mock("../../models/BiometricToken");
jest.mock("../../models/VoterParticipation");
jest.mock("../../models/AnonymousBallot");
jest.mock("../../models/AuditLog");
jest.mock("../../models/Vote");
jest.mock("../../utils/auditUtils");

const Voter = require("../../models/Voter");
const Party = require("../../models/Party");
const Election = require("../../models/Election");
const BiometricToken = require("../../models/BiometricToken");
const VoterParticipation = require("../../models/VoterParticipation");
const AnonymousBallot = require("../../models/AnonymousBallot");
const Vote = require("../../models/Vote");

const voterRoutes = require("../../routes/voterRoutes");
const requestIdMiddleware = require("../../middleware/requestId");
const errorHandler = require("../../middleware/errorHandler");
const logger = require("../../utils/logger");

const JWT_SECRET = "receipt_authenticity_and_redaction_secret_32chars!";
process.env.JWT_SECRET = JWT_SECRET;

const app = express();
app.use(requestIdMiddleware);
app.use(express.json());
const mockIo = { emit: jest.fn() };
app.set("io", mockIo);

app.use("/api/voter", voterRoutes);
app.use(errorHandler);

describe("PHASE 10: Receipt Authenticity, Decoupling & Log Redaction Suite", () => {
  const voterId = new mongoose.Types.ObjectId().toString();
  const partyId = new mongoose.Types.ObjectId().toString();
  const electionId = new mongoose.Types.ObjectId().toString();
  const validVoterToken = jwt.sign({ id: voterId, role: "voter" }, JWT_SECRET, { expiresIn: "1h" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Ballot Receipt Authenticity & Decoupling Invariants", () => {
    it("returns ONLY server-generated cryptographic commitment and ZERO voter/choice plaintext in receipt", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId, name: "Alice Citizen", email: "alice@voter.com" });
      Party.findById.mockResolvedValue({ _id: partyId, partyName: "Alliance Party" });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      BiometricToken.findOneAndDelete.mockResolvedValue({
        token: "valid_biometric_token_123",
        voterId,
      });

      VoterParticipation.create.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        voterId,
        electionId,
      });

      let insertedBallot = null;
      AnonymousBallot.create.mockImplementation((doc) => {
        insertedBallot = doc;
        return Promise.resolve(doc);
      });

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({
          partyId,
          biometricToken: "valid_biometric_token_123",
        });

      expect(res.status).toBe(200);
      expect(res.body.receipt).toBeDefined();

      // 1. Receipt MUST contain valid 64-char SHA-256 ballot commitment hash
      expect(typeof res.body.receipt.ballotCommitment).toBe("string");
      expect(res.body.receipt.ballotCommitment).toMatch(/^[a-f0-9]{64}$/);

      // 2. Receipt MUST contain electionId and timestamp
      expect(res.body.receipt.electionId).toBe(electionId);
      expect(res.body.receipt.timestamp).toBeDefined();

      // 3. Receipt MUST NEVER contain voter identity or party choice in plaintext
      expect(res.body.receipt.voterId).toBeUndefined();
      expect(res.body.receipt.voterName).toBeUndefined();
      expect(res.body.receipt.email).toBeUndefined();
      expect(res.body.receipt.partyId).toBeUndefined();
      expect(res.body.receipt.partyName).toBeUndefined();

      // 4. AnonymousBallot stored in database contains commitment hash matching receipt
      expect(insertedBallot).toBeDefined();
      expect(insertedBallot.ballotCommitmentHash).toBe(res.body.receipt.ballotCommitment);
    });

    it("strictly blocks receipt issuance when ballot creation fails", async () => {
      Voter.findById.mockResolvedValue({ _id: voterId });
      Party.findById.mockResolvedValue({ _id: partyId });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      VoterParticipation.exists.mockResolvedValue(false);
      Vote.exists.mockResolvedValue(false);

      // Invalid biometric token
      BiometricToken.findOneAndDelete.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/voter/vote")
        .set("Authorization", `Bearer ${validVoterToken}`)
        .send({
          partyId,
          biometricToken: "invalid_or_consumed_token",
        });

      expect(res.status).toBe(400);
      expect(res.body.receipt).toBeUndefined();
      expect(res.body.message).toMatch(/invalid, expired, or previously consumed/i);
    });
  });

  describe("2. Logger Sensitive Data Redaction & Observability Protection", () => {
    it("redacts plain passwords in log metadata", () => {
      const payload = {
        username: "admin_user",
        password: "SuperSecretPassword123!",
        nested: { password: "AnotherSecret" },
      };
      const cleaned = logger.redact(payload);

      expect(cleaned.password).toBe("[REDACTED]");
      expect(cleaned.nested.password).toBe("[REDACTED]");
      expect(cleaned.username).toBe("admin_user");
    });

    it("redacts raw JWT token strings", () => {
      const sampleJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsInJvbGUiOiJ2b3RlciJ9.abc123sign";
      const payload = {
        token: sampleJwt,
        authHeader: `Bearer ${sampleJwt}`,
      };
      const cleaned = logger.redact(payload);

      expect(cleaned.token).toBe("[REDACTED]");
    });

    it("redacts biometric facial float vectors", () => {
      const faceVector = Array(128).fill(0.12345);
      const topLevelCleaned = logger.redact(faceVector);
      expect(topLevelCleaned).toBe("[FLOAT_VECTOR_LENGTH_128]");

      const payload = {
        faceData: faceVector,
        normalArray: [1, 2, 3],
      };
      const cleaned = logger.redact(payload);

      expect(cleaned.faceData).toBe("[FLOAT_VECTOR_LENGTH_128]");
      expect(cleaned.normalArray).toEqual([1, 2, 3]);
    });

    it("redacts biometric tokens and ballot commitments in logs", () => {
      const payload = {
        biometricToken: "secret_token_12345",
        ballotCommitmentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        publicEvent: "BALLOT_CAST",
      };
      const cleaned = logger.redact(payload);

      expect(cleaned.biometricToken).toBe("[REDACTED]");
      expect(cleaned.ballotCommitmentHash).toBe("[REDACTED]");
      expect(cleaned.publicEvent).toBe("BALLOT_CAST");
    });
  });
});
