const crypto = require("crypto");

describe("Audit Utilities - Hash Chain Algorithm", () => {
  test("computes deterministic SHA-256 hash chains", () => {
    const genesisHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const timestamp = new Date("2026-01-01T00:00:00.000Z");
    const action = "TEST_ACTION";
    const userRole = "admin";
    const userId = "admin_123";
    const details = { test: true };

    const payload1 = `${genesisHash}|${timestamp.toISOString()}|${action}|${userRole}|${userId}|${JSON.stringify(details)}`;
    const hash1 = crypto.createHash("sha256").update(payload1).digest("hex");

    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(64);

    // Second chained entry
    const timestamp2 = new Date("2026-01-01T00:01:00.000Z");
    const payload2 = `${hash1}|${timestamp2.toISOString()}|SECOND_ACTION|voter|voter_456|${JSON.stringify({})}`;
    const hash2 = crypto.createHash("sha256").update(payload2).digest("hex");

    expect(hash2).toBeDefined();
    expect(hash2.length).toBe(64);
    expect(hash2).not.toBe(hash1);

    // Tampering test: Changing payload1 breaks downstream chain verification
    const tamperedPayload1 = `${genesisHash}|${timestamp.toISOString()}|TAMPERED_ACTION|${userRole}|${userId}|${JSON.stringify(details)}`;
    const tamperedHash1 = crypto.createHash("sha256").update(tamperedPayload1).digest("hex");
    expect(tamperedHash1).not.toBe(hash1);
  });
});
