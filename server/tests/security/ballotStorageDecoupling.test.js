const mongoose = require("mongoose");
const AnonymousBallot = require("../../models/AnonymousBallot");
const VoterParticipation = require("../../models/VoterParticipation");
const Vote = require("../../models/Vote");
const { getResults } = require("../../controllers/resultsController");
const { castVote } = require("../../controllers/voterController");
const Voter = require("../../models/Voter");
const Party = require("../../models/Party");
const Election = require("../../models/Election");
const BiometricToken = require("../../models/BiometricToken");

jest.mock("../../models/Voter");
jest.mock("../../models/Party");
jest.mock("../../models/Election");
jest.mock("../../models/BiometricToken");
jest.mock("../../models/VoterParticipation");
jest.mock("../../models/AnonymousBallot");
jest.mock("../../models/Vote");
jest.mock("../../utils/auditUtils");

describe("Ballot Storage Decoupling & Metadata Anonymization", () => {
  const voter1Id = new mongoose.Types.ObjectId("65df00000000000000000001");
  const voter2Id = new mongoose.Types.ObjectId("65df00000000000000000002");
  const party1Id = new mongoose.Types.ObjectId("65df00000000000000000010");
  const electionId = new mongoose.Types.ObjectId("65df00000000000000000020");

  let req, res, mockIo;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIo = { emit: jest.fn() };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    Voter.findById.mockImplementation((id) =>
      Promise.resolve({ _id: id, name: "Voter", email: "voter@test.com" })
    );
    Party.findById.mockResolvedValue({ _id: party1Id, partyName: "Alliance", symbol: "⭐" });
    Election.findOne.mockResolvedValue({ _id: electionId, phase: "VOTING" });
    VoterParticipation.exists.mockResolvedValue(false);
    Vote.exists.mockResolvedValue(false);
    VoterParticipation.create.mockResolvedValue({});
    AnonymousBallot.create.mockResolvedValue({});
    BiometricToken.findOneAndDelete.mockResolvedValue({ token: "valid_token", voterId: voter1Id });
  });

  describe("AnonymousBallot Schema & Payload Sanitization", () => {
    test("1. AnonymousBallot payload contains NO voterId", async () => {
      req = {
        user: { id: voter1Id.toString(), role: "voter" },
        body: { partyId: party1Id.toString(), biometricToken: "valid_token" },
        ip: "192.168.1.100",
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        app: { get: jest.fn().mockReturnValue(mockIo) },
      };

      await castVote(req, res);

      expect(AnonymousBallot.create).toHaveBeenCalled();
      const ballotPayload = AnonymousBallot.create.mock.calls[0][0];

      expect(ballotPayload.voterId).toBeUndefined();
    });

    test("2. AnonymousBallot payload contains NO IP address or user-agent", async () => {
      req = {
        user: { id: voter1Id.toString(), role: "voter" },
        body: { partyId: party1Id.toString(), biometricToken: "valid_token" },
        ip: "10.0.0.55",
        headers: { "user-agent": "CustomVoterAgent/2.0" },
        app: { get: jest.fn().mockReturnValue(mockIo) },
      };

      await castVote(req, res);

      const ballotPayload = AnonymousBallot.create.mock.calls[0][0];
      expect(ballotPayload.ipAddress).toBeUndefined();
      expect(ballotPayload.ip).toBeUndefined();
      expect(ballotPayload.userAgent).toBeUndefined();
    });

    test("3. AnonymousBallot payload contains NO biometric token", async () => {
      req = {
        user: { id: voter1Id.toString(), role: "voter" },
        body: { partyId: party1Id.toString(), biometricToken: "secret_bio_token_999" },
        ip: "127.0.0.1",
        headers: { "user-agent": "TestRunner" },
        app: { get: jest.fn().mockReturnValue(mockIo) },
      };

      await castVote(req, res);

      const ballotPayload = AnonymousBallot.create.mock.calls[0][0];
      expect(ballotPayload.biometricToken).toBeUndefined();
      expect(ballotPayload.token).toBeUndefined();
    });

    test("4. AnonymousBallot uses cryptographically random UUID primary key (non-sequential)", async () => {
      req = {
        user: { id: voter1Id.toString(), role: "voter" },
        body: { partyId: party1Id.toString(), biometricToken: "valid_token" },
        ip: "127.0.0.1",
        headers: { "user-agent": "TestRunner" },
        app: { get: jest.fn().mockReturnValue(mockIo) },
      };

      await castVote(req, res);

      const ballotPayload = AnonymousBallot.create.mock.calls[0][0];
      expect(ballotPayload._id).toBeDefined();
      // UUID format validation: 8-4-4-4-12 hex string
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(ballotPayload._id).toMatch(uuidRegex);
    });

    test("5. AnonymousBallot omits precise millisecond timestamp (castAt)", async () => {
      req = {
        user: { id: voter1Id.toString(), role: "voter" },
        body: { partyId: party1Id.toString(), biometricToken: "valid_token" },
        ip: "127.0.0.1",
        headers: { "user-agent": "TestRunner" },
        app: { get: jest.fn().mockReturnValue(mockIo) },
      };

      await castVote(req, res);

      const ballotPayload = AnonymousBallot.create.mock.calls[0][0];
      expect(ballotPayload.castAt).toBeUndefined();
      expect(ballotPayload.createdAt).toBeUndefined();
    });
  });

  describe("Multi-Voter Independent Submissions", () => {
    test("6. Allows multiple distinct voters to independently cast anonymous ballots", async () => {
      // Voter 1 casts vote
      const req1 = {
        user: { id: voter1Id.toString(), role: "voter" },
        body: { partyId: party1Id.toString(), biometricToken: "token_voter1" },
        ip: "127.0.0.1",
        headers: { "user-agent": "Agent1" },
        app: { get: jest.fn().mockReturnValue(mockIo) },
      };
      const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

      BiometricToken.findOneAndDelete.mockResolvedValueOnce({ token: "token_voter1", voterId: voter1Id });
      await castVote(req1, res1);
      expect(res1.status).toHaveBeenCalledWith(200);

      // Voter 2 casts vote
      const req2 = {
        user: { id: voter2Id.toString(), role: "voter" },
        body: { partyId: party1Id.toString(), biometricToken: "token_voter2" },
        ip: "127.0.0.2",
        headers: { "user-agent": "Agent2" },
        app: { get: jest.fn().mockReturnValue(mockIo) },
      };
      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

      BiometricToken.findOneAndDelete.mockResolvedValueOnce({ token: "token_voter2", voterId: voter2Id });
      await castVote(req2, res2);
      expect(res2.status).toHaveBeenCalledWith(200);

      expect(VoterParticipation.create).toHaveBeenCalledTimes(2);
      expect(AnonymousBallot.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("Tally Correctness from Decoupled Ballots", () => {
    test("7. Aggregation pipeline correctly tallies votes from AnonymousBallot", async () => {
      const mockPipelineResults = [
        { partyId: party1Id, partyName: "Alliance", symbol: "⭐", totalVotes: 42 },
      ];

      AnonymousBallot.countDocuments = jest.fn().mockResolvedValue(42);
      AnonymousBallot.aggregate = jest.fn().mockResolvedValue(mockPipelineResults);

      const reqQuery = { query: {} };
      const resResult = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

      await getResults(reqQuery, resResult);

      expect(resResult.json).toHaveBeenCalledWith(mockPipelineResults);
    });
  });
});
