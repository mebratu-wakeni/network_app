# JWT with Multiple Clients: How It Works

## Common Misconception ❌

**You might think:**
> "Server stores all JWTs for all logged-in users"

**This is WRONG!** JWT is **stateless** - the server does NOT store JWTs.

---

## How JWT Actually Works

### Server Does NOT Store JWTs

The server:
- ✅ **Creates** JWT when user logs in
- ✅ **Verifies** JWT when user makes requests
- ❌ **Does NOT store** JWT anywhere

### Client Stores JWT

The client (browser, mobile app, etc.):
- ✅ **Receives** JWT from server on login
- ✅ **Stores** JWT (localStorage, cookie, memory, etc.)
- ✅ **Sends** JWT with every request

---

## Complete Flow with Multiple Clients

### Scenario: 3 Users Login Simultaneously

```
Client 1 (Browser)                    Server                    Client 2 (Mobile)                    Client 3 (Desktop)
     |                                   |                            |                                   |
     |-- POST /api/auth/login --------->|                            |                                   |
     |   email: alice@test.com          |                            |                                   |
     |   password: pass123               |                            |                                   |
     |                                   |                            |                                   |
     |                                   |-- Verify credentials       |                                   |
     |                                   |-- Create JWT                |                                   |
     |                                   |   Token: "eyJ1..."         |                                   |
     |<-- { token: "eyJ1..." } ---------|                            |                                   |
     |                                   |                            |                                   |
     | [Stores token in localStorage]    |                            |                                   |
     |                                   |                            |                                   |
     |                                   |                            |-- POST /api/auth/login --------->|
     |                                   |                            |   email: bob@test.com             |
     |                                   |                            |   password: pass456               |
     |                                   |                            |                                   |
     |                                   |                            |                                   |
     |                                   |                            |<-- { token: "eyJ2..." } ---------|
     |                                   |                            |                                   |
     |                                   |                            | [Stores token in app memory]      |
     |                                   |                            |                                   |
     |                                   |                            |                                   |
     |                                   |                            |                                   |
     |                                   |                            |                                   |
     |                                   |                            |                                   |
     |-- GET /api/products ------------->|                            |                                   |
     |   Authorization: Bearer eyJ1...   |                            |                                   |
     |                                   |-- Verify JWT eyJ1...       |                                   |
     |                                   |   Extract userId: 1        |                                   |
     |                                   |   Load user #1             |                                   |
     |                                   |   Check permissions        |                                   |
     |<-- { products: [...] } -----------|                            |                                   |
     |                                   |                            |                                   |
     |                                   |                            |                                   |
     |                                   |                            |-- GET /api/products ------------->|
     |                                   |                            |   Authorization: Bearer eyJ2...   |
     |                                   |                            |                                   |
     |                                   |<-- Verify JWT eyJ2...      |                                   |
     |                                   |   Extract userId: 2        |                                   |
     |                                   |   Load user #2             |                                   |
     |                                   |   Check permissions        |                                   |
     |                                   |                            |<-- { products: [...] } -----------|
     |                                   |                            |                                   |
     |                                   |                            |                                   |
     |                                   |                            |                                   |
     |                                   |                            |-- POST /api/auth/login --------->|
     |                                   |                            |   email: charlie@test.com         |
     |                                   |                            |                                   |
     |                                   |                            |<-- { token: "eyJ3..." } ---------|
     |                                   |                            |                                   |
     |                                   |                            | [Stores token in localStorage]    |
```

**Key Points:**
- Server doesn't store any tokens
- Each client stores its own token
- Server verifies token on each request (no lookup needed)

---

## Server Storage Comparison

### Session-Based (Old Way) - Server Stores Sessions

```javascript
// Server stores sessions in database/memory
sessions = {
  "session-abc123": { userId: 1, expires: "2025-11-05" },
  "session-def456": { userId: 2, expires: "2025-11-05" },
  "session-ghi789": { userId: 3, expires: "2025-11-05" }
}

// Every request requires database lookup
GET /api/products
  → Check session-abc123 exists
  → Load session from database
  → Verify session not expired
  → Get userId from session
```

**Problems:**
- Server must store all sessions
- Database lookup on every request
- Doesn't scale well (multiple servers need shared session store)

### JWT-Based (Our Way) - Server Does NOT Store Tokens

```javascript
// Server stores NOTHING!

// Client 1 sends token
GET /api/products
  Authorization: Bearer eyJ1...
  → Server verifies token signature (cryptographic operation)
  → Extract userId from token payload
  → No database lookup for token!

// Client 2 sends token
GET /api/products
  Authorization: Bearer eyJ2...
  → Server verifies token signature (cryptographic operation)
  → Extract userId from token payload
  → No database lookup for token!

// Client 3 sends token
GET /api/products
  Authorization: Bearer eyJ3...
  → Server verifies token signature (cryptographic operation)
  → Extract userId from token payload
  → No database lookup for token!
```

**Benefits:**
- Server stores nothing
- No database lookup for token verification
- Scales infinitely (stateless)

---

## How Server Handles Multiple Clients Simultaneously

### Request 1: Client A (Alice)

```javascript
// Request arrives
POST /api/auth/login
Body: { email: "alice@test.com", password: "pass123" }

// Server processes
const user = await verifyPassword("alice@test.com", "pass123")
const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' })
// Token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIn0..."

// Server responds
res.json({ ok: true, user, token: "eyJ..." })

// Server does NOT store token anywhere!
// Client stores it in localStorage
```

### Request 2: Client B (Bob) - At Same Time

```javascript
// Different request arrives (different connection)
POST /api/auth/login
Body: { email: "bob@test.com", password: "pass456" }

// Server processes (completely independent)
const user = await verifyPassword("bob@test.com", "pass456")
const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' })
// Token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyIn0..."

// Server responds
res.json({ ok: true, user, token: "eyJ..." })

// Server does NOT store this token either!
// Client stores it in app memory
```

### Request 3: Client A Makes Protected Request

```javascript
// Client A sends stored token
GET /api/products
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIn0...

// Server verifies token
const decoded = jwt.verify("eyJ...", secret)
// Returns: { userId: "1" }

// Server does NOT need to look up token in database
// Token signature proves it's valid
// Payload contains userId directly

// Server loads user and permissions
const user = await getUserById(1)
const rules = await getEffectiveRules(1)

// Server responds
res.json({ ok: true, products: [...] })
```

### Request 4: Client B Makes Protected Request - Same Time

```javascript
// Client B sends its stored token (different token!)
GET /api/products
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyIn0...

// Server verifies token (completely independent)
const decoded = jwt.verify("eyJ...", secret)
// Returns: { userId: "2" }

// Server loads different user
const user = await getUserById(2)
const rules = await getEffectiveRules(2)

// Server responds
res.json({ ok: true, products: [...] })
```

---

## Where Tokens Are Stored

### Client-Side Storage

```javascript
// Browser (Web App)
localStorage.setItem('token', 'eyJ1...')
// Or
document.cookie = 'token=eyJ1...'

// Mobile App (React Native)
AsyncStorage.setItem('token', 'eyJ1...')
// Or in memory

// Desktop App (Electron)
localStorage.setItem('token', 'eyJ1...')
// Or in secure storage
```

### Server-Side: NOTHING!

```javascript
// Server does NOT have:
// - Token storage
// - Session database
// - Token registry
// - Active user list

// Server only has:
// - JWT secret (for signing/verifying)
// - User database (for loading user details)
// - Permission database (for RBAC)
```

---

## How Multiple Clients Work Simultaneously

### Node.js/Express Handles Concurrency

```javascript
// Express server can handle multiple requests simultaneously
// Each request is processed independently

// Request 1 (Alice)
POST /api/auth/login
  → Process in thread/event loop
  → Create token: "eyJ1..."
  → Return to client
  → Done (no storage)

// Request 2 (Bob) - happens at same time
POST /api/auth/login
  → Process in thread/event loop (separate)
  → Create token: "eyJ2..."
  → Return to client
  → Done (no storage)

// Request 3 (Alice's protected request)
GET /api/products
  Authorization: Bearer eyJ1...
  → Verify token (cryptographic operation)
  → Extract userId: 1
  → Process request
  → Return to client

// Request 4 (Bob's protected request) - happens at same time
GET /api/products
  Authorization: Bearer eyJ2...
  → Verify token (cryptographic operation)
  → Extract userId: 2
  → Process request
  → Return to client
```

**Key Point:** Each request is independent. Server doesn't need to track which tokens exist.

---

## Visual Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client 1  │         │   Client 2  │         │   Client 3  │
│  (Browser)  │         │   (Mobile)   │         │  (Desktop)  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ Token: eyJ1...        │ Token: eyJ2...        │ Token: eyJ3...
       │ (stored locally)      │ (stored locally)      │ (stored locally)
       │                       │                       │
       └───────────┬───────────┴───────────┬───────────┘
                   │                       │
                   │  All requests         │
                   │  include token        │
                   │                       │
                   └───────────┬───────────┘
                               │
                    ┌──────────▼──────────┐
                    │      Server         │
                    │                     │
                    │  JWT Secret: "..."  │  ← Only thing stored
                    │                     │
                    │  Users Database     │  ← For user details
                    │  Permissions DB     │  ← For RBAC
                    │                     │
                    │  NO TOKEN STORAGE!  │  ← Important!
                    └─────────────────────┘
```

---

## What Server Actually Stores

### ✅ What Server Stores:

1. **JWT Secret** (environment variable)
   ```javascript
   JWT_SECRET = "your-secret-key-here"
   ```
   - Used to sign and verify tokens
   - Same secret for all tokens
   - NOT stored per-user

2. **User Database** (PostgreSQL)
   ```sql
   users table
   - id, email, password_hash, etc.
   ```
   - User account information
   - NOT tokens

3. **Permissions Database** (PostgreSQL)
   ```sql
   roles, rules, user_roles, user_rules tables
   ```
   - RBAC information
   - NOT tokens

### ❌ What Server Does NOT Store:

- ❌ JWT tokens
- ❌ Active user sessions
- ❌ Token registry
- ❌ "Who is logged in" list

---

## Example: 1000 Users Logged In

### Session-Based (Old Way)

```javascript
// Server must store 1000 sessions
sessions = {
  "session-1": { userId: 1, ... },
  "session-2": { userId: 2, ... },
  // ... 998 more sessions
  "session-1000": { userId: 1000, ... }
}

// Database grows with each login
// Must query database on every request
```

### JWT-Based (Our Way)

```javascript
// Server stores NOTHING!

// 1000 users logged in
// Each has their own token stored on their device
// Server doesn't know or care about tokens

// When user makes request:
// 1. Client sends token
// 2. Server verifies token (cryptographic operation)
// 3. Server extracts userId from token
// 4. Server processes request

// No storage needed!
// No database lookup for token!
```

---

## Real-World Example

### Scenario: 3 Users, 3 Devices

```
User 1 (Alice):
  - Browser: Has token "eyJ1..."
  - Mobile: Has token "eyJ1..." (same user, different token)
  
User 2 (Bob):
  - Desktop: Has token "eyJ2..."
  
User 3 (Charlie):
  - Browser: Has token "eyJ3..."
```

**Server perspective:**
- Doesn't know Alice is logged in on 2 devices
- Doesn't know how many users are logged in
- Doesn't store any tokens
- Just verifies tokens when they arrive

**When requests arrive:**
```
Request 1: Bearer eyJ1... → Server verifies → userId: 1 → Process
Request 2: Bearer eyJ2... → Server verifies → userId: 2 → Process
Request 3: Bearer eyJ3... → Server verifies → userId: 3 → Process
Request 4: Bearer eyJ1... → Server verifies → userId: 1 → Process (same user, different request)
```

All handled independently, no storage needed!

---

## Summary

### Your Question:
> "Server generates and stores all JWTs for each user"

### Answer:
**NO!** Server does NOT store JWTs.

### What Actually Happens:

1. **User logs in:**
   - Server creates JWT
   - Server sends JWT to client
   - **Server does NOT store it**

2. **Client stores JWT:**
   - Browser: localStorage/cookie
   - Mobile: app storage/memory
   - Desktop: secure storage

3. **User makes request:**
   - Client sends JWT with request
   - Server verifies JWT (cryptographic operation, no lookup)
   - Server processes request

4. **Multiple users:**
   - Each client stores its own token
   - Server doesn't track tokens
   - Server just verifies tokens when they arrive

### Key Concept:
**JWT is stateless** - the token itself contains all the information needed to verify it. Server doesn't need to store it!

---

## Analogy

**Session-Based (Old Way):**
- Like a coat check: You give your coat, get a ticket, server stores your coat
- Server must remember where your coat is

**JWT-Based (Our Way):**
- Like a driver's license: You carry it, show it when needed
- Server just verifies it's real (signature), doesn't store it
- You can show it anywhere, anytime

---

**Bottom Line:** Server doesn't store JWTs. Each client stores its own token and sends it with requests. Server just verifies it! 🎫

