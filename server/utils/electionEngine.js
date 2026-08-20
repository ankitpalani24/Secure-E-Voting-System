/**
 * ==============================================================================
 * SECURE E-VOTING SYSTEM — ELECTION OPERATIONS ENGINE
 * ==============================================================================
 * Centralized state machine, date boundary enforcement, and validation rules
 * for institutional election lifecycles.
 * ==============================================================================
 */

const ELECTION_PHASES = Object.freeze({
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  VOTING: "VOTING",
  CLOSED: "CLOSED",
  RESULTS_PUBLISHED: "RESULTS_PUBLISHED",
  ARCHIVED: "ARCHIVED",
});

/**
 * Deterministic State Transition Matrix.
 * Disallows arbitrary or backward state jumps (e.g. VOTING -> DRAFT or RESULTS_PUBLISHED -> VOTING).
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  [ELECTION_PHASES.DRAFT]: [ELECTION_PHASES.SCHEDULED, ELECTION_PHASES.ARCHIVED],
  [ELECTION_PHASES.SCHEDULED]: [ELECTION_PHASES.VOTING, ELECTION_PHASES.DRAFT, ELECTION_PHASES.ARCHIVED],
  [ELECTION_PHASES.VOTING]: [ELECTION_PHASES.CLOSED],
  [ELECTION_PHASES.CLOSED]: [ELECTION_PHASES.RESULTS_PUBLISHED, ELECTION_PHASES.ARCHIVED],
  [ELECTION_PHASES.RESULTS_PUBLISHED]: [ELECTION_PHASES.ARCHIVED],
  [ELECTION_PHASES.ARCHIVED]: [],
});

/**
 * Validates whether a state transition is permissible.
 * @param {string} currentPhase
 * @param {string} targetPhase
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePhaseTransition(currentPhase, targetPhase) {
  if (!Object.values(ELECTION_PHASES).includes(targetPhase)) {
    return {
      valid: false,
      error: `Invalid target phase: '${targetPhase}'. Allowed phases: ${Object.values(ELECTION_PHASES).join(", ")}`,
    };
  }

  if (currentPhase === targetPhase) {
    return { valid: true };
  }

  const allowedTargets = ALLOWED_TRANSITIONS[currentPhase] || [];
  if (!allowedTargets.includes(targetPhase)) {
    return {
      valid: false,
      error: `Illegal state transition from '${currentPhase}' to '${targetPhase}'. Permissible next phases: [${allowedTargets.join(", ") || "NONE"}]`,
    };
  }

  return { valid: true };
}

/**
 * Validates election start and end dates.
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateElectionDates(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return { valid: false, error: "Invalid start date format" };
  }
  if (isNaN(end.getTime())) {
    return { valid: false, error: "Invalid end date format" };
  }
  if (end <= start) {
    return { valid: false, error: "Election end date must be strictly after the start date" };
  }

  return { valid: true };
}

/**
 * Authoritative Server-Side Voting Window Enforcement.
 * Checks whether voting is permitted at this exact server timestamp.
 * 
 * @param {Object} election
 * @param {Date} [now=new Date()]
 * @returns {{ allowed: boolean, reason?: string }}
 */
function isVotingAllowed(election, now = new Date()) {
  if (!election) {
    return { allowed: false, reason: "No active election found" };
  }

  if (election.phase !== ELECTION_PHASES.VOTING) {
    return {
      allowed: false,
      reason: `Voting is currently prohibited. Election is in '${election.phase}' phase.`,
    };
  }

  const currentTime = now.getTime();
  const startTime = new Date(election.startDate).getTime();
  const endTime = new Date(election.endDate).getTime();

  if (currentTime < startTime) {
    return {
      allowed: false,
      reason: `Voting window has not opened yet. Scheduled to open at ${new Date(election.startDate).toISOString()}`,
    };
  }

  if (currentTime >= endTime) {
    return {
      allowed: false,
      reason: `Voting window has concluded. Closed at ${new Date(election.endDate).toISOString()}`,
    };
  }

  return { allowed: true };
}

/**
 * Evaluates whether election results may be viewed by non-admin participants.
 * @param {Object} election
 * @param {string} userRole
 * @returns {boolean}
 */
function canViewResults(election, userRole) {
  if (userRole === "admin") return true;
  if (!election) return true;
  // If election explicitly embargoes live tally (publishLiveTally === false)
  if (election.publishLiveTally === false) {
    return (
      election.phase === ELECTION_PHASES.RESULTS_PUBLISHED ||
      election.phase === ELECTION_PHASES.CLOSED ||
      election.phase === ELECTION_PHASES.ARCHIVED
    );
  }
  return true;
}

module.exports = {
  ELECTION_PHASES,
  ALLOWED_TRANSITIONS,
  validatePhaseTransition,
  validateElectionDates,
  isVotingAllowed,
  canViewResults,
};
