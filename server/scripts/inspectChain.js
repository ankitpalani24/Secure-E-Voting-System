const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const config = require("../config/config");
const AuditLog = require("../models/AuditLog");

async function checkChain() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  const logs = await AuditLog.find().sort({ time: 1, _id: 1 }).lean();
  console.log("Total audit records:", logs.length);

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    if (i > 0) {
      const prevEntry = logs[i - 1];
      if (entry.previousHash !== prevEntry.currentHash) {
        console.log(`Mismatch at index ${i}:`);
        console.log(`Previous record [${i-1}] currentHash:`, prevEntry.currentHash, "action:", prevEntry.action, "time:", prevEntry.time);
        console.log(`Current record [${i}] previousHash:`, entry.previousHash, "action:", entry.action, "time:", entry.time);
      }
    }
  }
  await mongoose.disconnect();
}

checkChain().catch(console.error);
