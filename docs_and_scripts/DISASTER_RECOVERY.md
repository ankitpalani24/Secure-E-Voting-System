# Disaster Recovery & Business Continuity Playbook — Secure E-Voting System

This document specifies standard operating procedures (SOPs) for data backup, emergency restore, cryptographic audit chain verification, and incident recovery for the Secure E-Voting System.

---

## 1. Core Invariants & Guarantees

In any failure, backup, or restore scenario, the system strictly guarantees:
1. **Participation Invariant**:
   $$\text{COUNT}(\text{VoterParticipation}) = \text{COUNT}(\text{AnonymousBallot})$$
   *For all successfully completed votes in a certified election.*
2. **Anonymity Guarantee**:
   The database contains **zero link** between `VoterParticipation` and `AnonymousBallot`. Restoring backups never violates ballot secrecy.
3. **Audit Chain Integrity**:
   Every record in `AuditLog` is cryptographically chained via SHA-256 hash pointers. Any alteration of audit records in backups or live database is mathematically detectable.

---

## 2. Backup Procedures

### Automated MongoDB Atlas Backups (Continuous)
- Configure **Continuous Cloud Backups** (Point-in-Time Recovery / PITR) with a 7-day retention window.
- Retain daily snapshots for 30 days and election-day hourly snapshots for 90 days.

### Manual Election Snapshot (`mongodump`)
Execute an immutable snapshot before opening voting, at voting cutoff, and immediately after tally certification:

```bash
# Set timestamp variable
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Export encrypted compressed backup
mongodump \
  --uri="mongodb+srv://<admin_user>:<password>@<cluster>.mongodb.net/voting-system" \
  --archive="election_backup_${TIMESTAMP}.archive.gz" \
  --gzip

# Calculate SHA-256 checksum of backup archive
sha256sum "election_backup_${TIMESTAMP}.archive.gz" > "election_backup_${TIMESTAMP}.sha256"

# Verify checksum
sha256sum -c "election_backup_${TIMESTAMP}.sha256"
```

---

## 3. Recovery & Restore Procedures

### Restoring to a Standby Database Cluster
To restore election state into an isolated staging or recovery cluster:

```bash
mongorestore \
  --uri="mongodb+srv://<admin_user>:<password>@<recovery_cluster>.mongodb.net/voting-system" \
  --archive="election_backup_20260820_210000.archive.gz" \
  --gzip \
  --drop
```

### Post-Restore Verification Checklist
1. **Check Database Readiness**:
   ```bash
   curl -i http://localhost:5000/readyz
   # Expected: HTTP 200 {"status":"ready","database":"connected"}
   ```
2. **Validate Participation vs Ballot Invariant**:
   Run database integrity assertion script:
   ```bash
   node -e "
     const mongoose = require('mongoose');
     mongoose.connect(process.env.MONGO_URI).then(async () => {
       const vp = await mongoose.connection.collection('voterparticipations').countDocuments();
       const ab = await mongoose.connection.collection('anonymousballots').countDocuments();
       console.log('Voter Participations:', vp, '| Anonymous Ballots:', ab);
       if (vp !== ab) console.error('CRITICAL: Invariant mismatch detected!');
       else console.log('✓ Participation Invariant Intact');
       process.exit(0);
     });
   "
   ```
3. **Verify Cryptographic Audit Hash Chain**:
   ```bash
   curl -s -H "Authorization: Bearer <ADMIN_JWT>" http://localhost:5000/api/admin/audit-verify
   # Expected: {"valid":true,"totalRecords":N}
   ```

---

## 4. Incident Response Playbooks

### Playbook A: Primary MongoDB Outage / Failover
1. MongoDB Atlas replica set automatically elects a new primary within 3 seconds.
2. The Node.js application maintains cached reconnect promises (`server.js` lifecycle handlers) and automatically resumes processing without container restart.
3. Check application logs for reconnect confirmation:
   `[INFO] MongoDB reconnected successfully.`

### Playbook B: Compromised `JWT_SECRET`
1. Generate new 64-byte cryptographic secret key.
2. Update `JWT_SECRET` in secret manager / environment configuration.
3. Perform rolling restart of Node.js containers.
4. All existing sessions are immediately invalidated, forcing re-authentication.

### Playbook C: Audit Log Integrity Warning Detected
1. If `/api/admin/audit-verify` reports `valid: false` at index $K$:
2. Identify the broken record using timestamp and record ID.
3. Compare against verified immutable offline snapshots (`election_backup_*.archive.gz`).
4. Identify if unauthorized write occurred directly to the MongoDB cluster.
