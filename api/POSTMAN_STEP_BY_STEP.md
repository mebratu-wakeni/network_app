# Postman Step-by-Step: Toggle User Status

## Visual Step-by-Step Guide

### Step 1: Login and Get Token

#### 1.1 Create Login Request
1. Open Postman
2. Click **"New"** button (top left) → Select **"HTTP Request"**
3. Name it: **"Login"**
4. Click **"Save"**

#### 1.2 Configure Login Request
1. **Method**: Select **POST** from dropdown (default is GET)
2. **URL**: Type `http://localhost:4000/api/auth/login`
3. **Headers Tab**:
   - Click **"Headers"** tab
   - Click **"Add Header"**
   - Key: `Content-Type`
   - Value: `application/json`
4. **Body Tab**:
   - Click **"Body"** tab
   - Select **"raw"** radio button
   - Select **"JSON"** from dropdown (right side)
   - Paste this:
     ```json
     {
       "username": "newusername",
       "password": "password123"
     }
     ```
5. **Tests Tab** (Optional - Auto-save token):
   - Click **"Tests"** tab
   - Paste this script:
     ```javascript
     if (pm.response.code === 200) {
         const jsonData = pm.response.json();
         if (jsonData.token) {
             pm.environment.set("token", jsonData.token);
             console.log("Token saved!");
         }
     }
     ```
6. **Send**: Click **"Send"** button (blue button, top right)
7. **Copy Token**: In the response (bottom), find the `token` field and copy its value
   - It looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### Step 2: Create Toggle Status Request

#### 2.1 Create New Request
1. Click **"New"** button → **"HTTP Request"**
2. Name it: **"Toggle User Status"**
3. Click **"Save"**

#### 2.2 Configure Toggle Status Request
1. **Method**: Select **PATCH** from dropdown
   - ⚠️ Important: Change from GET to PATCH!
2. **URL**: Type `http://localhost:4000/api/users/31/toggle-status`
   - Replace `31` with the user ID you want to toggle
   - Example: If you want to toggle user ID 2, use: `http://localhost:4000/api/users/2/toggle-status`
3. **Headers Tab**:
   - Click **"Headers"** tab
   - Click **"Add Header"**
   - Key: `Authorization`
   - Value: `Bearer YOUR_TOKEN_HERE`
   - Replace `YOUR_TOKEN_HERE` with the token you copied from Step 1
   - Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. **Body Tab**:
   - Click **"Body"** tab
   - Leave it empty (no body needed for this endpoint)
5. **Send**: Click **"Send"** button

#### 2.3 Check Response
You should see a response like:
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

Check the `is_active` field - it should be toggled!

---

## Using Environment Variables (Easier Way)

### Setup Environment (One Time)

1. **Click Environments Icon**:
   - Look for the 👁️ (eye) icon in the top right corner
   - Click it

2. **Create New Environment**:
   - Click **"+"** button (or "Create Environment")
   - Name: **"Local Development"**

3. **Add Variables**:
   - Click **"Add"** to add each variable:
     - Variable 1:
       - Key: `base_url`
       - Value: `http://localhost:4000`
     - Variable 2:
       - Key: `token`
       - Value: (leave empty)
     - Variable 3:
       - Key: `user_id`
       - Value: `31` (or any user ID)

4. **Save**: Click **"Save"** button

5. **Select Environment**:
   - Click the dropdown (top right, next to 👁️ icon)
   - Select **"Local Development"**

### Use Variables in Requests

Now you can use variables in your requests:

**Login URL**: `{{base_url}}/api/auth/login`

**Toggle Status URL**: `{{base_url}}/api/users/{{user_id}}/toggle-status`

**Authorization Header**: `Bearer {{token}}`

### Auto-Save Token

1. In your **Login** request, go to **Tests** tab
2. Add this script:
   ```javascript
   if (pm.response.code === 200) {
       const jsonData = pm.response.json();
       if (jsonData.token) {
           pm.environment.set("token", jsonData.token);
           console.log("Token saved!");
       }
   }
   ```
3. After sending login, the token is automatically saved!
4. Now all requests will use `{{token}}` automatically

---

## Quick Reference: Toggle Status

| Field | Value |
|-------|-------|
| **Method** | `PATCH` (important!) |
| **URL** | `http://localhost:4000/api/users/31/toggle-status` |
| **Headers** | `Authorization: Bearer <your_token>` |
| **Body** | (none - leave empty) |
| **Requires** | Admin role |

---

## Troubleshooting

### ❌ Error: "Forbidden" (403)
**Problem**: Your user doesn't have admin role

**Solution**:
1. Login as a user with admin role, OR
2. Assign admin role to your user:
   - Use another admin account to assign role
   - Or manually add role in database:
     ```sql
     INSERT INTO user_roles (user_id, role_id) 
     SELECT YOUR_USER_ID, id FROM roles WHERE name = 'admin';
     ```

### ❌ Error: "Invalid or expired token" (401)
**Problem**: Token is missing or expired

**Solution**:
1. Login again to get a new token
2. Update the Authorization header with new token

### ❌ Error: "User not found" (404)
**Problem**: User ID doesn't exist

**Solution**:
1. Check if user exists: `GET /api/users/:id`
2. Use a valid user ID

### ❌ Error: "Authentication required" (401)
**Problem**: Missing Authorization header

**Solution**:
1. Make sure you added the Authorization header
2. Format: `Bearer <token>` (with space after "Bearer")
3. Check the token is correct

### ❌ Method Not Allowed
**Problem**: Using wrong HTTP method

**Solution**:
- Make sure you selected **PATCH** (not GET, POST, or PUT)
- Check the URL is correct

---

## Import Postman Collection (Easiest Way)

### Step 1: Import Collection
1. Open Postman
2. Click **"Import"** button (top left)
3. Click **"Upload Files"**
4. Select `postman-collection.json` from the `api/` folder
5. Click **"Import"**

### Step 2: Create Environment
1. Click **Environments** icon (👁️)
2. Click **"+"** to create new
3. Name: **"Local Development"**
4. Add variables:
   - `base_url` = `http://localhost:4000`
   - `token` = (empty)
   - `user_id` = `31`
5. Click **"Save"**
6. Select the environment from dropdown

### Step 3: Use Collection
1. Find **"Network Desktop App API"** collection
2. Go to **"Authentication"** folder
3. Click **"Login"** request
4. Send it (token will be saved automatically)
5. Go to **"Users"** folder
6. Click **"Toggle User Status"** request
7. Send it!

---

## Visual Guide: Postman Interface

```
┌─────────────────────────────────────────────────────────┐
│ POSTMAN                                                  │
├─────────────────────────────────────────────────────────┤
│ [New] [Import] [Runner] ...  [👁️ Environments ▼]       │
├─────────────────────────────────────────────────────────┤
│ Collections                                              │
│ └── Network Desktop App API                             │
│     ├── Authentication                                   │
│     │   ├── Login                                        │
│     │   └── Register                                     │
│     └── Users                                            │
│         └── Toggle User Status  ← Click here            │
├─────────────────────────────────────────────────────────┤
│ Toggle User Status                                       │
│ [PATCH ▼] http://localhost:4000/api/users/31/toggle... │
│                                                          │
│ [Params] [Authorization] [Headers] [Body] [Pre-req]... │
│                                                          │
│ Headers:                                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Authorization: Bearer eyJhbGciOiJIUzI1NiIs...      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Body: (none)                                             │
│                                                          │
│                    [Send]  ← Click to send request      │
└─────────────────────────────────────────────────────────┘
```

---

## Common Mistakes to Avoid

1. ❌ **Using GET instead of PATCH**
   - ✅ Use PATCH method

2. ❌ **Forgetting Authorization header**
   - ✅ Add `Authorization: Bearer <token>` header

3. ❌ **Wrong token format**
   - ✅ Format: `Bearer <token>` (with space)
   - ❌ Wrong: `Bearer<token>` (no space)
   - ❌ Wrong: `<token>` (missing "Bearer")

4. ❌ **Using wrong user ID**
   - ✅ Check user exists first with GET request
   - ✅ Use valid user ID in URL

5. ❌ **Not having admin role**
   - ✅ Login as admin user
   - ✅ Or assign admin role to your user

---

## Testing Workflow

1. ✅ **Login** → Get token (auto-saved if using Tests script)
2. ✅ **Get User** → Check current `is_active` status
3. ✅ **Toggle Status** → Change status
4. ✅ **Get User** → Verify status changed
5. ✅ **Toggle Status** → Change back
6. ✅ **Get User** → Verify status changed back

---

## Need More Help?

- See `POSTMAN_GUIDE.md` for complete API documentation
- See `POSTMAN_QUICK_START.md` for quick reference
- Import `postman-collection.json` for ready-to-use collection

