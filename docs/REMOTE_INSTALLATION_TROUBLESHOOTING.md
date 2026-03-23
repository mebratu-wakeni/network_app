# Remote Installation Troubleshooting

When customers cannot finalize installation (license activation fails), use this guide.

## Activation Flow

1. **Server mode setup**: Customer runs the app, selects "Server", enters license key, installation key, company info.
2. **App** starts the local API, then calls `POST /api/license/activate` on localhost.
3. **API** validates installation key (if `LICENSE_INSTALLATION_SECRET` is set), then fetches the Google Apps Script URL.
4. **Google Script** validates the license and returns activation data.
5. **API** saves the license to the local database.

## Common Failure Causes

### 1. Invalid installation key (`INVALID_INSTALLATION_KEY`)

- **Cause**: `LICENSE_INSTALLATION_SECRET` is set on the API, but the customer's entered key does not match.
- **Fix**: Provide the correct installation key to the customer. It must match `LICENSE_INSTALLATION_SECRET` in the API's `.env` (or environment).
- **Note**: Installation key is optional in the UI, but **required** when the server has the secret configured. Customers may leave it blank and get this error.

### 2. License service timeout (`LICENSE_SERVER_TIMEOUT`)

- **Cause**: The API could not reach `script.google.com` within 25 seconds.
- **Fix**: Customer's network/firewall may block outbound HTTPS to Google. Check:
  - Corporate firewall or proxy
  - Regional restrictions
  - Poor connectivity

### 3. License service unreachable (`LICENSE_SERVER_UNREACHABLE`)

- **Cause**: Network error connecting to the Google Script (ECONNREFUSED, fetch failed, etc.).
- **Fix**: Same as timeout – verify the machine can reach `script.google.com`.

### 4. LICENSE_SCRIPT_URL not configured (`LICENSE_SCRIPT_URL_NOT_CONFIGURED`)

- **Cause**: The API has no `LICENSE_SCRIPT_URL` in its environment.
- **Fix**: Ensure the packaged app's API has access to `.env` or the variable is set when spawning the API. For packaged apps, the API folder needs a `.env` with `LICENSE_SCRIPT_URL` and optionally `LICENSE_INSTALLATION_SECRET`, or these must be injected via the spawn environment.

### 5. License already activated on another machine (`LICENSE_ALREADY_BOUND`)

- **Cause**: Google Script returned that this license is bound to a different device fingerprint.
- **Fix**: Contact admin for manual reset in the license system.

## Error Codes (API Response)

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_INSTALLATION_KEY` | 401 | Installation key missing or wrong |
| `LICENSE_SERVER_TIMEOUT` | 504 | Google Script did not respond in time |
| `LICENSE_SERVER_UNREACHABLE` | 502 | Cannot reach Google Script |
| `LICENSE_SCRIPT_URL_NOT_CONFIGURED` | 500 | Server missing `LICENSE_SCRIPT_URL` |

## Checklist for Remote Installation

1. **Installation key**: Confirm customer has the correct key and enters it.
2. **Internet**: Customer machine must reach `script.google.com` (HTTPS).
3. **Firewall/Proxy**: Corporate networks often block external URLs.
4. **API env**: Packaged app must have `LICENSE_SCRIPT_URL` (and `LICENSE_INSTALLATION_SECRET` if used) available to the API process.

## Testing the Activation Endpoint

```bash
# Replace with actual values
curl -X POST http://localhost:4000/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "YOUR-LICENSE-KEY",
    "device_fingerprint": "test-fp-123",
    "company_name": "Test Co",
    "company_phone": "123",
    "installation_key": "YOUR-INSTALLATION-SECRET"
  }'
```

Successful response: `{ "ok": true, "activated": true, "license": {...} }`  
Failed response: `{ "ok": false, "error": "...", "code": "..." }`
