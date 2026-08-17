<p align="center">
  <img src="client/pics/ballot.png" alt="Secure E-Voting System" width="80"/>
</p>

<h1 align="center">🗳️ Secure E-Voting System (Enterprise Civic Edition)</h1>

<p align="center">
  <b>A full-stack, biometric-secured electronic voting and electoral management platform featuring decoupled anonymous ballot storage, single-use authorization tokens, linear hash-chained audit logging, and role-based portals.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express-v5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT"/>
  <img src="https://img.shields.io/badge/Face_API.js-Biometrics-FF6F61?style=for-the-badge" alt="Face API"/>
  <img src="https://img.shields.io/badge/Jest-48_Passed-success?style=for-the-badge&logo=jest&logoColor=white" alt="Jest Tests"/>
</p>

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Installation & Setup](#4-installation--setup)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema & Integrity](#6-database-schema--integrity)
7. [Running the Backend & Frontend](#7-running-the-backend--frontend)
8. [User Roles & Access Control](#8-user-roles--access-control)
9. [Voting Workflow (4-Step Chamber)](#9-voting-workflow-4-step-chamber)
10. [Biometric Verification & Liveness Flow](#10-biometric-verification--liveness-flow)
11. [Security Architecture & Protections](#11-security-architecture--protections)
12. [Privacy & Decoupled Storage Model](#12-privacy--decoupled-storage-model)
13. [API Route Specifications](#13-api-route-specifications)
14. [Automated Testing Suite](#14-automated-testing-suite)
15. [Known Limitations & Security Realities](#15-known-limitations--security-realities)
16. [Production Deployment Checklist](#16-production-deployment-checklist)
17. [License](#17-license)

---

## 1. Project Overview

The **Secure E-Voting System (SEVS)** is a digital electoral platform engineered for institutional democratic integrity, strict ballot privacy, and public trust. It addresses the fundamental vulnerability of electronic voting: preventing coercion and double voting while guaranteeing that cast ballots cannot be correlated back to the voters who cast them.

Key engineering pillars:
- **Decoupled Physical Storage:** Separates the authenticated voter participation log from the physical anonymous ballot repository.
- **Mandatory Single-Use Biometric Authorization:** Enforces 128-dimensional facial embedding matching before issuing a short-lived cryptographic authorization token.
- **Immutable Linear Hash Chaining:** Chains administrative and security audit events via SHA-256 to guarantee tamper evidence.
- **Enterprise Olive Civic Design System:** Clean, accessible (WCAG 2.1 AA) UI built in vanilla HTML5, CSS3, and JavaScript with responsive mobile-to-card transformations.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                           CLIENT BROWSER                               │
│                                                                        │
│   ┌───────────────┐     ┌─────────────────────┐     ┌──────────────┐   │
│   │  Auth Gateway │     │  Electoral Admin    │     │ Citizen Vote │   │
│   │  login.html   │     │  Dashboard / Roll   │     │ v-vote.html  │   │
│   └───────┬───────┘     └──────────┬──────────┘     └──────┬───────┘   │
│           │                        │                       │           │
│           └────────────────────────┴───────────────────────┘           │
│                                    │                                   │
│                        face-api.js (Local AI Models)                   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS REST / WebSocket
┌────────────────────────────────────┴───────────────────────────────────┐
│                          EXPRESS SERVER                                │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Security Middleware: Helmet, CORS, RateLimiting, JWT & RBAC    │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    │                                   │
│   ┌────────────────────┬───────────┴───────────┬───────────────────┐   │
│   │ Auth Controller    │ Admin Controller      │ Voter Controller  │   │
│   │ Login & JWT claims │ Roll, Audit & Slates  │ Verify & Decouple │   │
│   └────────────────────┴───────────┬───────────┴───────────────────┘   │
│                                    │                                   │
│   ┌────────────────────────────────┴───────────────────────────────┐   │
│   │ SHA-256 Chained Audit Utils & Socket.IO Sanitized Broadcaster  │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │ Mongoose ORM
┌────────────────────────────────────┴───────────────────────────────────┐
│                       DATABASE ISOLATION BOUNDARY                      │
│                                                                        │
│   [Voter Registry]         [VoterParticipation]       [AnonymousBallot]│
│   - voterId                - voterId                  - _id (UUIDv4)   │
│   - password (bcrypt)      - electionId               - electionId     │
│   - faceDescriptor (128-d) - participatedAt (hourly)  - partyId        │
│                            - ZERO partyId             - ZERO voterId   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

- **Backend:** Node.js (v18+ LTS), Express.js v5, Mongoose v9, Socket.io, jsonwebtoken, bcryptjs, crypto.
- **Frontend:** Vanilla HTML5, CSS3 Custom Tokens, Vanilla JavaScript, Chart.js v4.4, face-api.js (SSD MobileNet v1), Font Awesome v6.
- **Testing:** Jest, Supertest.
- **Database:** MongoDB Atlas / Local MongoDB 6.0+ instance.

---

## 4. Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/ankitpalani24/Secure-E-Voting-System.git
   cd Secure-E-Voting-System
   ```

2. **Install Root & Server Dependencies:**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Configure Environment Variables:**
   ```bash
   cp server/.env.example server/.env
   ```

---

## 5. Environment Variables

In `server/.env`:
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/voting-system?retryWrites=true&w=majority
JWT_SECRET=production_grade_random_secret_string_minimum_32_characters
```

---

## 6. Database Schema & Integrity

### Collections & Privacy Isolation
1. **`Voter`:** `{ name, email, password, voterId, faceDescriptor: [Float32 x 128] }`
2. **`VoterParticipation`:** `{ voterId, electionId, participatedAt, verificationMethod }`
   - *Constraint:* Compound unique index `{ voterId: 1, electionId: 1 }` guarantees atomic exactly-once voting. Contains ZERO choice data.
3. **`AnonymousBallot`:** `{ _id: UUIDv4, electionId, partyId, candidateId, ballotCommitmentHash }`
   - *Constraint:* Non-sequential UUIDv4 primary keys. Contains ZERO voter identity and NO fine-grained timestamps.
4. **`BiometricToken`:** `{ token, voterId, electionId, used, expiresAt }`
   - *Constraint:* Valid for 5 minutes, single-use, deleted atomically via `findOneAndDelete` upon vote casting.
5. **`AuditLog`:** `{ action, category, userId, userRole, status, currentHash, previousHash, time }`
   - *Constraint:* Linear SHA-256 hash chaining `currentHash = SHA256(previousHash + payload)`.

---

## 7. Running the Backend & Frontend

### Start the Application
```bash
cd server
npm start
```
- API & Static Frontend served at: `http://localhost:5000`
- Access Gateway: `http://localhost:5000/client/index.html`

---

## 8. User Roles & Access Control

| Role | Default Access Route | Authorized Operations |
|---|---|---|
| **Admin** | `client/admin/dashboard/dashboard.html` | Register voters & parties, query voter rolls, monitor audit ledger, verify hash chains, inspect live analytics. |
| **Voter** | `client/voter-dashboard/v-dashboard.html` | Inspect eligibility status, select party slate, perform facial liveness verification, commit anonymous ballot, receive cryptographic receipt. |
| **Party** | `client/party-dashboard/p-parties.html` | Inspect certified candidate slates and observe aggregated vote counts. |

---

## 9. Voting Workflow (4-Step Chamber)

```
01 SELECT PARTY        → Citizen browses accredited party slates and selects candidate.
02 REVIEW CHOICE       → Confirms selection with permanent-action disclosure modal.
03 FACE VERIFICATION   → Camera initializes, tracks liveness gesture, verifies 128-d Euclidean distance (<0.55), and receives 5-minute single-use biometricToken.
04 CRYPTOGRAPHIC SEAL  → Server consumes token atomically, commits decoupled AnonymousBallot, logs participation, and returns SHA-256 commitment receipt.
```

---

## 10. Biometric Verification & Liveness Flow

1. **Model Initialization:** `face-api.js` loads SSD MobileNet, 68-point landmarks, and recognition weights asynchronously without freezing UI threads.
2. **Liveness Gesture Check:** Random challenge (`turn_left`, `turn_right`, `look_up`, `look_down`) checked over multi-frame baseline offsets.
3. **Euclidean Matching:**
   $$d(u, v) = \sqrt{\sum_{i=1}^{128} (u_i - v_i)^2} < 0.55$$
4. **Token Issuance:** Single-use 256-bit cryptographically random token issued with a 5-minute TTL.

---

## 11. Security Architecture & Protections

- **Helmet Security Headers:** Content security and cross-origin resource policy.
- **Express Rate Limiting:** Brute-force throttling on auth endpoints.
- **Bcrypt Password Salt:** 10 rounds of cryptographic salting.
- **Double Voting Concurrency:** Database-level compound unique index prevents race-condition double submissions.
- **WebSocket Privacy:** Real-time events broadcast `{ type: "vote-update", electionId }` without disclosing voter or choice identifiers.

---

## 12. Privacy & Decoupled Storage Model

The physical storage of participation records is strictly severed from ballot commitments:
$$\text{Voter Identity} \longrightarrow \text{VoterParticipation (Hourly Epoch)} \quad\centernot\longleftrightarrow\quad \text{AnonymousBallot (UUIDv4)} \longrightarrow \text{Party Choice}$$

---

## 13. API Route Specifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/admin-login` | Public | Authenticates administrator and returns JWT. |
| `POST` | `/api/auth/voter-login` | Public | Authenticates citizen voter and returns JWT. |
| `POST` | `/api/auth/party-login` | Public | Authenticates party observer and returns JWT. |
| `GET` | `/api/admin/stats` | Admin | Returns aggregate dashboard metrics. |
| `GET` | `/api/admin/voters` | Admin | Returns electoral roll with voting participation flags. |
| `POST` | `/api/admin/add-voter` | Admin | Registers citizen with 128-d biometric descriptor. |
| `GET` | `/api/admin/parties` | Admin | Returns list of registered political parties. |
| `POST` | `/api/admin/add-party` | Admin | Accredits candidate slate with symbol and credentials. |
| `GET` | `/api/admin/audit-logs` | Admin | Queries paginated immutable audit records. |
| `GET` | `/api/admin/audit-verify` | Admin | Verifies sequential linear SHA-256 hash chains. |
| `GET` | `/api/voter/profile` | Voter | Returns voter identity and participation status. |
| `GET` | `/api/party` | Voter/Party | Returns accredited candidate list. |
| `POST` | `/api/voter/face-verify` | Voter | Validates biometrics and issues `biometricToken`. |
| `POST` | `/api/voter/vote` | Voter | Consumes `biometricToken` and records `AnonymousBallot`. |
| `GET` | `/api/results` | Authenticated | Aggregates certified tallies from `AnonymousBallot`. |

---

## 14. Automated Testing Suite

Execute the automated integration and security suite:
```bash
cd server
npm test
```
**Current Test Baseline:** 48/48 Passing across 6 test suites (`acceptanceE2E`, `ballotStorageDecoupling`, `votingPrivacyAndConcurrency`, `authAndPrivacy`, `faceUtils`, `auditUtils`).

---

## 15. Known Limitations & Security Realities

- **Client-Side Liveness:** Browser-based face tracking using webcams cannot substitute for tamper-resistant hardware biometrics or secure enclaves.
- **Server Authority Trust:** Privacy separation relies on operational database server security. If the underlying MongoDB host is compromised during the millisecond of insertion, timing correlation could occur.
- **Absence of Multi-Party Cryptography:** The current system does not implement multi-authority threshold decryption (MPC) or zero-knowledge range proofs (ZKP). It is intended for civic institutions, universities, and enterprise governance, not national sovereign elections.

---

## 16. Production Deployment Checklist

1. [ ] Enforce HTTPS / TLS 1.3 on all inbound web and WebSocket connections.
2. [ ] Inject cryptographically random `JWT_SECRET` via cloud secret manager (AWS Secrets Manager / Doppler).
3. [ ] Configure MongoDB Atlas VPC peering or IP Access Lists.
4. [ ] Enable automated database replica set backups with point-in-time recovery.
5. [ ] Establish structured logging to an immutable external syslog / SIEM.

---

## 17. License

This project is licensed under the [MIT License](LICENSE).
