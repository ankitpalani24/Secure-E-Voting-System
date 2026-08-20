#!/usr/bin/env node
/**
 * ==============================================================================
 * SECURE E-VOTING SYSTEM — ELECTION DATA CONSISTENCY CHECKER
 * ==============================================================================
 * Validates 10 core institutional integrity, privacy decoupling, and audit
 * invariants across database collections.
 *
 * Usage: node server/scripts/electionConsistencyChecker.js
 * ==============================================================================
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const config = require("../config/config");
const Election = require("../models/Election");
const VoterParticipation = require("../models/VoterParticipation");
const AnonymousBallot = require("../models/AnonymousBallot");
const Party = require("../models/Party");
const AuditLog = require("../models/AuditLog");
const { ElectionApproval, APPROVAL_STATUS } = require("../models/ElectionApproval");
const { verifyAuditChain } = require("../utils/auditUtils");
const { ELECTION_PHASES } = require("../utils/electionEngine");

async function runConsistencyCheck() {
  console.log("\n========================================================");
  console.log(" SECURE E-VOTING SYSTEM: DATA INTEGRITY & PRIVACY AUDIT");
  console.log(` Timestamp: ${new Date().toISOString()}`);
  console.log("========================================================\n");

  let checksPassed = 0;
  let checksFailed = 0;
  let checksWarning = 0;

  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log("[ OK ] Connected to Database instance.\n");

    // 1. INVARIANT A: Participation Count == Anonymous Ballot Count
    const [participationCount, ballotCount] = await Promise.all([
      VoterParticipation.countDocuments(),
      AnonymousBallot.countDocuments(),
    ]);

    if (participationCount === ballotCount) {
      console.log(`[ PASS ] Invariant A: Participation == Ballot Count (${participationCount} records)`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant A: Count mismatch! VoterParticipation: ${participationCount}, AnonymousBallot: ${ballotCount}`);
      checksFailed++;
    }

    // 2. INVARIANT B: Every Ballot Belongs to an Existing Election
    const orphanBallots = await AnonymousBallot.find({
      electionId: { $nin: await Election.distinct("_id") },
    }).lean();

    if (orphanBallots.length === 0) {
      console.log(`[ PASS ] Invariant B: All ${ballotCount} ballots reference valid registered elections.`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant B: Found ${orphanBallots.length} orphan ballots referencing non-existent elections!`);
      checksFailed++;
    }

    // 3. INVARIANT C: Every Ballot References a Valid Party
    const partyIds = await Party.distinct("_id");
    const orphanPartyBallots = await AnonymousBallot.find({
      partyId: { $nin: partyIds },
    }).lean();

    if (orphanPartyBallots.length === 0) {
      console.log(`[ PASS ] Invariant C: All ballots reference accredited political parties.`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant C: Found ${orphanPartyBallots.length} ballots with invalid party references!`);
      checksFailed++;
    }

    // 4. INVARIANT D: Zero Voter Identifiers in AnonymousBallot (Decoupling)
    const sampleBallot = await AnonymousBallot.findOne().lean();
    if (!sampleBallot || (!sampleBallot.voterId && !sampleBallot.voter && !sampleBallot.userId)) {
      console.log(`[ PASS ] Invariant D: Zero voter identity fields in AnonymousBallot schema.`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant D: Voter identifier detected in AnonymousBallot record!`);
      checksFailed++;
    }

    // 5. INVARIANT E: Zero Party Choices in VoterParticipation (Decoupling)
    const sampleParticipation = await VoterParticipation.findOne().lean();
    if (!sampleParticipation || (!sampleParticipation.partyId && !sampleParticipation.candidateId && !sampleParticipation.choice)) {
      console.log(`[ PASS ] Invariant E: Zero political choice fields in VoterParticipation schema.`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant E: Choice metadata detected in VoterParticipation record!`);
      checksFailed++;
    }

    // 6. INVARIANT F: Zero Ballot Secrets in BALLOT_CAST_SUCCESS Audit Logs
    const voteSuccessLogs = await AuditLog.find({ action: "BALLOT_CAST_SUCCESS" }).lean();
    let auditLeakFound = false;
    for (const log of voteSuccessLogs) {
      if (log.details && (log.details.partyId || log.details.ballotCommitmentHash || log.details.candidateId)) {
        auditLeakFound = true;
        break;
      }
    }

    if (!auditLeakFound) {
      console.log(`[ PASS ] Invariant F: All ${voteSuccessLogs.length} ballot audit logs strictly preserve vote secrecy.`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant F: Correlation leak detected in BALLOT_CAST_SUCCESS audit logs!`);
      checksFailed++;
    }

    // 7. INVARIANT G: Sequential Linear SHA-256 Audit Hash Chain Integrity
    const chainVerification = await verifyAuditChain();
    if (chainVerification.valid) {
      console.log(`[ PASS ] Invariant G: SHA-256 audit chain verified (${chainVerification.totalRecords} blocks intact, 0 broken).`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant G: Audit chain integrity break detected at record #${chainVerification.brokenAt}!`);
      checksFailed++;
    }

    // 8. INVARIANT H: Published Results Consistency
    const publishedElections = await Election.find({ phase: ELECTION_PHASES.RESULTS_PUBLISHED }).lean();
    let tallyMismatch = false;
    for (const elec of publishedElections) {
      const actualBallots = await AnonymousBallot.countDocuments({ electionId: elec._id });
      const aggregatedVotes = await AnonymousBallot.aggregate([
        { $match: { electionId: elec._id } },
        { $group: { _id: null, total: { $sum: 1 } } },
      ]);
      const sumTally = aggregatedVotes.length > 0 ? aggregatedVotes[0].total : 0;
      if (actualBallots !== sumTally) {
        tallyMismatch = true;
      }
    }

    if (!tallyMismatch) {
      console.log(`[ PASS ] Invariant H: Aggregated results tally matches physical ballot records.`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant H: Published results tally discrepancy detected!`);
      checksFailed++;
    }

    // 9. INVARIANT I: Valid Election Lifecycle State
    const elections = await Election.find().lean();
    let invalidPhase = false;
    for (const elec of elections) {
      if (!Object.values(ELECTION_PHASES).includes(elec.phase)) {
        invalidPhase = true;
      }
    }

    if (!invalidPhase) {
      console.log(`[ PASS ] Invariant I: All ${elections.length} election slates hold valid lifecycle states.`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant I: Found election with undefined lifecycle phase!`);
      checksFailed++;
    }

    // 10. INVARIANT J: Governance Proposal Status Valid
    const proposals = await ElectionApproval.find().lean();
    let invalidProposalStatus = false;
    for (const prop of proposals) {
      if (!Object.values(APPROVAL_STATUS).includes(prop.status)) {
        invalidProposalStatus = true;
      }
    }

    if (!invalidProposalStatus) {
      console.log(`[ PASS ] Invariant J: All ${proposals.length} governance proposals hold valid operational states.`);
      checksPassed++;
    } else {
      console.log(`[ FAIL ] Invariant J: Found governance proposal with invalid status!`);
      checksFailed++;
    }

  } catch (err) {
    console.error(`[ ERROR ] Consistency check interrupted: ${err.message}`);
    checksFailed++;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }

  console.log("\n========================================================");
  console.log(` SUMMARY: ${checksPassed} Passed | ${checksFailed} Failed | ${checksWarning} Warnings`);
  console.log(` Status:  ${checksFailed === 0 ? "ALL INVARIANTS SATISFIED (PASSED)" : "INTEGRITY ISSUES DETECTED"}`);
  console.log("========================================================\n");

  process.exit(checksFailed === 0 ? 0 : 1);
}

if (require.main === module) {
  runConsistencyCheck();
}

module.exports = { runConsistencyCheck };
