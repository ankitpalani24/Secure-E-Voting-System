<p align="center">
  <img src="client/pics/ballot.png" alt="Secure E-Voting System" width="80"/>
</p>

<h1 align="center">🗳️ Secure E-Voting System</h1>

<p align="center">
  <b>A full-stack, biometric-secured electronic voting platform with role-based access, real-time results, and audit logging.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Express-v5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT"/>
  <img src="https://img.shields.io/badge/Face_API.js-Biometrics-FF6F61?style=for-the-badge" alt="Face API"/>
  <img src="https://img.shields.io/badge/Vercel-Deploy-000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel"/>
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [User Roles](#-user-roles)
- [Security](#-security)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

The **Secure E-Voting System (SEVS)** is a web-based electronic voting platform designed to ensure **integrity, transparency, and security** in the voting process. It leverages **facial recognition biometrics** for voter identity verification, **JWT-based authentication** for session management, and **role-based access control** to separate admin, voter, and party functionalities.

The system enforces a strict **one-person-one-vote** policy at the database level, tracks all critical actions via an audit log, and provides real-time result updates through Socket.io.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔐 **Facial Recognition** | Biometric voter verification using `face-api.js` with 128-dimensional face embeddings and Euclidean distance matching (threshold: 0.55) |
| 🛡️ **JWT Authentication** | Secure token-based auth with role-encoded payloads and 2-hour expiry |
| 👥 **Role-Based Access** | Three distinct roles — **Admin**, **Voter**, **Party** — each with dedicated dashboards and permissions |
| 🗳️ **One-Person-One-Vote & Decoupled Ballots** | Enforced via compound unique index on `VoterParticipation` and anonymous ballot storage |
| 📊 **Real-Time Results** | Live vote count updates via Socket.io WebSocket events |
| 📝 **Hashed Audit Logging** | SHA-256 linear hash chaining for tamper-evident audit logs |
| 🚫 **Duplicate Face Detection** | Prevents the same person from registering twice by comparing face embeddings against existing voters |
| ☁️ **Serverless Ready & Containerized** | Optimized for Vercel deployment with cached MongoDB connections, plus production Dockerfile |

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Node.js** | Runtime environment |
| **Express v5** | Web framework & REST API |
| **MongoDB Atlas** | Cloud database (via Mongoose v9) |
| **JWT** (`jsonwebtoken`) | Stateless authentication |
| **bcrypt.js** | Password hashing |
| **Socket.io** | Real-time WebSocket communication |

### Frontend
| Technology | Purpose |
|---|---|
| **HTML5 / CSS3 / Vanilla JS** | Core UI — modern light theme design system |
| **face-api.js** | Browser-based facial recognition (SSD MobileNet v1) |
| **Font Awesome** | Icon library |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Vercel** | Serverless hosting & deployment |
| **Docker** | Containerized deployment |
| **MongoDB Atlas** | Managed cloud database |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                    │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Login   │  │ Admin Panel  │  │  Voter Dashboard  │  │
│  │  Page    │  │  Dashboard   │  │  Face Verify +    │  │
│  │          │  │  Voters CRUD │  │  Cast Vote        │  │
│  │          │  │  Parties CRUD│  │  View Results     │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│       │               │                   │             │
│  ┌────┴───────────────┴───────────────────┴──────────┐  │
│  │              face-api.js (Biometrics)             │  │
│  └───────────────────────┬───────────────────────────┘  │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTPS / WebSocket
┌──────────────────────────┼──────────────────────────────┐
│                     SERVER (Node.js)                    │
│                          │                              │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │              Express REST API                     │  │
│  │  /api/auth    → Login (Admin, Voter, Party)       │  │
│  │  /api/admin   → CRUD Voters & Parties, Stats      │  │
│  │  /api/voter   → Profile, Face Verify, Cast Vote   │  │
│  │  /api/party   → Party Info                        │  │
│  │  /api/results → Aggregated Vote Results           │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                              │
│  ┌───────────┐  ┌────────┴────────┐  ┌──────────────┐   │
│  │ JWT Auth  │  │   Controllers   │  │  Socket.io   │   │
│  │ Middleware│  │  + Face Utils   │  │  (Real-time) │   │
│  └───────────┘  └────────┬────────┘  └──────────────┘   │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                  MongoDB Atlas                          │
│                          │                              │
│  ┌────────┐ ┌────────┐ ┌┴───────┐ ┌────────┐ ┌───────┐  │
│  │ Admins │ │ Voters │ │Ballots │ │Parties │ │Audit  │  │
│  │        │ │ +face  │ │(anon)  │ │        │ │ Logs  │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └───────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
voting-system/
├── api/
│   └── index.js                  # Vercel serverless entry point
├── client/
│   ├── admin/
│   │   ├── dashboard/            # Admin overview — stats & system summary
│   │   ├── voters/               # View/manage registered voters
│   │   ├── parties/              # View/manage registered parties
│   │   ├── results/              # Election results view
│   │   ├── register-voter/       # Register new voter (with face capture)
│   │   └── register-party/       # Register new political party
│   ├── voter-dashboard/
│   │   ├── v-dashboard.*         # Voter overview
│   │   ├── v-vote.*              # Face verification + vote casting
│   │   └── v-result.*            # Voter results view
│   ├── party-dashboard/
│   │   ├── p-parties.*           # Party info display
│   │   └── p-result.*            # Party results view
│   ├── login/                    # Unified login page (Admin/Voter/Party)
│   ├── lib/                      # face-api.js library
│   ├── models/                   # Face recognition model weights
│   ├── pics/                     # UI image assets
│   ├── shared/                   # Reusable toast & spinner components
│   └── styles/                   # Unified design system (main.css, loading.css)
├── server/
│   ├── controllers/              # Express route controllers
│   ├── middleware/               # Auth & security middleware
│   ├── models/                   # Mongoose schemas (Voter, AnonymousBallot, etc.)
│   ├── routes/                   # REST API routes
│   ├── tests/                    # Jest automated unit & security test suite
│   ├── utils/                    # Face embedding & SHA-256 audit utils
│   └── server.js                 # Express application & DB connection
├── Dockerfile                    # Multi-stage production container
├── .dockerignore
├── .env.example
├── package.json
└── vercel.json                   # Vercel deployment configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- **MongoDB Atlas** account (or local MongoDB instance)
- A modern browser with webcam support (for face recognition)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ankitpalani24/Secure-E-Voting-System.git
   cd Secure-E-Voting-System
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Configure environment variables** (see [Environment Variables](#-environment-variables))

4. **Run automated tests**
   ```bash
   npm test
   ```

5. **Start the development server**
   ```bash
   npm start
   ```
   The server will start on `http://localhost:5000`.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env`:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
PORT=5000
JWT_SECRET=your_super_secret_key_here
```

---

## 🧪 Testing

Run the automated test suite with Jest:
```bash
npm test
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
