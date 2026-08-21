const mongoose = require("mongoose");
const Jurisdiction = require("../models/Jurisdiction");

/**
 * Ensures default hierarchical jurisdictions exist in database for seamless bootstrapping.
 */
async function ensureDefaultJurisdictions() {
  // Only attempt query if mongoose is actively connected to a database (avoids timeout during unit tests)
  if (mongoose.connection && mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    const count = await Jurisdiction.countDocuments();
    if (count > 0) return;

    // 1. National Level (Root)
    const country = await Jurisdiction.create({
      name: "National Territory",
      type: "COUNTRY",
      code: "NAT-01",
      parentId: null,
    });

    // 2. State Level
    const stateA = await Jurisdiction.create({
      name: "State Region Alpha",
      type: "STATE",
      code: "STA-01",
      parentId: country._id,
    });

    await Jurisdiction.create({
      name: "State Region Beta",
      type: "STATE",
      code: "STB-02",
      parentId: country._id,
    });

    // 3. District / Municipal Level
    const district1 = await Jurisdiction.create({
      name: "Central District Alpha",
      type: "DISTRICT",
      code: "DIS-01",
      parentId: stateA._id,
    });

    await Jurisdiction.create({
      name: "Metropolitan Municipality 1",
      type: "MUNICIPALITY",
      code: "MUN-01",
      parentId: district1._id,
    });

    // 4. Institutional Jurisdiction
    await Jurisdiction.create({
      name: "National Institute of Technology",
      type: "INSTITUTION",
      code: "INS-01",
      parentId: country._id,
    });
  } catch (err) {
    // Non-fatal if collection is mocked or constrained
  }
}

/**
 * Recursively fetches all descendant jurisdiction IDs under a root parent ID.
 * @param {string|mongoose.Types.ObjectId} parentId
 * @returns {Promise<Array<mongoose.Types.ObjectId>>}
 */
async function getDescendantJurisdictionIds(parentId) {
  if (!parentId) return [];
  const descendants = [parentId];
  const queue = [parentId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await Jurisdiction.find({ parentId: currentId }).select("_id").lean();
    for (const child of children) {
      descendants.push(child._id);
      queue.push(child._id);
    }
  }

  return descendants;
}

module.exports = {
  ensureDefaultJurisdictions,
  getDescendantJurisdictionIds,
};
