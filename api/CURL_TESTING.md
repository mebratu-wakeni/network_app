# API testing with curl (cheatsheet)

Base URL
- Local: http://localhost:4000

Tools (recommended)
- jq (pretty-print JSON): brew install jq

Auth flow (username + password)
1) Register (optional)
```bash
curl -sS -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"password123","display_name":"Admin"}' | jq
```

2) Login → get token
```bash
curl -sS -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"password123"}' | jq
```

3) Save token to env var (macOS/Linux)
```bash
TOKEN=$(curl -sS -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"password123"}' | jq -r '.token')
```

4) Check current user (protected)
```bash
curl -sS http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

Health checks
```bash
curl -sS http://localhost:4000/health | jq
curl -sS http://localhost:4000/api/db-health | jq
```

Test Items (CRUD)
- List (viewer/admin)
```bash
curl -sS http://localhost:4000/api/test-items \
  -H "Authorization: Bearer $TOKEN" | jq
```

- Create (admin)
```bash
curl -sS -X POST http://localhost:4000/api/test-items \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Item A","quantity":3}' | jq
```

- Get one
```bash
curl -sS http://localhost:4000/api/test-items/1 \
  -H "Authorization: Bearer $TOKEN" | jq
```

- Update
```bash
curl -sS -X PUT http://localhost:4000/api/test-items/1 \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"quantity":10}' | jq
```

- Delete
```bash
curl -sS -X DELETE http://localhost:4000/api/test-items/1 \
  -H "Authorization: Bearer $TOKEN" | jq
```

Users
- Get profile (protected)
```bash
curl -sS http://localhost:4000/api/users/1 \
  -H "Authorization: Bearer $TOKEN" | jq
```

Tips
- Add -v to curl for verbose output
- Common errors:
  - 401 Unauthorized: missing/invalid token → re-login; pass Authorization header
  - 403 Forbidden: lacking permission → role/rules mismatch
  - 400 Validation failed: check request body (zod errors in details[])
