# Request Flow: From Entry Point to Endpoint

This document explains how a request flows through the application from the moment it arrives until a response is sent.

## 1. Entry Point (`src/index.js`)

```javascript
import './server.js'
```

**What happens:** Simply imports and executes `server.js`. This is the entry point when you run `node src/index.js`.

---

## 2. Server Setup (`src/server.js`)

```javascript
const app = createApp()  // Creates Express app
const server = app.listen(PORT, ...)  // Starts HTTP server
```

**What happens:**
- Creates Express application via `createApp()`
- Starts HTTP server listening on port 4000
- Sets up graceful shutdown handlers

**Flow:** `index.js` → `server.js` → calls `createApp()`

---

## 3. App Configuration (`src/app.js`)

```javascript
export function createApp() {
  const app = express()
  
  // Global middleware
  app.use(express.json())  // Parse JSON bodies
  app.use((req, res, next) => { req.knex = knex; next() })  // Attach DB
  
  // Routes
  app.get('/health', ...)
  app.use('/api', v1Routes)  // Mount API routes
  
  // Error handling
  app.use(notFound)  // 404 handler
  app.use(errorHandler)  // Global error handler
}
```

**What happens:**
- Sets up Express app
- Applies global middleware (JSON parsing, DB attachment)
- Mounts routes under `/api`
- Sets up error handling

**Flow:** `server.js` → `createApp()` → configures Express app

---

## 4. Route Registration (`src/routes/index.js`)

```javascript
router.use('/auth', auth)      // /api/auth/*
router.use('/users', users)    // /api/users/*
router.use('/test-items', testItems)  // /api/test-items/*
```

**What happens:**
- Routes requests to specific modules based on URL prefix
- Example: `POST /api/auth/login` → goes to `auth` module

**Flow:** Request hits `/api/*` → `routes/index.js` → routes to module

---

## 5. Module Route (`src/modules/auth/auth.routes.js`)

```javascript
router.post('/login', validate(loginSchema), authController.login)
```

**What happens:**
- Matches specific endpoint (e.g., `/api/auth/login`)
- Applies middleware chain in order:
  1. `validate(loginSchema)` - Validates request body
  2. `authController.login` - Executes controller

**Flow:** `/api/auth/login` → `auth.routes.js` → middleware chain → controller

---

## 6. Validation Middleware (`src/modules/auth/auth.schema.js`)

```javascript
export const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)  // Zod validation
    if (!result.success) {
      // Return 400 with validation errors
      return next(error)
    }
    req.validBody = result.data  // Attach validated data
    next()  // Continue to next middleware
  }
}
```

**What happens:**
- Validates `req.body` against Zod schema
- On success: attaches clean data to `req.validBody`, calls `next()`
- On failure: calls `next(error)` → goes to error handler

**Flow:** Request → validation → `req.validBody` → `next()` → controller

---

## 7. Controller (`src/modules/auth/auth.controller.js`)

```javascript
login = async (req, res, next) => {
  try {
    const { email, password } = req.validBody  // Use validated data
    const result = await this.service.login(email, password)
    res.json({ ok: true, ...result })  // Send response
  } catch (error) {
    next(error)  // Pass error to error handler
  }
}
```

**What happens:**
- Receives validated data from `req.validBody`
- Calls service layer
- Sends JSON response or passes error to error handler

**Flow:** Controller → Service → Response OR Error

---

## 8. Service (`src/modules/auth/auth.service.js`)

```javascript
async login(email, password) {
  const user = await this.usersRepository.findByEmail(email)
  // ... verify password ...
  const token = this.generateToken(user.id)
  return { user, token }
}
```

**What happens:**
- Contains business logic
- Calls repository for data access
- Returns data to controller

**Flow:** Service → Repository → Database → Data → Service → Controller

---

## 9. Repository (`src/modules/users/users.repository.js`)

```javascript
async findByEmail(email) {
  return this.knex('users').where({ email }).first()
}
```

**What happens:**
- Executes database queries
- Returns raw data

**Flow:** Repository → Knex → PostgreSQL → Data

---

## 10. Response Flow (Success)

```
Controller → res.json({ ok: true, data }) 
  → Express sends HTTP 200 response
  → Client receives JSON
```

---

## 11. Error Flow

```
Any layer → next(error) or throw error
  → Error bubbles up
  → Caught by errorHandler middleware
  → errorHandler sends HTTP response with status code
```

---

## Complete Example: `POST /api/auth/login`

```
1. Request arrives at Express server
   ↓
2. app.js: express.json() parses body
   ↓
3. app.js: Routes to /api → routes/index.js
   ↓
4. routes/index.js: Routes to /auth → auth.routes.js
   ↓
5. auth.routes.js: Matches POST /login
   ↓
6. auth.schema.js: validate(loginSchema) validates body
   - If invalid → 400 error response
   - If valid → req.validBody set, next() called
   ↓
7. auth.controller.js: login() method called
   - Extracts email/password from req.validBody
   - Calls authService.login()
   ↓
8. auth.service.js: login() method
   - Calls usersRepository.findByEmail()
   - Verifies password
   - Generates JWT token
   ↓
9. users.repository.js: findByEmail()
   - Executes: SELECT * FROM users WHERE email = ?
   ↓
10. PostgreSQL: Returns user data
    ↓
11. Repository → Service → Controller
    ↓
12. Controller: res.json({ ok: true, user, token })
    ↓
13. Express: Sends HTTP 200 response
    ↓
14. Client: Receives JSON response
```

---

## Protected Route Example: `POST /api/test-items` (with JWT)

```
1. Request: POST /api/test-items
   Headers: Authorization: Bearer <token>
   Body: { name: "Item", quantity: 5 }
   ↓
2. app.js → routes/index.js → testItems.routes.js
   ↓
3. testItems.routes.js: POST / route matches
   Middleware chain:
   ↓
4. requireRole(['admin']) middleware
   - Checks Authorization header
   - Calls authenticate middleware (if JWT present)
   - authenticate verifies JWT, loads user, sets req.user
   - requireRole checks if user has 'admin' role
   - If no → 403 Forbidden
   - If yes → next() to validation
   ↓
5. validate(createTestItemSchema)
   - Validates { name, quantity }
   - Sets req.validBody
   ↓
6. testItems.controller.create()
   - Calls testItems.service.create(req.validBody)
   ↓
7. testItems.service.create()
   - Calls testItems.repository.create()
   ↓
8. testItems.repository.create()
   - INSERT INTO test_items ...
   ↓
9. Response: { ok: true, item: {...} }
```

---

## Key Concepts

### Middleware Chain
Middleware executes **in order**. Each calls `next()` to continue or `next(error)` to stop and handle error.

### Separation of Concerns
- **Routes**: URL matching + middleware chain
- **Controllers**: HTTP request/response handling
- **Services**: Business logic
- **Repositories**: Data access
- **Schemas**: Validation

### Error Handling
Errors bubble up via `next(error)` until caught by `errorHandler` middleware.

