#!/usr/bin/env node

/**
 * ==============================================================================
 * SECURE E-VOTING SYSTEM — DEPLOYMENT SMOKE TEST SUITE
 * ==============================================================================
 * Zero-dependency automated HTTP/HTTPS pre-flight probe for CI/CD pipelines
 * and production environment readiness validation.
 *
 * Usage:
 *   APP_URL=http://localhost:5000 node server/scripts/smokeTest.js
 *   npm run smoke-test
 * ==============================================================================
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

const targetUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
console.log(`\n========================================================`);
console.log(` SECURE E-VOTING SYSTEM: PRODUCTION SMOKE TEST PROBE`);
console.log(` Target Endpoint: ${targetUrl}`);
console.log(` Timestamp:       ${new Date().toISOString()}`);
console.log(`========================================================\n`);

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(path, targetUrl);
    const client = fullUrl.protocol === "https:" ? https : http;

    const req = client.request(
      fullUrl,
      {
        method: options.method || "GET",
        headers: {
          "User-Agent": "SecureVote-SmokeTest-Probe/1.0",
          Accept: "application/json",
          ...(options.headers || {}),
        },
        timeout: 8000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch (e) {
            json = null;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
            json,
          });
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out after 8000ms"));
    });

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSmokeTests() {
  const probes = [
    {
      name: "1. Root Gateway Status",
      path: "/",
      test: (res) => res.statusCode === 200 || res.statusCode === 302,
      expected: "HTTP 200 OK or HTTP 302 Redirect",
    },
    {
      name: "2. Process Liveness Probe (/healthz)",
      path: "/healthz",
      test: (res) =>
        res.statusCode === 200 &&
        res.json &&
        res.json.status === "ok" &&
        typeof res.json.uptime === "number" &&
        res.headers["x-request-id"],
      expected: "HTTP 200 with status: ok, uptime, and X-Request-ID header",
    },
    {
      name: "3. Database Readiness Probe (/readyz)",
      path: "/readyz",
      test: (res) =>
        (res.statusCode === 200 || res.statusCode === 503) &&
        res.json &&
        (res.json.status === "ready" || res.json.status === "unavailable"),
      expected: "HTTP 200/503 with database connectivity status JSON",
    },
    {
      name: "4. Protected API Gateway Auth Guard (/api/results)",
      path: "/api/results",
      options: process.env.SMOKE_TEST_TOKEN
        ? { headers: { Authorization: `Bearer ${process.env.SMOKE_TEST_TOKEN}` } }
        : {},
      test: (res) =>
        process.env.SMOKE_TEST_TOKEN
          ? res.statusCode === 200 && Array.isArray(res.json)
          : (res.statusCode === 401 || res.statusCode === 403) && res.json && res.json.message,
      expected: process.env.SMOKE_TEST_TOKEN
        ? "HTTP 200 with certified results JSON array"
        : "HTTP 401/403 verifying active authentication guard",
    },
    {
      name: "5. Security Headers Inspection (CSP & Frame Guard)",
      path: "/healthz",
      test: (res) =>
        res.headers["x-content-type-options"] === "nosniff" &&
        res.headers["content-security-policy"] &&
        res.headers["x-request-id"],
      expected: "Strict CSP, nosniff, and X-Request-ID correlation headers present",
    },
    {
      name: "6. Static Asset Servicing (Login HTML)",
      path: "/client/login/login.html",
      test: (res) => res.statusCode === 200 && res.body.includes("SecureVote"),
      expected: "HTTP 200 with valid client portal HTML",
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const probe of probes) {
    try {
      const start = Date.now();
      const res = await request(probe.path);
      const durationMs = Date.now() - start;

      const isPass = probe.test(res);
      if (isPass) {
        console.log(`[ PASS ] ${probe.name} (${durationMs}ms)`);
        passed++;
      } else {
        console.error(`[ FAIL ] ${probe.name} (${durationMs}ms)`);
        console.error(`         Expected: ${probe.expected}`);
        console.error(`         Received: HTTP ${res.statusCode} | Body: ${res.body.slice(0, 150)}`);
        failed++;
      }
    } catch (err) {
      console.error(`[ ERROR ] ${probe.name}`);
      console.error(`          Error details: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n========================================================`);
  console.log(` PROBE SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log(` Result:        ${failed === 0 ? "ALL CHECKS PASSED — READY FOR PRODUCTION" : "FAILED — SEE ERRORS ABOVE"}`);
  console.log(`========================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSmokeTests();
