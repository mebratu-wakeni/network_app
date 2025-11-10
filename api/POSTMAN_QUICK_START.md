# Postman Quick Start Guide

## Testing `/api/users/:id/toggle-status` in 5 Steps

### Step 1: Login and Get Token

1. **Create new request** → Name: "Login"
2. **Method**: `POST`
3. **URL**: `http://localhost:4000/api/auth/login`
4. **Headers**:
   ```
   Content-Type: application/json
   ```
5. **Body** (raw, JSON):
   ```json
   {
     "username": "newusername",
     "password": "password123"
   }
   ```
6. **Send** → Copy the `token` from response

---

### Step 2: Create Toggle Status Request

1. **Create new request** → Name: "Toggle User Status"
2. **Method**: `PATCH` (select from dropdown)
3. **URL**: `http://localhost:4000/api/users/31/toggle-status`
   - Replace `31` with the user ID you want to toggle
4. **Headers**:
   ```
   Authorization: Bearer YOUR_TOKEN_HERE
   ```
   - Replace `YOUR_TOKEN_HERE` with the token from Step 1
5. **Body**: (none - leave empty)
6. **Send** → Check response

---

### Step 3: Verify Response

Expected response:
```json
{
  "ok": true,
  "user": {
    "id": "31",
    "username": "targetuser1762632239",
    "is_active": false,
    ...
  }
}
```

Check the `is_active` field - it should be toggled (true → false or false → true)

---

## Visual Guide

### Request Setup

```
┌─────────────────────────────────────────┐
│ POSTMAN REQUEST                          │
├─────────────────────────────────────────┤
│ Method: [PATCH ▼]                       │
│ URL: http://localhost:4000/api/users/   │
│         31/toggle-status                │
├─────────────────────────────────────────┤
│ Headers                                  │
│ ┌─────────────────────────────────────┐ │
│ │ Authorization: Bearer eyJhbGciOi... │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Body: (none)                            │
└─────────────────────────────────────────┘
```

### Response

```
┌─────────────────────────────────────────┐
│ Response (200 OK)                        │
├─────────────────────────────────────────┤
│ {                                       │
│   "ok": true,                           │
│   "user": {                             │
│     "id": "31",                         │
│     "username": "user",                 │
│     "is_active": false,  ← Status       │
│     ...                                 │
│   }                                     │
│ }                                       │
└─────────────────────────────────────────┘
```

---

## Common Issues & Solutions

### Issue 1: "Forbidden" Error
```
{
  "ok": false,
  "error": "Forbidden"
}
```
**Solution**: Your user doesn't have admin role. Login as admin or assign admin role.

### Issue 2: "Invalid or expired token"
```
{
  "ok": false,
  "error": "Invalid or expired token"
}
```
**Solution**: Token expired. Login again to get a new token.

### Issue 3: "User not found"
```
{
  "ok": false,
  "error": "User not found"
}
```
**Solution**: User ID doesn't exist. Use a valid user ID.

### Issue 4: "Authentication required"
```
{
  "ok": false,
  "error": "Authentication required"
}
```
**Solution**: Missing Authorization header. Add `Authorization: Bearer YOUR_TOKEN`.

---

## Using Environment Variables (Easier Way)

### Setup Environment

1. Click **Environments** icon (👁️) → **+**
2. Name: "Local"
3. Add variables:
   - `base_url` = `http://localhost:4000`
   - `token` = (empty - will be set automatically)
   - `user_id` = `31`

### Use in Requests

- **URL**: `{{base_url}}/api/users/{{user_id}}/toggle-status`
- **Authorization**: `Bearer {{token}}`

### Auto-save Token (Login Request)

In Login request → **Tests** tab:
```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    if (jsonData.token) {
        pm.environment.set("token", jsonData.token);
    }
}
```

Now token is saved automatically after login!

---

## Testing Workflow

1. ✅ **Login** → Get token (saved automatically)
2. ✅ **Get User** → Check current `is_active` status
3. ✅ **Toggle Status** → Change status
4. ✅ **Get User** → Verify status changed
5. ✅ **Toggle Status** → Change back
6. ✅ **Get User** → Verify status changed back

---

## Quick Reference

| Field | Value |
|-------|-------|
| Method | `PATCH` |
| URL | `http://localhost:4000/api/users/:id/toggle-status` |
| Headers | `Authorization: Bearer <token>` |
| Body | (none) |
| Requires | Admin role |
| Response | Updated user object |

---

## Need Help?

- Check server is running: `http://localhost:4000/health`
- Verify user exists: `GET /api/users/:id`
- Check user has admin role: `GET /api/users/:id/permissions`
- See full API docs: `POSTMAN_GUIDE.md`

