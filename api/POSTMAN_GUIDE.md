# Postman quick guide (for this API)

## 1) Create an Environment
- Click Environments → New
- Add variables:
  - baseUrl = http://localhost:4000
  - token = (leave empty for now)
- Save as: Local API

## 2) Create a Collection
- Collections → New Collection → name: Desktop API
- Set Authorization (tab) = Bearer Token
  - Token: {{token}}
- Save

## 3) Add Requests

### Auth → Register
- Method: POST
- URL: {{baseUrl}}/api/auth/register
- Body → raw → JSON:
```json
{
  "username": "admin",
  "password": "password123",
  "display_name": "Admin"
}
```

### Auth → Login
- Method: POST
- URL: {{baseUrl}}/api/auth/login
- Body → raw → JSON:
```json
{
  "username": "admin",
  "password": "password123"
}
```
- Tests (tab): store token automatically
```javascript
const json = pm.response.json();
if (json && json.token) {
  pm.environment.set('token', json.token);
}
```
- Send → token saved to environment

### Auth → Me (protected)
- Method: GET
- URL: {{baseUrl}}/api/auth/me
- Authorization is inherited (Bearer {{token}})

### Health
- GET {{baseUrl}}/health
- GET {{baseUrl}}/api/db-health

### Test Items → List
- GET {{baseUrl}}/api/test-items

### Test Items → Create (admin)
- POST {{baseUrl}}/api/test-items
- Body → raw → JSON:
```json
{
  "name": "Item A",
  "quantity": 3
}
```

### Test Items → Get one
- GET {{baseUrl}}/api/test-items/1

### Test Items → Update
- PUT {{baseUrl}}/api/test-items/1
- Body → raw → JSON:
```json
{
  "quantity": 10
}
```

### Test Items → Delete
- DELETE {{baseUrl}}/api/test-items/1

## 4) Troubleshooting
- 401 Unauthorized:
  - Login first; ensure {{token}} set in environment
  - Check Authorization tab = Bearer Token
- 403 Forbidden:
  - Your user lacks permission; assign appropriate role/rules
- 400 Validation failed:
  - Check request body matches the schema

## 5) Optional: Export/Share
- Right-click collection → Export (v2.1)
- Export environment as well
