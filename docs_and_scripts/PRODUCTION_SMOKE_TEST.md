# Production Smoke Test Runbook — Secure E-Voting System

This guide outlines how to execute automated health and availability probes against any deployed instance of the Secure Online E-Voting System.

---

## 1. Overview

The `smokeTest.js` utility is a zero-dependency, automated HTTP/HTTPS health probe designed for:
- CI/CD deployment pipelines (GitHub Actions, GitLab CI, Jenkins)
- Pre-flight checks before opening polling stations
- Continuous liveness monitoring & synthetic uptime probes
- Staging and production verification

---

## 2. Running Smoke Tests

### Local Environment
Ensure the backend server is running, then execute:
```bash
npm run smoke-test
```

### Remote / Cloud Production Environment
To probe a remote deployment URL (e.g. AWS, Vercel, DigitalOcean, Kubernetes):
```bash
APP_URL=https://vote.yourdomain.gov npm run smoke-test
```
Or directly using Node:
```bash
node server/scripts/smokeTest.js
```

---

## 3. What the Smoke Test Verifies

| Probe # | Target | Method | Success Criterion | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `/` | `GET` | HTTP 200 | Verifies web gateway is accepting connections |
| **2** | `/healthz` | `GET` | HTTP 200 + status `ok` + uptime + `X-Request-ID` | Verifies Node.js process liveness and request correlation |
| **3** | `/readyz` | `GET` | HTTP 200 + status `ready` | Verifies MongoDB Atlas connectivity & transaction readiness |
| **4** | `/api/results` | `GET` | HTTP 200 + JSON Array | Verifies certified ballot aggregation API is live |
| **5** | Security Headers | `GET` | `Content-Security-Policy` + `X-Content-Type-Options: nosniff` | Verifies Helmet CSP and frame protection headers |
| **6** | Static Assets | `GET` | HTTP 200 (`/client/login/login.html`) | Verifies frontend UI and styling assets are served correctly |

---

## 4. Exit Codes & Automation

- **Exit Code 0:** All 6 probes passed successfully (Deployment healthy).
- **Exit Code 1:** One or more probes failed (Deployment must be halted or rolled back).

### GitHub Actions Pipeline Example:
```yaml
name: Production Deployment Smoke Test

on:
  deployment_status:

jobs:
  smoke-test:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run Smoke Probe
        env:
          APP_URL: ${{ github.event.deployment_status.target_url }}
        run: node server/scripts/smokeTest.js
```
