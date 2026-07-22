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
| 🛡️ **JWT Authentication** | Secure token-based auth with role-encoded payloads and 1-hour expiry |
| 👥 **Role-Based Access** | Three distinct roles — **Admin**, **Voter**, **Party** — each with dedicated dashboards and permissions |
| 🗳️ **One-Person-One-Vote** | Enforced via MongoDB unique index on `voterId` in the Vote collection, with duplicate detection at both application and database layers |
| 📊 **Real-Time Results** | Live vote count updates via Socket.io WebSocket events |
| 📝 **Audit Logging** | Automatic logging of logins, voter registrations, and vote casts with timestamps and user roles |
| 🚫 **Duplicate Face Detection** | Prevents the same person from registering twice by comparing face embeddings against all existing voters |
| ☁️ **Serverless Ready** | Optimized for Vercel deployment with cached MongoDB connections for warm serverless invocations |

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
| **HTML5 / CSS3 / Vanilla JS** | Core UI — no framework dependency |
| **face-api.js** | Browser-based facial recognition (SSD MobileNet v1) |
| **Font Awesome** | Icon library |
| **Boxicons** | Additional icon set |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Vercel** | Serverless hosting & deployment |
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
│  │ Admins │ │ Voters │ │ Votes  │ │Parties │ │Audit  │  │
│  │        │ │ +face  │ │(unique)│ │        │ │ Logs  │  │
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
│   ├── styles/                   # Shared CSS (loading animations)
│   ├── registerFace.html         # Standalone face registration tool
│   ├── verifyFace.html           # Standalone face verification tool
│   └── results.html              # Public results page
├── server/
│   ├── controllers/
│   │   ├── authController.js     # Login logic for all 3 roles
│   │   ├── adminController.js    # Voter/Party CRUD + dashboard stats
│   │   ├── voterController.js    # Profile, face verify, cast vote
│   │   └── resultsController.js  # Aggregated election results
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT verification + role guards
│   ├── models/
│   │   ├── Admin.js              # Admin schema
│   │   ├── Voter.js              # Voter schema (with faceDescriptor)
│   │   ├── Vote.js               # Vote schema (unique voterId)
│   │   ├── Party.js              # Party schema (with credentials)
│   │   └── AuditLog.js           # Audit trail schema
│   ├── routes/
│   │   ├── authRoutes.js         # POST /api/auth/*
│   │   ├── adminRoutes.js        # GET/POST /api/admin/*
│   │   ├── voterRoutes.js        # GET/POST /api/voter/*
│   │   ├── partyRoutes.js        # GET /api/party/*
│   │   └── resultsRoutes.js      # GET /api/results/*
│   ├── utils/
│   │   └── faceUtils.js          # Euclidean distance calculator
│   ├── scripts/                  # Database seed/utility scripts
│   └── server.js                 # Express app + DB connection + Vercel export
├── docs_and_scripts/             # TODO lists, improvement notes, helper scripts
├── .env                          # Environment variables (not committed)
├── .gitignore
├── package.json
├── vercel.json                   # Vercel deployment configuration
└── index.html                    # Root redirect
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
   # Root dependencies
   npm install

   # Server dependencies
   cd server
   npm install
   cd ..
   ```

3. **Configure environment variables** (see [Environment Variables](#-environment-variables))

4. **Start the development server**
   ```bash
   npm start
   ```
   The server will start on `http://localhost:5000`.

5. **Access the application**
   - Login page: `http://localhost:5000/client/login/login.html`
   - Admin dashboard: `http://localhost:5000/client/admin/dashboard/dashboard.html`

---

## 🔑 Environment Variables

Create a `.env` file in the project root and in the `server/` directory:

```env
# MongoDB connection string
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>

# Server port (local development)
PORT=5000

# JWT signing secret (use a strong, random string in production)
JWT_SECRET=your_super_secret_key_here
```

> ⚠️ **Never commit `.env` files to version control.** The `.gitignore` is already configured to exclude them.

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description | Body |
|---|---|---|---|
| `POST` | `/api/auth/admin-login` | Admin login | `{ username, password }` |
| `POST` | `/api/auth/voter-login` | Voter login | `{ username, password }` |
| `POST` | `/api/auth/party-login` | Party login | `{ username, password }` |

### Admin (🔒 Requires Admin JWT)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/add-voter` | Register a new voter with face biometrics |
| `POST` | `/api/admin/add-party` | Register a new political party |
| `GET` | `/api/admin/voters` | List all registered voters |
| `GET` | `/api/admin/parties` | List all registered parties |
| `GET` | `/api/admin/dashboard-stats` | Get voter, party, and vote counts |

### Voter (🔒 Requires Voter JWT)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/voter/profile` | Get voter profile & vote status |
| `POST` | `/api/voter/face-verify` | Verify voter identity via face biometrics |
| `POST` | `/api/voter/vote` | Cast a vote for a party |

### Results

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/results` | Get aggregated election results |

### Authentication Headers

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

## 👤 User Roles

### 🔴 Admin
- Register and manage voters (with biometric face capture)
- Register and manage political parties
- View system-wide dashboard statistics
- Access election results
- Full audit trail visibility

### 🟢 Voter
- Login with email and password
- Verify identity through facial recognition before voting
- Cast a single vote (enforced at DB level)
- View election results

### 🟡 Party
- Login with party credentials
- View registered parties
- View election results

---

## 🔒 Security

| Layer | Implementation |
|---|---|
| **Authentication** | JWT tokens with 1-hour expiry, role-encoded payloads |
| **Password Storage** | bcrypt hashing with salt rounds = 10 |
| **Biometric Verification** | 128-dimensional face embeddings with Euclidean distance matching |
| **Duplicate Prevention** | MongoDB unique index on `voterId` + application-level checks |
| **Face Uniqueness** | Duplicate face detection during voter registration |
| **Role Authorization** | Express middleware guards for admin and voter routes |
| **Audit Trail** | Timestamped logs for logins, registrations, and votes |
| **CORS** | Enabled via `cors` middleware |
| **Error Handling** | Global error handler; no stack traces in production responses |

---

## ☁️ Deployment

### Vercel (Recommended)

The project is pre-configured for Vercel deployment:

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Set environment variables in the Vercel dashboard:
   - `MONGO_URI`
   - `JWT_SECRET`
4. Deploy — Vercel will use `vercel.json` to route API requests to the serverless function

The `vercel.json` rewrites all `/api/*` requests to the serverless handler:
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.js"
    }
  ]
}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ankitpalani24">Ankit Palani</a>
</p>
