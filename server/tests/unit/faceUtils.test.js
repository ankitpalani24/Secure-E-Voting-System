const { euclideanDistance } = require("../../utils/faceUtils");

describe("Face Utilities - Euclidean Distance Calculator", () => {
  test("returns 0 for identical 128-element vectors", () => {
    const vecA = new Array(128).fill(0.5);
    const vecB = new Array(128).fill(0.5);
    expect(euclideanDistance(vecA, vecB)).toBe(0);
  });

  test("calculates correct distance for known unit vectors", () => {
    const vecA = new Array(128).fill(0);
    const vecB = new Array(128).fill(0);
    vecA[0] = 3;
    vecB[0] = 7;
    // Difference is 4 on first coordinate, sqrt(16) = 4
    expect(euclideanDistance(vecA, vecB)).toBe(4);
  });

  test("returns Infinity if either vector is null or missing", () => {
    const validVec = new Array(128).fill(0.1);
    expect(euclideanDistance(null, validVec)).toBe(Infinity);
    expect(euclideanDistance(validVec, undefined)).toBe(Infinity);
  });

  test("returns Infinity if vector length is not exactly 128", () => {
    const shortVec = new Array(64).fill(0.1);
    const validVec = new Array(128).fill(0.1);
    expect(euclideanDistance(shortVec, validVec)).toBe(Infinity);
    expect(euclideanDistance(validVec, new Array(129).fill(0.1))).toBe(Infinity);
  });

  test("correctly discriminates within standard threshold 0.55", () => {
    const baseVec = new Array(128).fill(0.1);
    // Slight perturbation: 0.02 delta across all 128 dimensions -> sqrt(128 * 0.0004) = sqrt(0.0512) ~= 0.226 < 0.55
    const closeVec = baseVec.map(v => v + 0.02);
    const dist = euclideanDistance(baseVec, closeVec);
    expect(dist).toBeLessThan(0.55);

    // Large perturbation: 0.1 delta across all 128 dimensions -> sqrt(128 * 0.01) = sqrt(1.28) ~= 1.13 > 0.55
    const farVec = baseVec.map(v => v + 0.1);
    expect(euclideanDistance(baseVec, farVec)).toBeGreaterThan(0.55);
  });
});
