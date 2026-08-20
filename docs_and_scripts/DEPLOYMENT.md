# Production Deployment Guide — Secure E-Voting System

This guide outlines the production deployment architecture, security hardening, database configuration, reverse proxy setup, and operational considerations for the Secure Online E-Voting System.

---

## 1. Architecture Overview

```
[ Citizens / Admins / Observers ]
               │
               ▼ (HTTPS / TLS 1.3 - WSS)
  [ Reverse Proxy / Load Balancer (Nginx / Cloudflare) ]
               │
      ┌────────┴────────┐
      ▼                 ▼
[ Node.js Instance 1 ] [ Node.js Instance 2 ]  (Express v5 + Socket.IO)
      │                 │
      └────────┬────────┘
               ▼ (TLS Encrypted Mongoose Connection)
   [ MongoDB Atlas Replica Set (Primary + Secondary + Arbiter) ]
```

---

## 2. Infrastructure & Hosting Options

### Option A: Containerized Deployment (Docker / Kubernetes / AWS ECS)
- Built with multi-stage Alpine image (`Dockerfile`).
- Runs as an unprivileged user (`USER node`).
- Built-in container readiness health check on `/readyz`.

**Build & Run Commands:**
```bash
# Build image
docker build -t secure-e-voting:1.0.0 .

# Run container with production env
docker run -d \
  --name secure-voting \
  --restart unless-stopped \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/voting-system?retryWrites=true&w=majority" \
  -e JWT_SECRET="your_secure_64_byte_hex_secret_string" \
  -e CORS_ORIGIN="https://vote.yourdomain.gov" \
  secure-e-voting:1.0.0
```

### Option B: Bare-Metal / VPS Deployment (Ubuntu / Debian / systemd)
1. Install Node.js LTS (v20+):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. Setup systemd service (`/etc/systemd/system/voting-system.service`):
   ```ini
   [Unit]
   Description=Secure E-Voting System API & Gateway
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/voting-system
   ExecStart=/usr/bin/node server/server.js
   Restart=always
   RestartSec=5
   Environment=NODE_ENV=production
   Environment=PORT=5000
   Environment=MONGO_URI=mongodb+srv://...
   Environment=JWT_SECRET=...

   [Install]
   WantedBy=multi-user.target
   ```
3. Enable & start service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable voting-system
   sudo systemctl start voting-system
   ```

### Option C: Serverless Deployment (Vercel)
- The project includes `vercel.json` and `api/index.js` for serverless API routing.
- Inject `MONGO_URI` and `JWT_SECRET` in the Vercel Dashboard under **Project Settings → Environment Variables**.

---

## 3. Reverse Proxy & HTTPS Configuration (Nginx)

When deploying behind Nginx, enforce TLS 1.3, configure WebSocket upgrade headers, and hide internal headers:

```nginx
server {
    listen 80;
    server_name vote.yourdomain.gov;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vote.yourdomain.gov;

    ssl_certificate /etc/letsencrypt/live/vote.yourdomain.gov/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vote.yourdomain.gov/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Static client files
    location /client/ {
        alias /var/www/voting-system/client/;
        expires 1h;
        add_header Cache-Control "public, no-transform";
    }

    location /models/ {
        alias /var/www/voting-system/client/models/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    # API & WebSocket Gateway
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Production Database Indexes

Ensure all database indexes are built before starting election operations:

| Collection | Key(s) | Type | Purpose |
| :--- | :--- | :--- | :--- |
| `voterparticipations` | `{ voterId: 1, electionId: 1 }` | Compound Unique | Enforces one vote per voter per election |
| `anonymousballots` | `{ electionId: 1, partyId: 1 }` | Compound Index | Speeds up certified results aggregation |
| `anonymousballots` | `{ ballotCommitmentHash: 1 }` | Single Index | Enables instant receipt verification |
| `voters` | `{ email: 1 }` | Unique Index | Prevents duplicate voter accounts |
| `parties` | `{ username: 1 }`, `{ partyName: 1 }` | Unique Index | Prevents party slate naming conflicts |
| `biometrictokens` | `{ expiresAt: 1 }` | TTL Index (`expireAfterSeconds: 0`) | Auto-cleans expired biometric tokens |
| `auditlogs` | `{ time: -1 }`, `{ category: 1, action: 1 }` | Single/Compound Index | Accelerates forensic inspector queries |

---

## 5. Security & Secret Management Best Practices

1. **Secret Generation**: Always generate cryptographically random strings for `JWT_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. **Secret Managers**: Store production credentials in AWS Secrets Manager, HashiCorp Vault, or Doppler.
3. **Database Network Isolation**: Whitelist only backend server IP addresses on MongoDB Atlas (Network Access IP Whitelist).
4. **Log Retention**: Forward structured JSON logs (`logger.js`) to Datadog, Grafana Loki, or AWS CloudWatch.
