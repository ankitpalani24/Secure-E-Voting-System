# TODO: Login & Registration Status

## Current Features ✅
- Admin registers voters/parties: username/password → hashed → DB store (Voter/Party models)
- Role-based login: admin/voter/party → DB verify → JWT token → localStorage → **role-specific redirection**
- Bcrypt hashing, JWT auth, audit logs implemented

## Task Complete
Entered username/password (via admin register) stores in DB, usable for login + redirection.

**Test Flow:**
1. Login admin (username: admin, pass: admin123)
2. Register voter/party
3. Login new user → redirects to dashboard
