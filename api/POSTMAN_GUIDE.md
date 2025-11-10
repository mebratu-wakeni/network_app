# Postman Guide for Network Desktop App API

## Quick Start: Testing Toggle Status API

### Step 1: Login and Get Token

1. **Create new request** → Name: "Login"
2. **Method**: `POST`
3. **URL**: `http://localhost:4000/api/auth/login`
4. **Headers** → Add:
   - Key: `Content-Type`
   - Value: `application/json`
5. **Body** → Select "raw" → Select "JSON" → Paste:
   ```json
   {
     "username": "newusername",
     "password": "password123"
   }
   ```
6. **Send** → Copy the `token` from response (looks like `eyJhbGciOiJIUzI1NiIs...`)

### Step 2: Toggle User Status

1. **Create new request** → Name: "Toggle User Status"
2. **Method**: Select `PATCH` from dropdown
3. **URL**: `http://localhost:4000/api/users/31/toggle-status`
   - Replace `31` with the user ID you want to toggle
4. **Headers** → Add:
   - Key: `Authorization`
   - Value: `Bearer YOUR_TOKEN_HERE`
   - Replace `YOUR_TOKEN_HERE` with the token from Step 1
5. **Body**: (leave empty - no body needed for this endpoint)
6. **Send** → Check response

### Expected Response

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

The `is_active` field shows the new status after toggling.

---

## Using Environment Variables (Recommended)

### Setup Environment

1. Click **Environments** icon (👁️ eye icon) in top right
2. Click **+** to create new environment
3. Name it: "Local Development"
4. Add variables:
   - `base_url` = `http://localhost:4000`
   - `token` = (leave empty - will be set automatically)
   - `user_id` = `31` (or any user ID)

### Use Variables in Requests

**Login URL**: `{{base_url}}/api/auth/login`

**Toggle Status URL**: `{{base_url}}/api/users/{{user_id}}/toggle-status`

**Authorization Header**: `Bearer {{token}}`

### Auto-save Token

In your Login request:
1. Go to **Tests** tab
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
3. After sending login, token is automatically saved!

---

## Complete API Endpoints

### Authentication

#### Register
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/register`
- **Body**:
  ```json
  {
    "username": "testuser",
    "password": "password123",
    "display_name": "Test User"
  }
  ```

#### Login
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/login`
- **Body**:
  ```json
  {
    "username": "testuser",
    "password": "password123"
  }
  ```
- **Tests** (auto-save token):
  ```javascript
  if (pm.response.code === 200) {
      const jsonData = pm.response.json();
      if (jsonData.token) {
          pm.environment.set("token", jsonData.token);
      }
  }
  ```

### User Management

#### Get User
- **Method**: GET
- **URL**: `{{base_url}}/api/users/{{user_id}}`
- **Headers**: `Authorization: Bearer {{token}}`

#### Update User Profile
- **Method**: PUT
- **URL**: `{{base_url}}/api/users/{{user_id}}`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**:
  ```json
  {
    "display_name": "Updated Name"
  }
  ```

#### Toggle User Status (Admin Only)
- **Method**: PATCH
- **URL**: `{{base_url}}/api/users/{{user_id}}/toggle-status`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**: (none)

#### Update Own Profile
- **Method**: PATCH
- **URL**: `{{base_url}}/api/users/profile`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**:
  ```json
  {
    "displayName": "My New Name",
    "email": "newemail@example.com"
  }
  ```

#### Change Password
- **Method**: POST
- **URL**: `{{base_url}}/api/users/change-password`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**:
  ```json
  {
    "currentPassword": "oldpassword123",
    "newPassword": "newpassword123",
    "confirmPassword": "newpassword123"
  }
  ```

#### Remove Avatar
- **Method**: DELETE
- **URL**: `{{base_url}}/api/users/avatar`
- **Headers**: `Authorization: Bearer {{token}}`

#### Upload Avatar
- **Method**: POST
- **URL**: `{{base_url}}/api/users/avatar`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**: form-data
  - Key: `avatar` (type: File)
  - Value: Select image file

#### Get User Permissions
- **Method**: GET
- **URL**: `{{base_url}}/api/users/{{user_id}}/permissions`
- **Headers**: `Authorization: Bearer {{token}}`

#### Search Users
- **Method**: POST
- **URL**: `{{base_url}}/api/users/search`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**:
  ```json
  {
    "searchQuery": "test",
    "tableConfig": {
      "limit": 10,
      "offset": 0,
      "sortBy": "username",
      "orderBy": "asc"
    }
  }
  ```

### Role Management (Admin Only)

#### Assign Role
- **Method**: POST
- **URL**: `{{base_url}}/api/users/{{user_id}}/roles`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**:
  ```json
  {
    "roleName": "manager"
  }
  ```
  OR
  ```json
  {
    "roleId": 5
  }
  ```

#### Remove Role
- **Method**: DELETE
- **URL**: `{{base_url}}/api/users/{{user_id}}/roles`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**:
  ```json
  {
    "roleName": "manager"
  }
  ```

### Rule Management (Admin Only)

#### Assign Rule
- **Method**: POST
- **URL**: `{{base_url}}/api/users/{{user_id}}/rules`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**:
  ```json
  {
    "ruleKey": "products.read"
  }
  ```
  OR
  ```json
  {
    "ruleId": 12
  }
  ```

#### Remove Rule
- **Method**: DELETE
- **URL**: `{{base_url}}/api/users/{{user_id}}/rules`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**:
  ```json
  {
    "ruleKey": "products.read"
  }
  ```

---

## Troubleshooting

### 401 Unauthorized
- **Cause**: Missing or invalid token
- **Solution**: Login again to get a new token

### 403 Forbidden
- **Cause**: User doesn't have required role/permission
- **Solution**: Login as admin or assign appropriate role

### 404 Not Found
- **Cause**: User ID doesn't exist
- **Solution**: Use a valid user ID

### 400 Validation Failed
- **Cause**: Request body doesn't match schema
- **Solution**: Check the body format matches examples above

---

## Pro Tips

1. **Use Collections**: Organize requests by feature
2. **Use Folders**: Group related requests
3. **Save Responses**: Keep examples for reference
4. **Use Pre-request Scripts**: Set variables automatically
5. **Use Tests**: Automatically verify responses
6. **Export Collection**: Share with team

---

## Quick Reference: Toggle Status

| Setting | Value |
|---------|-------|
| Method | `PATCH` |
| URL | `http://localhost:4000/api/users/:id/toggle-status` |
| Headers | `Authorization: Bearer <token>` |
| Body | (none) |
| Requires | Admin role |
| Response | Updated user object with toggled `is_active` |

---

For detailed step-by-step guide, see `POSTMAN_TOGGLE_STATUS.md`
For quick start, see `POSTMAN_QUICK_START.md`
