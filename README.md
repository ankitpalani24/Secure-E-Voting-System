<p align="center">
  <img src="client/pics/ballot.png" alt="Secure E-Voting System" width="80"/>
</p>

<h1 align="center">🗳️ Secure E-Voting System (Institutional Civic Edition)</h1>

<p align="center">
  <b>An institutional-grade, biometric-secured electronic voting and electoral operations platform featuring decoupled anonymous ballot storage, strict election lifecycle state machines, server-side voting window enforcement, linear hash-chained audit logging, and responsive multi-device portals.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express-v5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT"/>
  <img src="https://img.shields.io/badge/Jest-114_Passed_(13_Suites)-success?style=for-the-badge&logo=jest&logoColor=white" alt="Jest Tests"/>
  <img src="https://img.shields.io/badge/Smoke_Test-6%2F6_Passed-success?style=for-the-badge" alt="Smoke Test"/>
  <img src="https://img.shields.io/badge/Security-0_Vulnerabilities-success?style=for-the-badge" alt="npm audit"/>
</p>

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Election Lifecycle Operations Engine](#3-election-lifecycle-operations-engine)
4. [Technology Stack](#4-technology-stack)
5. [Installation & Setup](#5-installation--setup)
6. [Environment Variables](#6-environment-variables)
7. [Database Schema & Privacy Isolation](#7-database-schema--privacy-isolation)
8. [Multi-Device Responsive Design System](#8-multi-device-responsive-design-system)
9. [User Roles & Access Control](#9-user-roles--access-control)
10. [Voting Workflow (4-Step Chamber)](#10-voting-workflow-4-step-chamber)
11. [Biometric Architecture & Extension Roadmap](#11-biometric-architecture--extension-roadmap)
12. [Security Architecture & Integrity Hardening](#12-security-architecture--integrity-hardening)
13. [API Route Specifications](#13-api-route-specifications)
14. [Automated Testing & Smoke Verification](#14-automated-testing--smoke-verification)
15. [Production Deployment & Observability](#15-production-deployment--observability)
16. [Known Limitations & Security Realities](#16-known-limitations--security-realities)
17. [License](#17-license)

---

## 1. Project Overview

The **Secure E-Voting System (SEVS)** is a digital electoral platform engineered for institutional democratic integrity, strict ballot privacy, and public trust. It addresses the fundamental vulnerability of electronic voting: preventing coercion and double voting while guaranteeing that cast ballots cannot be correlated back to the voters who cast them.

### Core Architectural Pillars:
- **Decoupled Physical Storage:** Strictly severs voter identity from physical ballot choices.
- **Controlled Election Lifecycle:** Strict server-enforced state machine (`DRAFT` $\rightarrow$ `SCHEDULED` $\rightarrow$ `VOTING` $\rightarrow$ `CLOSED` $\rightarrow$ `RESULTS_PUBLISHED` $\rightarrow$ `ARCHIVED`).
- **Authoritative Server-Side Voting Window:** Rejects votes cast before `startDate` or after `endDate` regardless of client clocks.
- **Result Publication Barrier:** Embargoes tallies to non-administrators until voting concludes and certified results are published.
- **BiometricProvider Abstraction:** Pluggable identity verification layer supporting browser facial embeddings, FIDO2/WebAuthn, and hardware kiosks.
- **Immutable Linear Hash Chaining:** SHA-256 chained security ledger providing tamper evidence for all administrative operations.
- **Universal Multi-Device Responsiveness:** Fully responsive interface tailored for smartphones (320px+), tablets, laptops, and widescreen monitors.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RESPONSIVE CLIENT PORTALS                       │
│  (Smartphones 320px+  •  Tablets 768px  •  Laptops  •  Desktops)       │
│                                                                        │
│   ┌───────────────┐     ┌─────────────────────┐     ┌──────────────┐   │
│   │  Auth Gateway │     │  Election Ops Center│     │ Citizen Vote │   │
│   │  login.html   │     │  Dashboard & Roll   │     │ v-vote.html  │   │
│   └───────┬───────┘     └──────────┬──────────┘     └──────┬───────┘   │
│           │                        │                       │           │
│           └────────────────────────┼───────────────────────┘           │
│                                    │                                   │
│                        face-api.js (Local AI Models)                   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS REST / Secure WebSocket
┌────────────────────────────────────┴───────────────────────────────────┐
│                      EXPRESS BACKEND ENGINE                            │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Security Guard: Helmet (CSP), Rate Limiting, Request Tracking  │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    │                                   │
│   ┌────────────────────┬───────────┴───────────┬───────────────────┐   │
│   │ Auth Controller    │ Admin Controller      │ Voter Controller  │   │
│   │ Login & JWT claims │ Ops Center & Audit    │ Window & Ballot   │   │
│   └────────────────────┴───────────┬───────────┴───────────────────┘   │
│                                    │                                   │
│   ┌────────────────────────────────┴───────────────────────────────┐   │
│   │ Election Lifecycle Engine  •  BiometricProvider Abstraction    │   │
│   │ SHA-256 Audit Chaining     •  Socket.IO Live Event Broadcaster │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │ Mongoose Connection Pool
┌────────────────────────────────────┴───────────────────────────────────┐
│                      DATABASE ISOLATION BOUNDARY                       │
│                                                                        │
│   [Voter Registry]         [VoterParticipation]       [AnonymousBallot]│
│   - voterId                - voterId                  - _id (UUIDv4)   │
│   - password (bcrypt)      - electionId               - electionId     │
│   - faceDescriptor (128-d) - participatedAt (hourly)  - partyId        │
│                            - ZERO partyId             - ZERO voterId   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Election Lifecycle Operations Engine

Elections transition through an explicit, deterministic state machine enforced server-side:

```
  ┌───────────┐
  │   DRAFT   │
  └─────┬─────┘
        │ Schedule Dates
        ▼
  ┌───────────┐
  │ SCHEDULED │
  └─────┬─────┘
        │ Open Window
        ▼
  ┌───────────┐
  │  VOTING   │ ──(Ballot casting active; Public results embargoed)
  └─────┬─────┘
        │ Conclude Window
        ▼
  ┌───────────┐
  │  CLOSED   │ ──(Ballot casting disabled; Tally certified by Admin)
  └─────┬─────┘
        │ Publish Certified Tally
        ▼
  ┌───────────────────┐
  │ RESULTS_PUBLISHED │ ──(Official public election results disclosed)
  └─────┬─────────────┘
        │ Archive Slate
        ▼
  ┌───────────┐
  │ ARCHIVED  │
  └───────────┘
```

- **Transition Rules:** Direct transitions such as `DRAFT -> VOTING`, `VOTING -> DRAFT`, or `RESULTS_PUBLISHED -> VOTING` are rejected with `400 Bad Request`.
- **Voting Window Rules:** Voting is allowed if and only if:
  $$\text{ServerTime} \ge \text{startDate} \quad \wedge \quad \text{ServerTime} < \text{endDate} \quad \wedge \quad \text{phase} = \text{"VOTING"}$$

---

## 4. Technology Stack

- **Backend:** Node.js (v18+ LTS), Express.js v5, Mongoose v9, Socket.io, jsonwebtoken, bcryptjs, crypto.
- **Frontend:** Vanilla HTML5, CSS3 Custom Design System, Vanilla JavaScript, Chart.js v4.4, face-api.js (SSD MobileNet v1), Font Awesome v6.
- **Testing:** Jest, Supertest (11 test suites, 95 tests).
- **Observability:** Custom structured JSON logger with correlation IDs, `/healthz` (liveness), `/readyz` (readiness).
- **Database:** MongoDB Atlas / Standalone MongoDB 6.0+ instance.

---

## 5. Installation & Setup

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

3. **Configure Environment:**
   ```bash
   cp server/.env.example server/.env
   ```

---

## 6. Environment Variables

Create `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/voting-system?retryWrites=true&w=majority
JWT_SECRET=production_grade_random_secret_string_minimum_32_characters
CORS_ORIGIN=*
```

---

## 7. Database Schema & Privacy Isolation

### Collections:
1. **`Election`:** `{ title, electionCode, phase, startDate, endDate, publishLiveTally, resultsPublishedAt }`
2. **`Voter`:** `{ name, email, password, voterId, faceDescriptor: [Float32 x 128] }`
3. **`VoterParticipation`:** `{ voterId, electionId, participatedAt, verificationMethod }`
   - *Constraint:* Compound unique index `{ voterId: 1, electionId: 1 }` guarantees atomic exactly-once voting. Contains ZERO choice data.
4. **`AnonymousBallot`:** `{ _id: UUIDv4, electionId, partyId, candidateId, ballotCommitmentHash }`
   - *Constraint:* Non-sequential UUIDv4 primary keys. Contains ZERO voter identity and NO fine-grained timestamps.
5. **`BiometricToken`:** `{ token, voterId, electionId, used, expiresAt }`
   - *Constraint:* Valid for 5 minutes, single-use, deleted atomically upon vote casting.
6. **`AuditLog`:** `{ action, category, userId, userRole, status, currentHash, previousHash, time }`
   - *Constraint:* Linear SHA-256 hash chaining `currentHash = SHA256(previousHash + payload)`.

---

## 8. Multi-Device Responsive Design System

The frontend implements an **Olive Green Civic Design System** styled in Vanilla CSS without external UI frameworks:

| Device Category | Screen Width | Layout & Adaptations |
|---|---|---|
| **Mobile Phones** | 320px – 480px | Single-column stack, collapsible sidebar drawer, full-width touch buttons, compact stat cards, fluid camera modal. |
| **Tablets / Phablets** | 481px – 768px | 2-column auto-wrapping grids, collapsible navigation with overlay backdrop, horizontal table cards. |
| **Laptops / Desktops** | 769px – 1200px | Fixed sticky sidebar, dual-column analytics charts, expanded data tables, full-sized stepper. |
| **Large Screens** | >1200px | Centered max-width application shell (1300px), multi-column KPI grids, side-by-side surveillance views. |

---

## 9. User Roles & Access Control

| Role | Default Portal | Key Permissions |
|---|---|---|
| **Admin** | `client/admin/dashboard/dashboard.html` | Manage election lifecycle phases, register voters/parties, monitor audit ledger, verify hash chains, supervise live tallies. |
| **Voter** | `client/voter-dashboard/v-dashboard.html` | Check eligibility, review candidate slates, perform facial verification, cast anonymous ballot, download cryptographic receipt. |
| **Party** | `client/party-dashboard/p-parties.html` | Inspect certified candidate manifest, observe official certified results after publication. |

---

## 10. Voting Workflow (4-Step Chamber)

```
01 SELECT PARTY        → Citizen browses accredited party slates and selects candidate.
02 REVIEW CHOICE       → Confirms selection with permanent-action disclosure modal.
03 FACE VERIFICATION   → Camera initializes, tracks facial embedding (<0.55 distance), and receives 5-minute single-use biometricToken.
04 CRYPTOGRAPHIC SEAL  → Server consumes token atomically, commits decoupled AnonymousBallot, logs participation, and returns SHA-256 commitment receipt.
```

---

## 11. Biometric Architecture & Extension Roadmap

The platform features an extensible `BiometricProvider` abstraction ([`server/utils/biometricProvider.js`](file:///c:/Users/ankit/OneDrive/Documents/HTML/voting-system/server/utils/biometricProvider.js)):
- **`BrowserFaceProvider` (Current):** 128-dimensional facial embedding vector verification via Euclidean distance comparison ($d < 0.55$).
- **`WebAuthnProvider` (Extension Point):** Future FIDO2 hardware token / TouchID / FaceID passkey attestation.
- **`HardwareBiometricProvider` (Extension Point):** Future poll-site physical optical fingerprint / iris scanner integration.

---

## 12. Security Architecture & Integrity Hardening

- **Authoritative Server Clock:** Enforces UTC start/end boundaries on all transactions.
- **Decoupled Physical Storage:** Participation logs and anonymous ballots are stored in separate MongoDB collections.
- **Granular 4-Tier Rate Limiting:** Dedicated rate limiters for general API (100 req/15m), auth (15 req/15m), biometric verification (10 req/15m), and voting (5 req/15m).
- **Helmet Security Headers:** Comprehensive CSP tailored for Chart.js, face-api.js, and webcam video streams.
- **Audit Hash Chaining:** Every administrative and security event is sequentially chained via SHA-256 hashes with an automated verification probe (`GET /api/admin/audit-verify`).

---

## 13. API Route Specifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/admin-login` | Public | Authenticates administrator and returns JWT with role. |
| `POST` | `/api/auth/voter-login` | Public | Authenticates citizen voter and returns JWT. |
| `POST` | `/api/auth/party-login` | Public | Authenticates party observer and returns JWT. |
| `GET` | `/api/admin/elections` | Admin | Retrieves all election slates. |
| `POST` | `/api/admin/create-election` | Admin | Creates election in `DRAFT` state with date validation. |
| `POST` | `/api/admin/update-phase` | Admin | Transitions election phase according to lifecycle rules. |
| `POST` | `/api/admin/proposals` | Admin | Proposes sensitive action requiring Two-Person Rule consensus. |
| `GET` | `/api/admin/proposals` | Admin | Queries approval queue with status and election filters. |
| `POST` | `/api/admin/proposals/:id/approve` | Admin | Authorizes proposal (enforces distinct secondary officer). |
| `POST` | `/api/admin/proposals/:id/reject` | Admin | Rejects proposal with recorded reason. |
| `GET` | `/api/admin/governance/summary` | Admin | Overview metrics for pending/executed proposals. |
| `GET` | `/api/admin/stats` | Admin | Returns aggregated voter, ballot, and party counts. |
| `GET` | `/api/admin/voters` | Admin | Returns electoral roll with voting status flags. |
| `POST` | `/api/admin/add-voter` | Admin | Enrolls citizen with 128-d facial biometric vector. |
| `GET` | `/api/admin/parties` | Admin | Returns accredited political party catalog. |
| `POST` | `/api/admin/add-party` | Admin | Registers political party slate and credentials. |
| `GET` | `/api/admin/audit-logs` | Admin | Returns paginated immutable security event ledger. |
| `GET` | `/api/admin/audit-verify` | Admin | Verifies sequential linear SHA-256 hash chains. |
| `GET` | `/api/voter/profile` | Voter | Returns citizen profile and active election status. |
| `GET` | `/api/party` | Voter/Party | Returns active candidate slates. |
| `POST` | `/api/voter/face-verify` | Voter | Validates facial biometrics and issues single-use `biometricToken`. |
| `POST` | `/api/voter/vote` | Voter | Commits decoupled ballot and issues cryptographic receipt. |
| `GET` | `/api/results` | Authenticated | Retrieves tally results (embargoed to non-admins until published). |
| `GET` | `/healthz` | Public | Process liveness probe. |
| `GET` | `/readyz` | Public | Database readiness probe. |

---

## 14. Automated Testing & Verification Probes

### Run Complete Automated Test Suite (13 Suites / 114 Tests):
```bash
cd server
npm test
```

### Run Production Smoke Test Probe (6/6 Probes):
```bash
npm run smoke-test
```

### Run 10-Point Data Consistency & Privacy Audit:
```bash
npm run consistency-check
```

### Run Real Express HTTP API Latency Benchmark:
```bash
npm run api-benchmark
```

### Run In-Process Cryptographic Performance Benchmark:
```bash
npm run benchmark
```

### Check Dependency Vulnerabilities (0 Vulnerabilities):
```bash
npm audit
```

---

## 15. Production Deployment & Observability

### Docker Container Deployment:
```bash
docker-compose up -d --build
```

### Production Probes:
- **Liveness:** `GET http://localhost:5000/healthz` $\rightarrow$ `{"status": "ok"}`
- **Readiness:** `GET http://localhost:5000/readyz` $\rightarrow$ `{"status": "ready", "database": "connected"}`

### Disaster Recovery & Academic Documentation:
- [Academic College Final Project Report](docs_and_scripts/COLLEGE_FINAL_PROJECT_REPORT.md)
- [Disaster Recovery & Integrity Drill Handbook](docs_and_scripts/DISASTER_RECOVERY_AND_INTEGRITY_DRILL.md)

---

## 16. Known Limitations & Security Realities

- **Client-Side Liveness:** Browser-based face tracking using webcams cannot substitute for tamper-resistant certified biometric hardware or secure enclaves.
- **Operational Database Trust:** Privacy separation relies on server security. If the underlying MongoDB host is compromised during the millisecond of insertion, timing correlation could theoretically occur.
- **Scope Classification:** The platform is designed and validated for civic institutions, universities, organizational bodies, and enterprise governance, not sovereign national elections.

---

## 17. License

This project is licensed under the [MIT License](LICENSE).
