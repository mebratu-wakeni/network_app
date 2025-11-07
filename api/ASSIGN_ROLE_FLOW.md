# Assign Role API: Complete Flow Explanation

## Request Structure

### URL: `POST /api/users/:id/roles`

**Example:** `POST /api/users/5/roles`

- `:id` in URL = **Target User ID** (the user receiving the role)
- In this example: user ID = 5

### Request Body: Role Information

**Option 1: By Role Name**
```json
{
  "roleName": "manager"
}
```

**Option 2: By Role ID**
```json
{
  "roleId": 2
}
```

---

## Complete Data Flow

### Step 1: Request Arrives

```javascript
POST /api/users/5/roles
Headers: { Authorization: "Bearer <admin-token>" }
Body: { "roleName": "manager" }
```

### Step 2: Route Matching (`users.routes.js`)

```javascript
router.post(
  '/:id/roles',                    // Matches: /api/users/5/roles
  requireRole(['admin']),          // Middleware 1: Check admin role
  validateParams(idParamSchema),   // Middleware 2: Validate URL param
  validate(assignRoleSchema),      // Middleware 3: Validate body
  usersController.assignRole       // Controller: Handle request
)
```

### Step 3: Middleware 1 - Authentication & Authorization

```javascript
requireRole(['admin'])
// Checks: Is logged-in user an admin?
// Sets: req.user (logged-in admin user)
```

### Step 4: Middleware 2 - Validate URL Parameter

```javascript
validateParams(idParamSchema)
// Validates: req.params.id = "5"
// Schema: { id: z.coerce.number().int().positive() }
// Result: req.validParams = { id: 5 }
```

**What happens:**
- Extracts `id` from URL (`/api/users/5/roles` → `id = "5"`)
- Validates it's a positive integer
- Converts string to number
- Sets `req.validParams = { id: 5 }`

### Step 5: Middleware 3 - Validate Request Body

```javascript
validate(assignRoleSchema)
// Validates: req.body = { "roleName": "manager" }
// Schema: z.union([{ roleName: string }, { roleId: number }])
// Result: req.validBody = { roleName: "manager" }
```

**What happens:**
- Extracts body: `{ "roleName": "manager" }`
- Validates it matches schema (either roleName or roleId)
- Sets `req.validBody = { roleName: "manager" }`

### Step 6: Controller (`users.controller.js`)

```javascript
assignRole = async (req, res, next) => {
  const { id } = req.validParams        // id = 5 (target user)
  const roleData = req.validBody       // { roleName: "manager" }
  
  const result = await this.service.assignRoleToUser(id, roleData)
  // Calls: service.assignRoleToUser(5, { roleName: "manager" })
  
  res.json({ ok: true, ...result })
}
```

**What happens:**
- `req.validParams.id` = **5** (target user ID from URL)
- `req.validBody` = **{ roleName: "manager" }** (role info from body)
- Passes both to service

### Step 7: Service (`users.service.js`)

```javascript
async assignRoleToUser(userId, input) {
  // userId = 5 (from controller)
  // input = { roleName: "manager" } (from controller)
  
  // 1. Verify user exists
  await this.getById(5)  // Throws 404 if user doesn't exist
  
  // 2. Find role by name
  const role = await this.repository.findRoleByName("manager")
  // Returns: { id: 2, name: "manager", description: "..." }
  
  // 3. Assign role to user
  await this.repository.assignRoleToUser(5, 2)
  // Inserts: { user_id: 5, role_id: 2 } into user_roles table
  
  return { role: {...}, assigned: true }
}
```

---

## Summary: Where Data Comes From

| Data | Source | Location | Example |
|------|--------|----------|---------|
| **Target User ID** | URL parameter `:id` | `req.validParams.id` | `5` |
| **Role Info** | Request body | `req.validBody` | `{ roleName: "manager" }` |
| **Logged-in Admin** | JWT token | `req.user` | `{ id: 1, email: "admin@..." }` |

---

## Example Request/Response

### Request

```bash
curl -X POST http://localhost:4000/api/users/5/roles \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"roleName": "manager"}'
```

**What this means:**
- Admin (from token) wants to assign role "manager" to user ID 5

### Response

```json
{
  "ok": true,
  "role": {
    "id": 2,
    "name": "manager",
    "description": "Manage core entities"
  },
  "assigned": true
}
```

---

## Key Points

1. **URL Parameter** (`:id`) = Target user (who gets the role)
2. **Request Body** = Role information (which role to assign)
3. **JWT Token** = Admin user (who is making the assignment)
4. **Two separate validations:**
   - `validateParams()` validates URL parameter
   - `validate()` validates request body

---

## Alternative: Using Role ID

You can also use role ID instead of role name:

```bash
curl -X POST http://localhost:4000/api/users/5/roles \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"roleId": 2}'
```

Same flow, but service finds role by ID instead of name!

