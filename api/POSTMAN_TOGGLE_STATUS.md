# Postman Guide: Testing Toggle Status API

This guide shows you how to test the `PATCH /api/users/:id/toggle-status` endpoint using Postman.

## Prerequisites

1. **Postman installed** (Desktop app or browser extension)
2. **API server running** on `http://localhost:4000`
3. **Valid JWT token** from a logged-in admin user

## Step-by-Step Instructions

### Step 1: Get an Admin JWT Token

First, you need to login as an admin user to get a JWT token.

#### Option A: Login via Postman

1. **Create a new request**
   - Click "New" → "HTTP Request"
   - Name it: "Login - Admin"

2. **Configure the request**
   - Method: `POST`
   - URL: `http://localhost:4000/api/auth/login`
   - Headers:
     - Key: `Content-Type`
     - Value: `application/json`
   - Body (select "raw" and "JSON"):
     ```json
     {
       "username": "newusername",
       "password": "password123"
     }
     ```

3. **Send the request**
   - Click "Send"
   - Copy the `token` value from the response:
     ```json
     {
       "ok": true,
       "user": {...},
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     }
     ```

#### Option B: Use curl (if you prefer)

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"newusername","password":"password123"}'
```

Copy the `token` from the response.

---

### Step 2: Set Up the Toggle Status Request

1. **Create a new request**
   - Click "New" → "HTTP Request"
   - Name it: "Toggle User Status"

2. **Set the HTTP method**
   - Select `PATCH` from the method dropdown

3. **Set the URL**
   - URL: `http://localhost:4000/api/users/31/toggle-status`
   - Replace `31` with the actual user ID you want to toggle
   - Example: `http://localhost:4000/api/users/2/toggle-status`

4. **Set the Authorization header**
   - Go to the "Headers" tab
   - Add a new header:
     - Key: `Authorization`
     - Value: `Bearer YOUR_TOKEN_HERE`
     - Replace `YOUR_TOKEN_HERE` with the token from Step 1
     - Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

5. **Send the request**
   - Click "Send"
   - You should see a response like:
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

---

### Step 3: Verify the Status Changed

1. **Create a new request to get user details**
   - Method: `GET`
   - URL: `http://localhost:4000/api/users/31`
   - Headers:
     - `Authorization: Bearer YOUR_TOKEN_HERE`
   - Send the request
   - Check the `is_active` field in the response

2. **Toggle again to verify**
   - Use the same PATCH request from Step 2
   - Send it again
   - The `is_active` status should toggle back

---

## Using Postman Environment Variables (Recommended)

To make testing easier, set up environment variables:

### Step 1: Create an Environment

1. Click the "Environments" icon (eye icon) in the top right
2. Click "+" to create a new environment
3. Name it: "Local Development"
4. Add these variables:
   - `base_url`: `http://localhost:4000`
   - `token`: (leave empty, will be set after login)
   - `user_id`: `31` (or any user ID you want to test)

### Step 2: Use Variables in Requests

1. **Login request URL**: `{{base_url}}/api/auth/login`
2. **Toggle status URL**: `{{base_url}}/api/users/{{user_id}}/toggle-status`
3. **Authorization header**: `Bearer {{token}}`

### Step 3: Auto-save Token

1. In your login request, go to the "Tests" tab
2. Add this script to automatically save the token:
   ```javascript
   if (pm.response.code === 200) {
       const jsonData = pm.response.json();
       if (jsonData.token) {
           pm.environment.set("token", jsonData.token);
           console.log("Token saved to environment");
       }
   }
   ```
3. After sending the login request, the token will be automatically saved

---

## Complete Postman Collection Setup

### Collection Structure

```
📁 Network Desktop App API
  📁 Authentication
    🔹 POST Login
    🔹 POST Register
  📁 Users
    🔹 GET User by ID
    🔹 PATCH Update Profile
    🔹 PATCH Toggle Status
    🔹 DELETE Remove Avatar
    🔹 POST Change Password
    🔹 GET User Permissions
  📁 Roles (Admin Only)
    🔹 POST Assign Role
    🔹 DELETE Remove Role
  📁 Rules (Admin Only)
    🔹 POST Assign Rule
    🔹 DELETE Remove Rule
```

### Sample Requests

#### 1. Login Request
- **Method**: POST
- **URL**: `{{base_url}}/api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "username": "newusername",
    "password": "password123"
  }
  ```
- **Tests Tab** (save token):
  ```javascript
  if (pm.response.code === 200) {
      const jsonData = pm.response.json();
      if (jsonData.token) {
          pm.environment.set("token", jsonData.token);
      }
  }
  ```

#### 2. Toggle User Status
- **Method**: PATCH
- **URL**: `{{base_url}}/api/users/{{user_id}}/toggle-status`
- **Headers**:
  - `Authorization: Bearer {{token}}`
- **Body**: (none needed)
- **Pre-request Script** (optional - get user ID from previous request):
  ```javascript
  // Set user_id from previous response if needed
  // pm.environment.set("user_id", "31");
  ```

#### 3. Get User Details
- **Method**: GET
- **URL**: `{{base_url}}/api/users/{{user_id}}`
- **Headers**:
  - `Authorization: Bearer {{token}}`

---

## Troubleshooting

### Error: "Forbidden" (403)
- **Cause**: User doesn't have admin role
- **Solution**: Login as a user with admin role, or assign admin role to your user

### Error: "Invalid or expired token" (401)
- **Cause**: Token is missing, invalid, or expired
- **Solution**: Login again to get a new token

### Error: "User not found" (404)
- **Cause**: User ID doesn't exist
- **Solution**: Use a valid user ID (check with GET `/api/users/:id` first)

### Error: "Authentication required" (401)
- **Cause**: Missing Authorization header
- **Solution**: Add `Authorization: Bearer YOUR_TOKEN` header

---

## Quick Test Checklist

- [ ] Server is running on `http://localhost:4000`
- [ ] Login request returns a token
- [ ] Token is saved to environment variable
- [ ] User ID exists in database
- [ ] User has admin role (for toggle status endpoint)
- [ ] Authorization header is set correctly
- [ ] HTTP method is `PATCH`
- [ ] URL includes the user ID

---

## Example: Complete Workflow

1. **Login** → Get token
2. **Save token** to environment variable
3. **Get user** → Verify current status (`is_active: true/false`)
4. **Toggle status** → Change status
5. **Get user again** → Verify status changed
6. **Toggle status again** → Change back
7. **Get user again** → Verify status changed back

---

## Pro Tips

1. **Use Pre-request Scripts**: Automatically set variables before requests
2. **Use Tests Tab**: Automatically verify responses and save data
3. **Use Collection Runner**: Run multiple requests in sequence
4. **Use Environments**: Switch between local, staging, and production easily
5. **Save Responses**: Click "Save Response" to keep examples
6. **Use Folders**: Organize requests by feature/module

---

## Additional Resources

- [Postman Documentation](https://learning.postman.com/docs/)
- [Postman Environment Variables](https://learning.postman.com/docs/sending-requests/variables/)
- [Postman Pre-request Scripts](https://learning.postman.com/docs/writing-scripts/pre-request-scripts/)

