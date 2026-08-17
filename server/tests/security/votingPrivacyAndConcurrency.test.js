const crypto = require("crypto");
const mongoose = require("mongoose");
const { castVote } = require("../../controllers/voterController");
const Voter = require("../../models/Voter");
const Party = require("../../models/Party");
const Election = require("../../models/Election");
const BiometricToken = require("../../models/BiometricToken");
const VoterParticipation = require("../../models/VoterParticipation");
const AnonymousBallot = require("../../models/AnonymousBallot");
const AuditLog = require("../../models/AuditLog");
const { logAuditEvent } = require("../../utils/auditUtils");

jest.mock("../../models/Voter");
jest.mock("../../models/Party");
jest.mock("../../models/Election");
jest.mock("../../models/BiometricToken");
jest.mock("../../models/VoterParticipation");
jest.mock("../../models/AnonymousBallot");
jest.mock("../../models/AuditLog");
jest.mock("../../models/Vote");
jest.mock("../../utils/auditUtils");

describe("Security Hardening - Voting Privacy, Biometric Enforcement & Concurrency", () => {
  const voterId = new mongoose.Types.ObjectId("65df00000000000000000001");
  const partyId = new mongoose.Types.ObjectId("65df00000000000000000002");
  const electionId = new mongoose.Types.ObjectId("65df00000000000000000003");

  let req, res, mockIo;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIo = {
      emit: jest.fn(),
    };

    req = {
      user: { id: voterId.toString(), role: "voter" },
      body: {},
      ip: "127.0.0.1",
      headers: { "user-agent": "JestTestRunner/1.0" },
      app: {
        get: jest.fn().mockReturnValue(mockIo),
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Default mock behaviors
    Voter.findById.mockResolvedValue({ _id: voterId, name: "Alice", email: "alice@voter" });
    Party.findById.mockResolvedValue({ _id: partyId, partyName: "Alliance", symbol: "⭐" });
    Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
    VoterParticipation.exists.mockResolvedValue(false);
  });

  describe("Mandatory Biometric Token Enforcement", () => {
    test("1. Rejects vote request when biometricToken is missing", async () => {
      req.body = { partyId: partyId.toString() }; // omitted biometricToken

      await castVote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/biometric.*required/i) })
      );
      expect(AnonymousBallot.create).not.toHaveBeenCalled();
    });

    test("2. Rejects vote request when biometricToken is invalid", async () => {
      req.body = { partyId: partyId.toString(), biometricToken: "invalid_fake_token" };
      BiometricToken.findOneAndDelete.mockResolvedValue(null);

      await castVote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/invalid.*expired.*token/i) })
      );
      expect(AnonymousBallot.create).not.toHaveBeenCalled();
    });

    test("3. Rejects vote request when biometricToken is expired", async () => {
      req.body = { partyId: partyId.toString(), biometricToken: "expired_token_123" };
      // findOneAndDelete matches { expiresAt: { $gt: now } }, returning null if expired
      BiometricToken.findOneAndDelete.mockResolvedValue(null);

      await castVote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(AnonymousBallot.create).not.toHaveBeenCalled();
    });

    test("4. Rejects vote request when biometricToken was already consumed (reused)", async () => {
      req.body = { partyId: partyId.toString(), biometricToken: "already_used_token" };
      BiometricToken.findOneAndDelete.mockResolvedValue(null);

      await castVote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(AnonymousBallot.create).not.toHaveBeenCalled();
    });

    test("5. Rejects token belonging to another voter", async () => {
      req.body = { partyId: partyId.toString(), biometricToken: "other_voter_token" };
      // Filter includes voterId: req.user.id, returning null if token belongs to someone else
      BiometricToken.findOneAndDelete.mockResolvedValue(null);

      await castVote(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(AnonymousBallot.create).not.toHaveBeenCalled();
    });

    test("6. Allows vote when biometricToken is cryptographically valid and belongs to voter", async () => {
      req.body = { partyId: partyId.toString(), biometricToken: "valid_secret_token_123" };
      BiometricToken.findOneAndDelete.mockResolvedValue({
        token: "valid_secret_token_123",
        voterId,
        used: false,
      });

      VoterParticipation.create.mockResolvedValue({});
      AnonymousBallot.create.mockResolvedValue({});

      await castVote(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Vote cast successfully!" })
      );
      expect(AnonymousBallot.create).toHaveBeenCalled();
    });
  });

  describe("Audit Log & Ballot Secrecy Verification", () => {
    test("8 & 9. BALLOT_CAST_SUCCESS audit event contains NO ballot commitment and NO partyId", async () => {
      req.body = { partyId: partyId.toString(), biometricToken: "valid_token" };
      BiometricToken.findOneAndDelete.mockResolvedValue({ token: "valid_token", voterId });
      VoterParticipation.create.mockResolvedValue({});
      AnonymousBallot.create.mockResolvedValue({});

      await castVote(req, res);

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "BALLOT_CAST_SUCCESS",
          userId: voterId.toString(),
          details: {
            verificationMethod: "FACE_BIOMETRIC",
          },
        })
      );

      // Verify that logAuditEvent details do NOT contain ballotCommitmentHash or partyId
      const loggedCall = logAuditEvent.mock.calls.find(c => c[0].action === "BALLOT_CAST_SUCCESS");
      expect(loggedCall[0].details.ballotCommitmentHash).toBeUndefined();
      expect(loggedCall[0].details.partyId).toBeUndefined();
      expect(loggedCall[0].details.candidateId).toBeUndefined();
    });
  });

  describe("WebSocket Privacy Verification", () => {
    test("10 & 11. WebSocket 'newVote' broadcast contains NO partyId and NO voterId", async () => {
      req.body = { partyId: partyId.toString(), biometricToken: "valid_token" };
      BiometricToken.findOneAndDelete.mockResolvedValue({ token: "valid_token", voterId });
      VoterParticipation.create.mockResolvedValue({});
      AnonymousBallot.create.mockResolvedValue({});

      await castVote(req, res);

      expect(mockIo.emit).toHaveBeenCalledWith(
        "newVote",
        expect.not.objectContaining({
          partyId: expect.anything(),
          voterId: expect.anything(),
        })
      );

      const emittedPayload = mockIo.emit.mock.calls[0][1];
      expect(emittedPayload.partyId).toBeUndefined();
      expect(emittedPayload.voterId).toBeUndefined();
      expect(emittedPayload.candidateId).toBeUndefined();
      expect(emittedPayload.type).toBe("vote-update");
      expect(emittedPayload.electionId).toEqual(electionId);
    });
  });

  describe("Concurrency & Double-Voting Protection", () => {
    test("7. Handles 20 simultaneous vote requests from the same voter so exactly one succeeds", async () => {
      const totalRequests = 20;
      let firstCompleted = false;

      // Simulate atomic database behavior: First insert succeeds, all subsequent throw duplicate key error 11000
      VoterParticipation.create.mockImplementation(() => {
        if (!firstCompleted) {
          firstCompleted = true;
          return Promise.resolve({});
        }
        const err = new Error("E11000 duplicate key error");
        err.code = 11000;
        return Promise.reject(err);
      });

      BiometricToken.findOneAndDelete.mockResolvedValue({ token: "valid_token", voterId });
      AnonymousBallot.create.mockResolvedValue({});

      const responses = [];
      const requests = Array.from({ length: totalRequests }, () => {
        const reqCopy = { ...req, body: { partyId: partyId.toString(), biometricToken: "valid_token" } };
        const resCopy = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockImplementation(data => responses.push({ status: resCopy.status.mock.calls[0][0], data })),
        };
        return castVote(reqCopy, resCopy);
      });

      await Promise.all(requests);

      const successResponses = responses.filter(r => r.status === 200);
      const rejectedResponses = responses.filter(r => r.status === 400);

      expect(successResponses.length).toBe(1);
      expect(rejectedResponses.length).toBe(19);
      expect(rejectedResponses[0].data.message).toMatch(/already recorded/i);
    });
  });
});
