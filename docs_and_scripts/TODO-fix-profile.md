# Fix Voter Profile 404

**Status:** Plan approved

1. [x] Add JWT_SECRET to .env (votingapp2024supersecretkey!)
2. [x] Run `cd voting-system/server && node createTestVoters.js`
3. [x] Run `node createTestAdmins.js` 
4. [x] Run `node createTestParties.js`
5. [ ] Restart server: Ctrl+C then node server.js
6. [ ] Test: login ankit@voter / voter123 → dashboard profile loads.

**Expected:** Profile shows Name, Email, Voter ID, Status PENDING.
