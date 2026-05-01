// ================== FACE UTILITIES ==================
// Shared utility module for face recognition helpers.
// Previously duplicated in adminController.js and voterController.js.

/**
 * Computes the Euclidean distance between two 128-element face descriptor vectors.
 * Returns Infinity if either vector is missing or not the correct length.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
function euclideanDistance(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== 128 || vecB.length !== 128) return Infinity;
  return Math.sqrt(vecA.reduce((sum, a, i) => sum + Math.pow(a - vecB[i], 2), 0));
}

module.exports = { euclideanDistance };
