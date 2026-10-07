# Collaborator Setup and License Activation Guide

This guide explains how to switch to the correct branch, run the app in development, and complete first-time license activation.

## 1) Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (or compatible)
- Git installed
- Internet connection for the first license activation

## 2) Get the latest code and switch branch

Run these commands from a terminal:

```bash
git clone https://github.com/mebratu-wakeni/network_app.git
cd network_app
git fetch origin
git checkout feature/sqlite3-version
git pull
```

If you already cloned the repo before:

```bash
cd network_app
git fetch origin
git checkout feature/sqlite3-version
git pull
```

## 3) Install dependencies

Install for both backend and desktop app:

```bash
cd api && npm install
cd ../app && npm install
```

## 4) Verify license environment in API

Open `api/.env` and confirm these values exist:

```env
LICENSE_SCRIPT_URL=MSL-SETUP-2026-LOCAL
LICENSE_INSTALLATION_SECRET=take one of the keys in the googlesheet
```

Do not change these unless instructed.

## 5) Start the app (development)

From the `app` folder:

```bash
npm run dev
```

Notes:
- The Electron app launches from this command.
- In **Server mode**, the app starts the API automatically, runs migrations, and initializes SQLite.
- You do not need to start `api` manually for normal first-run setup testing.

## 6) First-run wizard activation steps

1. Open app, choose **Server (host + database)** mode.
2. Keep default DB directory unless instructed otherwise.
3. Keep default port (or use the one provided by owner).
4. On the **License** step, enter:
   - **Installation key**: `<installation key provided privately>`
   - **License key**: `<license key provided privately>`
   - **Company name**
   - **Company phone**
5. Click **Finish**.
6. If activation succeeds, app moves to login screen.

## 7) Test with a clean first-run state (optional)

If setup was already completed and you need to retest first-run:

- Close the app fully.
- Remove runtime config and DB used for setup (owner can provide exact paths per OS).
- Start again with `npm run dev` from `app`.

## 8) Troubleshooting

- **Wizard says license/API error on first run**
  - Ensure internet is available.
  - Recheck `api/.env` has correct license values.
  - Fully restart app after editing `.env`.

- **Branch not found locally**
  - Run `git fetch origin` first, then checkout branch again.

- **Port already in use**
  - Change server port in wizard, then retry.

