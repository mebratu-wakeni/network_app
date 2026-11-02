# Local Managed Cloud UI → remote API

Run the desktop UI on your machine while talking to **https://server.masatechplc.com** (or another host).

```bash
cd app
cp cloud-dev.env.sample .env.cloud
```

Or create **`app/.env.cloud`** manually with:

```env
VITE_CLOUD_MODE=true
VITE_DEFAULT_SERVER_URL=https://server.masatechplc.com
```

Then:

```bash
npm install
npm run dev:cloud
```

Log in with your tenant **client code** and user (same as production). Open **Sales → View last receipt** or history → **View receipt** to preview layout/print.

**Note:** Receipt **Unit** column data comes from the API (`unit_name` on receipt items). Until that API build is deployed on the server, the column appears but may show **—**; row #, code, and name still come from existing receipt fields.
