# Disaster Recovery & Operational Integrity Drill Handbook

## 1. Objective & Scope

This operational handbook defines the protocols for disaster recovery, high-availability failover, and cryptographic tamper response for the **Secure Online E-Voting System (SEVS)**.

---

## 2. Invariant Disaster Recovery Rules

1. **Ballot Decoupling Preservation:**
   - Any database recovery operation must preserve the strict physical decoupling between `VoterParticipation` and `AnonymousBallot`.
   - Never merge participation timestamps with anonymous ballot records during restoration.

2. **Sequential Audit Hash Chain Integrity:**
   - Restored ledgers must be verified using `node server/scripts/electionConsistencyChecker.js` or `GET /api/admin/audit-verify`.
   - Any gap in `previousHash` $\rightarrow$ `currentHash` linkage marks the ledger as compromised.

3. **Two-Person Governance Authorization:**
   - Post-recovery election resumption (e.g. unlocking from `EMERGENCY_LOCK` or re-opening a voting window) strictly requires dual-officer approval via `/api/admin/proposals`.

---

## 3. Disaster Scenarios & Recovery Sequences

### Scenario A: Backend Node Crash / Process Termination
- **Detection:** `/healthz` fails to respond; process monitoring daemon signals crash.
- **Recovery:**
  1. Process manager (Docker / systemd) restarts container.
  2. `/readyz` probe performs MongoDB connection handshake and replica set health check.
  3. Active election states in MongoDB survive unchanged.

### Scenario B: Database Replica Set Primary Failover
- **Detection:** Active database driver receives disconnect; `/readyz` returns `503 Service Unavailable`.
- **Recovery:**
  1. MongoDB Atlas / Replica Set automatically elects a new Primary.
  2. Mongoose driver reconnects with exponential backoff.
  3. Transactions in flight roll back cleanly via atomic unique index constraints.

### Scenario C: Audit Chain Tampering Detected
- **Detection:** Automated probe `GET /api/admin/audit-verify` or `npm run consistency-check` returns `valid: false` with `brokenAt` index.
- **Response:**
  1. System triggers immediate `EMERGENCY_LOCK`.
  2. Auditor surveillance portal highlights the exact broken record index.
  3. Compare against offsite immutable append-only syslog backup.

---

## 4. Cold Restoration Protocol

1. **Restore Point-in-Time Database Backup:**
   ```bash
   mongorestore --uri="$MONGO_URI" --drop /path/to/backup/
   ```
2. **Execute Invariant Verification Probe:**
   ```bash
   npm run consistency-check
   ```
3. **Execute Production Smoke Test Probe:**
   ```bash
   npm run smoke-test
   ```
4. **Authorize Slate Resumption:**
   - Admin A creates `EMERGENCY_UNLOCK` proposal.
   - Admin B authorizes proposal.
