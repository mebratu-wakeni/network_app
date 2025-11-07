# JWT (JSON Web Token) Explained

## What is JWT?

**JWT (JSON Web Token)** is a compact, URL-safe token format used to securely transmit information between parties. It's commonly used for authentication and authorization in web applications.

Think of it like a **digital ID card** that proves who you are without needing to check with the server every time.

---

## The Problem JWT Solves

### Without JWT (Session-based):

```
1. User logs in → Server stores session in database/memory
2. User makes request → Server checks session database
3. User makes another request → Server checks session database again
4. User makes another request → Server checks session database again
```

**Problem:** Every request requires a database lookup to verify the user.

### With JWT (Token-based):

```
1. User logs in → Server creates JWT and sends it to client
2. User makes request → Server verifies JWT signature (no database needed)
3. User makes another request → Server verifies JWT signature (no database needed)
4. User makes another request → Server verifies JWT signature (no database needed)
```

**Solution:** Token contains user identity, verified cryptographically. No database lookup needed!

---

## JWT Structure

A JWT consists of **three parts** separated by dots (`.`):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwiaWF0IjoxNzYyMjc4NzQ1fQ.lXPhjgz_3nwlJrV_30Z37g8bZNurpdjMxiTW3ccpNu0
```

### Format: `HEADER.PAYLOAD.SIGNATURE`

#### 1. Header (Base64 encoded JSON)

```json
{
  "alg": "HS256",  // Algorithm used for signature
  "typ": "JWT"     // Type of token
}
```

**What it does:** Tells the server how to verify the signature.

#### 2. Payload (Base64 encoded JSON)

```json
{
  "userId": "1",           // User identifier
  "iat": 1762278745,      // Issued at (timestamp)
  "exp": 1762883545       // Expiration (timestamp)
}
```

**What it does:** Contains the claims (data) about the user. This is what we use to identify the user.

#### 3. Signature

```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

**What it does:** Proves the token hasn't been tampered with. Only the server with the secret can create a valid signature.

---

## How JWT Works

### Step 1: User Logs In

```javascript
// User provides credentials
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

// Server verifies credentials
const user = await verifyPassword(email, password)

// Server creates JWT
const token = jwt.sign(
  { userId: user.id },        // Payload (data)
  'secret-key',               // Secret (only server knows)
  { expiresIn: '7d' }         // Options
)

// Server sends token to client
{
  "ok": true,
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Step 2: Client Stores Token

```javascript
// Client receives token and stores it (localStorage, cookie, memory)
localStorage.setItem('token', token)
```

### Step 3: Client Sends Token with Requests

```javascript
// Every protected request includes the token
fetch('/api/test-items', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
})
```

### Step 4: Server Verifies Token

```javascript
// Server extracts token from Authorization header
const token = req.headers.authorization?.substring(7) // Remove "Bearer "

// Server verifies token
const decoded = jwt.verify(token, 'secret-key')

// Server uses decoded data
const userId = decoded.userId
const user = await getUserById(userId)
```

---

## Our Implementation

### Creating JWT (Login)

**File:** `src/modules/auth/auth.service.js`

```javascript
generateToken(userId) {
  const secret = process.env.JWT_SECRET || 'change-me-in-production'
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  
  return jwt.sign(
    { userId },      // Payload: just the user ID
    secret,          // Secret key (must be kept secret!)
    { expiresIn }    // Token expires in 7 days
  )
}

async login(email, password) {
  // ... verify credentials ...
  const token = this.generateToken(user.id)
  return { user, token }
}
```

### Verifying JWT (Protected Routes)

**File:** `src/middleware/auth.js`

```javascript
export const authenticate = async (req, res, next) => {
  // 1. Extract token from header
  const authHeader = req.headers.authorization
  const token = authHeader?.substring(7) // "Bearer <token>"
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  
  // 2. Verify token
  const secret = process.env.JWT_SECRET || 'change-me-in-production'
  let decoded
  try {
    decoded = jwt.verify(token, secret)
    // If verification succeeds, decoded contains:
    // { userId: "1", iat: 1762278745, exp: 1762883545 }
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  
  // 3. Load user from database
  const user = await usersRepository.findById(decoded.userId)
  
  // 4. Attach user to request
  req.user = { id: user.id, email: user.email, ... }
  
  next() // Continue to next middleware
}
```

---

## Why Use JWT?

### ✅ Advantages

1. **Stateless:** Server doesn't need to store sessions
2. **Scalable:** Works across multiple servers (no shared session store needed)
3. **Fast:** No database lookup on every request
4. **Portable:** Token can be used by different services
5. **Self-contained:** Token contains user identity

### ⚠️ Considerations

1. **Cannot revoke easily:** Token is valid until expiration
   - Solution: Use short expiration + refresh tokens
   - Or: Maintain a blacklist of revoked tokens

2. **Size:** JWT is sent with every request (can be large if payload is big)
   - Solution: Keep payload small (only essential data)

3. **Secret security:** Secret key must be kept secure
   - Solution: Store in environment variable, never commit to git

---

## Security Features

### 1. Signature Verification

The signature ensures:
- Token hasn't been tampered with
- Token was created by the server (knows the secret)
- Token data is authentic

**Example:**
```javascript
// If someone tries to change the payload:
// Original: { userId: "1" }
// Tampered: { userId: "2" }

// The signature won't match, and jwt.verify() will fail
```

### 2. Expiration

```javascript
// Token expires after 7 days
{ expiresIn: '7d' }

// After expiration, jwt.verify() throws error
// Client must login again to get new token
```

### 3. Secret Key

```javascript
// Only server with secret can create/verify tokens
const secret = process.env.JWT_SECRET // Must be kept secret!
```

**Best practices:**
- Use strong random secret (at least 32 characters)
- Never commit secret to git
- Use different secrets for development/production
- Rotate secrets periodically

---

## JWT vs Session Cookies

| Aspect | JWT | Session Cookie |
|--------|-----|----------------|
| **Storage** | Client (localStorage/cookie) | Server (database/memory) |
| **Stateless** | Yes | No (server stores session) |
| **Scalability** | Easy (no shared state) | Requires shared session store |
| **Revocation** | Hard (must wait for expiration) | Easy (delete session) |
| **Size** | Larger (sent with every request) | Smaller (just session ID) |
| **Use case** | APIs, microservices | Traditional web apps |

---

## Real-World Example

### Scenario: User wants to create a product

```
1. User logs in
   POST /api/auth/login
   → Server returns: { token: "eyJ..." }

2. Client stores token
   localStorage.setItem('token', token)

3. User clicks "Create Product"
   Client sends:
   POST /api/products
   Headers: { Authorization: "Bearer eyJ..." }
   Body: { name: "Product", price: 100 }

4. Server receives request
   authenticate middleware:
   - Extracts token: "eyJ..."
   - Verifies signature: ✓ Valid
   - Decodes payload: { userId: "1" }
   - Loads user: User #1
   - Sets req.user = { id: 1, ... }

5. Server continues
   requireRules(['products.write']):
   - Checks req.user.rules
   - User has 'products.write' ✓
   - Continues to controller

6. Controller creates product
   → Returns: { ok: true, product: {...} }
```

---

## Common JWT Libraries

### In Node.js (our implementation):

```javascript
import jwt from 'jsonwebtoken'

// Create token
const token = jwt.sign(payload, secret, options)

// Verify token
const decoded = jwt.verify(token, secret)
```

### Other languages:

- Python: `PyJWT`
- Java: `java-jwt`
- PHP: `firebase/php-jwt`
- C#: `System.IdentityModel.Tokens.Jwt`

---

## Debugging JWT

### Decode JWT (without verification)

You can decode a JWT to see its contents (but not verify it):

**Online tool:** https://jwt.io

**Or manually:**
```javascript
// Just decode (don't verify)
const decoded = jwt.decode(token)
console.log(decoded)
// { userId: "1", iat: 1762278745, exp: 1762883545 }
```

### Verify JWT

```javascript
try {
  const decoded = jwt.verify(token, secret)
  // Token is valid
} catch (error) {
  if (error.name === 'TokenExpiredError') {
    // Token expired
  } else if (error.name === 'JsonWebTokenError') {
    // Invalid token
  }
}
```

---

## Best Practices in Our Code

### ✅ What We're Doing Right

1. **Short expiration:** 7 days (configurable via env)
2. **Minimal payload:** Only `userId` (not sensitive data)
3. **Secret in env:** `JWT_SECRET` from environment variable
4. **Proper verification:** Using `jwt.verify()` not `jwt.decode()`
5. **Error handling:** Proper 401 errors for invalid tokens

### 🔒 Security Checklist

- [x] Secret stored in environment variable
- [x] Token expires after set time
- [x] Payload contains minimal data
- [x] Signature verification on every request
- [ ] Token refresh mechanism (future enhancement)
- [ ] Token blacklist for logout (future enhancement)

---

## Summary

**JWT is a token format that:**
- Contains user identity (payload)
- Is cryptographically signed (can't be tampered with)
- Expires after set time
- Doesn't require server-side storage
- Is sent with every request in Authorization header

**In our app:**
- Created on login (`auth.service.js`)
- Verified on protected routes (`authenticate` middleware)
- Contains only `userId` in payload
- Expires in 7 days (configurable)

**Think of it as:** A secure, self-contained ID card that proves who you are without needing to check with the server every time! 🎫

