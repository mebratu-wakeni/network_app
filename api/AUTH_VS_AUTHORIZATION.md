# Authentication vs Authorization: Separation of Concerns

## Overview

**Authentication** and **Authorization** are two distinct concepts that we've properly separated in our implementation.

---

## Authentication: "Who are you?"

**Question:** Is the user who they claim to be?

**Process:**
1. User provides credentials (email + password)
2. System verifies credentials
3. System issues a token (JWT) proving identity

**Answer:** "Yes, you are user@example.com" or "No, credentials invalid"

---

## Authorization: "What can you do?"

**Question:** Does this authenticated user have permission to perform this action?

**Process:**
1. User is authenticated (we know who they are)
2. System checks what permissions/rules user has
3. System allows or denies the action

**Answer:** "Yes, you can create products" or "No, you need 'products.write' rule"

---

## Our Implementation

### Authentication Layer

**Location:** `src/middleware/auth.js` - `authenticate` middleware

```javascript
export const authenticate = async (req, res, next) => {
  // 1. Extract JWT token from Authorization header
  const token = req.headers.authorization?.substring(7) // "Bearer <token>"
  
  // 2. Verify token is valid
  const decoded = jwt.verify(token, secret)
  
  // 3. Load user from database
  const user = await usersRepository.findById(decoded.userId)
  
  // 4. Attach user to request
  req.user = { id: user.id, email: user.email, ... }
  
  next() // Continue to next middleware
}
```

**What it does:**
- ✅ Verifies JWT token
- ✅ Loads user from database
- ✅ Attaches `req.user` to request
- ❌ Does NOT check permissions

**When it fails:**
- Invalid token → 401 Unauthorized
- User not found → 401 Unauthorized
- User inactive → 401 Unauthorized

**Responsibility:** Identity verification only

---

### Authorization Layer

**Location:** `src/middleware/auth.js` - `requireRules`, `requireRole`, `requireAnyRule`

```javascript
export const requireRules = (requiredRules = []) => {
  return async (req, res, next) => {
    // 1. Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    // 2. Load user's effective rules
    const effectiveRules = await permissionsService.getEffectiveRules(req.user.id)
    
    // 3. Check if user has required rules
    const hasAll = requiredRules.every(rule => effectiveRules.has(rule))
    
    // 4. Allow or deny
    if (!hasAll) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
    }
    
    next()
  }
}
```

**What it does:**
- ✅ Assumes user is authenticated (`req.user` exists)
- ✅ Loads user's rules from database
- ✅ Checks if user has required permissions
- ❌ Does NOT verify identity

**When it fails:**
- Not authenticated → 401 Unauthorized
- Missing required rule → 403 Forbidden

**Responsibility:** Permission checking only

---

## Separation in Practice

### Example 1: Login Endpoint (Authentication Only)

```javascript
// POST /api/auth/login
router.post('/login', validate(loginSchema), authController.login)
```

**Flow:**
1. No authentication required (public endpoint)
2. Validates credentials
3. Returns JWT token if valid

**Separation:** This endpoint handles authentication, not authorization.

---

### Example 2: Protected Endpoint (Both Authentication + Authorization)

```javascript
// POST /api/test-items
router.post(
  '/',
  authenticate,        // ← Authentication: Who are you?
  requireRole(['admin']), // ← Authorization: Can you do this?
  validate(createTestItemSchema),
  controller.create
)
```

**Flow:**
1. `authenticate` middleware:
   - Verifies JWT token
   - Loads user
   - Sets `req.user`
   - If fails → 401 Unauthorized

2. `requireRole(['admin'])` middleware:
   - Assumes `req.user` exists (from authenticate)
   - Checks if user has 'admin' role
   - If fails → 403 Forbidden

3. If both pass → Continue to controller

**Separation:**
- `authenticate` = "Are you logged in?"
- `requireRole` = "Do you have permission?"

---

## Why This Separation Matters

### 1. **Reusability**

```javascript
// Authentication middleware can be used alone
router.get('/profile', authenticate, controller.getProfile)

// Authorization middleware can be used with different auth methods
router.post('/items', requireRules(['items.write']), controller.create)
```

### 2. **Flexibility**

You can:
- Use authentication without authorization (public endpoints after login)
- Use authorization without re-authenticating (if already authenticated)
- Combine both (most protected endpoints)

### 3. **Clear Error Messages**

```javascript
// Authentication failure
401 Unauthorized: "Invalid or expired token"

// Authorization failure  
403 Forbidden: "Insufficient permissions: missing 'products.write' rule"
```

### 4. **Testability**

You can test authentication and authorization separately:
- Mock `req.user` to test authorization without authentication
- Test authentication without worrying about permissions

---

## Our RBAC System

### Rules (Atomic Permissions)

```javascript
'products.read'   // Can read products
'products.write'  // Can create/update products
'sales.write'     // Can create sales
```

### Roles (Bundles of Rules)

```javascript
viewer = ['products.read', 'sales.read']
manager = ['products.read', 'products.write', 'sales.read', 'sales.write']
admin = [all rules]
```

### Users

```javascript
user = {
  id: 1,
  roles: ['admin'],           // From user_roles table
  directRules: ['dashboard.view'], // From user_rules table (overrides)
  effectiveRules: ['products.read', 'products.write', ..., 'dashboard.view']
}
```

### Authorization Checks

```javascript
// Method 1: Check role (simpler, less granular)
requireRole(['admin'])  // User must have 'admin' role

// Method 2: Check rules (more granular, flexible)
requireRules(['products.write'])  // User must have 'products.write' rule

// Method 3: Check any rule (OR condition)
requireAnyRule(['products.write', 'sales.write'])  // User needs at least one
```

---

## Current Implementation Status

### ✅ Properly Separated

1. **Authentication** (`authenticate` middleware)
   - Verifies JWT tokens
   - Loads user identity
   - Sets `req.user`
   - Does NOT check permissions

2. **Authorization** (`requireRules`, `requireRole`, `requireAnyRule`)
   - Assumes authentication completed
   - Checks user's effective rules
   - Allows or denies based on permissions
   - Does NOT verify identity

3. **Independent Middleware**
   - Can use `authenticate` alone
   - Can use `requireRules` alone (if `req.user` already set)
   - Can combine both

### 📝 Current Usage

```javascript
// Public (no auth)
router.post('/auth/register', ...)
router.post('/auth/login', ...)

// Authenticated only (no specific permission check)
router.get('/auth/me', authenticate, ...)

// Authenticated + Authorized
router.post('/test-items', authenticate, requireRole(['admin']), ...)
router.get('/users/:id', authenticate, requireRules(['users.read']), ...)
```

---

## Best Practices

### ✅ DO

1. **Always authenticate first, then authorize**
   ```javascript
   router.post('/items', authenticate, requireRules(['items.write']), controller.create)
   ```

2. **Use specific rules for fine-grained control**
   ```javascript
   requireRules(['products.write'])  // Better than requireRole(['admin'])
   ```

3. **Separate concerns in middleware**
   - Authentication middleware only handles identity
   - Authorization middleware only handles permissions

### ❌ DON'T

1. **Don't mix authentication and authorization logic**
   ```javascript
   // BAD: Authentication and authorization in one middleware
   const authAndAuthorize = (req, res, next) => {
     // verify token + check permissions
   }
   
   // GOOD: Separate middleware
   router.post('/items', authenticate, requireRules(['items.write']), ...)
   ```

2. **Don't check permissions in authentication**
   ```javascript
   // BAD: Authentication checking permissions
   export const authenticate = async (req, res, next) => {
     // verify token
     // check if user has 'admin' role  ← Should be in authorization
   }
   ```

---

## Summary

| Aspect | Authentication | Authorization |
|--------|----------------|---------------|
| **Question** | "Who are you?" | "What can you do?" |
| **Middleware** | `authenticate` | `requireRules`, `requireRole` |
| **Checks** | JWT token validity | User's effective rules |
| **Sets** | `req.user` | Nothing (uses `req.user`) |
| **Error** | 401 Unauthorized | 403 Forbidden |
| **Can work alone?** | Yes | No (needs `req.user`) |
| **Location** | `src/middleware/auth.js` | `src/middleware/auth.js` |

**Our implementation properly separates these concerns!** ✅

