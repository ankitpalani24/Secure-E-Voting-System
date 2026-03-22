npm start# Server and MongoDB Setup & Troubleshooting

## 1. Start Server
Open VSCode terminal in `c:/Users/ankit/OneDrive/Documents/HTML`
```
cd voting-system/server
npm start
```
Expected:
```
MongoDB Connected Successfully
Server running on port 5000
```

If Mongo error, check MONGO_URI in .env (Atlas connection string with IP whitelist 0.0.0.0/0).

If JWT error, add `JWT_SECRET=yourverysecretkey123` to .env.

## 2. Test Data
```
node createTestAdmins.js
node createTestParties.js
node createTestVoters.js
```
Admins: Ankit/ankit123, Het/het123

## 3. Test Login
Open `client/login/login.html` in browser, use admin/Ankit / ankit123 , role Admin.

## 4. Client CORS
Client uses http://localhost:5000 - matches server.

## Common Issues
- Server not running -> fetch failed
- Mongo not connected -> server crashes
- No test data -> login 'not found'

Server connects to MongoDB Atlas as configured.
