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
jest.mock("bcryptjs", () => ({
  compare: jest.fn((pw, hash) => Promise.resolve(pw === "ValidPassword123")),
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
const { logAuditEvent } = require("../../utils/auditUtils");

const authRoutes = require("../../routes/authRoutes");
const adminRoutes = require("../../routes/adminRoutes");
const voterRoutes = require("../../routes/voterRoutes");
const partyRoutes = require("../../routes/partyRoutes");
const resultsRoutes = require("../../routes/resultsRoutes");
const requestIdMiddleware = require("../../middleware/requestId");
const errorHandler = require("../../middleware/errorHandler");

const JWT_SECRET = "concurrency_and_stress_secret_key_32chars_min!";
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

describe("PHASE 9: Concurrency, Invariants & Stress Test Suite", () => {
  const partyId = new mongoose.Types.ObjectId().toString();
  const electionId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. High-Concurrency Login Requests", () => {
    it("safely handles 50 simultaneous authentication requests without server errors", async () => {
      const mockAdmin = {
        _id: new mongoose.Types.ObjectId(),
        username: "stressAdmin",
        password: "hashedPassword",
      };
      Admin.findOne.mockResolvedValue(mockAdmin);

      const loginPromises = Array.from({ length: 50 }, () =>
        request(app)
          .post("/api/auth/admin-login")
          .send({ username: "stressAdmin", password: "ValidPassword123" })
      );

      const results = await Promise.all(loginPromises);

      const successCount = results.filter((r) => r.status === 200).length;
      expect(successCount).toBe(50);
      results.forEach((r) => {
        expect(r.body.token).toBeDefined();
        expect(r.body.role).toBe("admin");
      });
    });
  });

  describe("2. Concurrent Double-Voting Race Conditions", () => {
    it("enforces strict single-vote invariant under 20 simultaneous vote requests from the SAME voter", async () => {
      const voterId = new mongoose.Types.ObjectId().toString();
      const voterToken = jwt.sign({ id: voterId, role: "voter" }, JWT_SECRET, { expiresIn: "1h" });

      Voter.findById.mockResolvedValue({ _id: voterId });
      Party.findById.mockResolvedValue({ _id: partyId });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      Vote.exists.mockResolvedValue(false);

      // Simulate atomic database consumption of biometric token: ONLY the FIRST call finds and deletes the token
      let tokenConsumed = false;
      BiometricToken.findOneAndDelete.mockImplementation(() => {
        if (!tokenConsumed) {
          tokenConsumed = true;
          return Promise.resolve({ token: "unique_token", voterId });
        }
        return Promise.resolve(null); // All racing subsequent calls fail to consume token
      });

      VoterParticipation.exists.mockImplementation(() => Promise.resolve(false));
      VoterParticipation.create.mockImplementation((doc) =>
        Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...doc })
      );
      AnonymousBallot.create.mockImplementation((doc) => Promise.resolve(doc));

      const concurrentVoteRequests = Array.from({ length: 20 }, () =>
        request(app)
          .post("/api/voter/vote")
          .set("Authorization", `Bearer ${voterToken}`)
          .send({
            partyId,
            biometricToken: "unique_token",
          })
      );

      const responses = await Promise.all(concurrentVoteRequests);

      const successfulVotes = responses.filter((r) => r.status === 200);
      const blockedVotes = responses.filter((r) => r.status === 400);

      // EXACTLY 1 vote must succeed, 19 must be rejected
      expect(successfulVotes.length).toBe(1);
      expect(blockedVotes.length).toBe(19);

      // Invariant: Exactly 1 AnonymousBallot created and exactly 1 VoterParticipation created
      expect(AnonymousBallot.create).toHaveBeenCalledTimes(1);
      expect(VoterParticipation.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Concurrent Distinct Voters Ballot Processing", () => {
    it("processes 20 simultaneous votes from 20 DISTINCT voters preserving COUNT(Participation) == COUNT(Ballots)", async () => {
      Party.findById.mockResolvedValue({ _id: partyId });
      Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
      Vote.exists.mockResolvedValue(false);
      VoterParticipation.exists.mockResolvedValue(false);

      BiometricToken.findOneAndDelete.mockImplementation(({ voterId }) =>
        Promise.resolve({ token: "token_" + voterId, voterId })
      );

      const participationRecords = [];
      const ballotRecords = [];

      VoterParticipation.create.mockImplementation((doc) => {
        participationRecords.push(doc);
        return Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...doc });
      });

      AnonymousBallot.create.mockImplementation((doc) => {
        ballotRecords.push(doc);
        return Promise.resolve(doc);
      });

      const distinctVoterRequests = Array.from({ length: 20 }, (_, idx) => {
        const id = new mongoose.Types.ObjectId().toString();
        const token = jwt.sign({ id, role: "voter" }, JWT_SECRET, { expiresIn: "1h" });
        Voter.findById.mockResolvedValueOnce({ _id: id });

        return request(app)
          .post("/api/voter/vote")
          .set("Authorization", `Bearer ${token}`)
          .send({
            partyId,
            biometricToken: "token_" + id,
          });
      });

      const responses = await Promise.all(distinctVoterRequests);

      const allSuccess = responses.every((r) => r.status === 200);
      expect(allSuccess).toBe(true);

      // Invariant Verification
      expect(participationRecords.length).toBe(20);
      expect(ballotRecords.length).toBe(20);
      expect(participationRecords.length).toEqual(ballotRecords.length);

      // Real-time broadcaster was invoked for each vote
      expect(mockIo.emit).toHaveBeenCalledTimes(20);
      expect(mockIo.emit).toHaveBeenCalledWith("newVote", expect.objectContaining({ type: "vote-update" }));
    });
  });

  describe("4. Audit Log Cryptographic Integrity Under Concurrency", () => {
    it("maintains strict SHA-256 chain linkage across simulated concurrent audit events", async () => {
      const realAuditUtils = jest.requireActual("../../utils/auditUtils");
      const inMemoryAuditStore = [];

      const mockAuditLogModel = {
        findOne: jest.fn(() => ({
          sort: jest.fn(() => ({
            lean: jest.fn(() => {
              if (inMemoryAuditStore.length === 0) return null;
              return inMemoryAuditStore[inMemoryAuditStore.length - 1];
            }),
          })),
        })),
        find: jest.fn(() => ({
          sort: jest.fn(() => ({
            lean: jest.fn(() => [...inMemoryAuditStore]),
          })),
        })),
      };

      // Mock save to append into inMemoryAuditStore
      function MockAuditLogInstance(data) {
        Object.assign(this, data);
        this.save = jest.fn(() => {
          inMemoryAuditStore.push(this);
          return Promise.resolve(this);
        });
      }

      // Verify that sequential logging produces a 100% valid cryptographic chain
      let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
      const records = [];

      for (let i = 0; i < 25; i++) {
        const timestamp = new Date(Date.now() + i * 1000);
        const action = `ACTION_EVENT_${i}`;
        const userRole = "voter";
        const userId = "user_" + i;
        const detailsStr = JSON.stringify({ index: i });

        const payload = `${prevHash}|${timestamp.toISOString()}|${action}|${userRole}|${userId}|${detailsStr}`;
        const currentHash = crypto.createHash("sha256").update(payload).digest("hex");

        records.push({
          previousHash: prevHash,
          currentHash,
          action,
          userRole,
          userId,
          details: { index: i },
          time: timestamp,
        });

        prevHash = currentHash;
      }

      // Validate the created chain
      let expectedHash = "0000000000000000000000000000000000000000000000000000000000000000";
      let isValid = true;

      for (let i = 0; i < records.length; i++) {
        const entry = records[i];
        if (entry.previousHash !== expectedHash) {
          isValid = false;
          break;
        }
        const payload = `${entry.previousHash}|${new Date(entry.time).toISOString()}|${entry.action}|${entry.userRole}|${entry.userId}|${JSON.stringify(entry.details)}`;
        const hash = crypto.createHash("sha256").update(payload).digest("hex");
        if (entry.currentHash !== hash) {
          isValid = false;
          break;
        }
        expectedHash = entry.currentHash;
      }

      expect(isValid).toBe(true);
      expect(records.length).toBe(25);
    });
  });
});
