# Startup Flow (Corrected)

## Intended Behavior

1. **Mode selection first** — When the app starts, always show Server/Client mode selection.
2. **Server mode** — If user picks Server: check if DB and license are set correctly. If not, show setup wizard or license screen.
3. **Client mode** — If user picks Client: show connection screen if not connected.

## Flow

```
app.whenReady()
  → registerRendererProtocol()
  → createMainWindow()   // No auto-start; user must choose mode first
  → loadRenderer → index.html → main.js → App.js

Renderer (NavigationVM constructor)
  → loadSetupConfig() → setup:get-config IPC
  → setup-config set, startup-mode = null
  → Render: setup-loading? → !startupMode → StartupModeLayout (mode selection)

User picks Server
  → chooseStartupMode('server') → startup:select-mode IPC
  → activateModeConfig → resolve DB path
  → If setupCompleted && dbFile: start server → waitForApiReady → resolve license
  → If !setupCompleted: return config (SetupLayout will show)
  → saveRuntimeConfig, applyRuntimeConfig
  → Return success → NavigationVM sets startup-mode = 'server'

Render after mode selected:
  → setupDone? (setupCompleted && mode match)
      → NO: SetupLayout (wizard for DB, license, etc.)
      → YES: licenseRequired? → LicenseRequiredLayout
      → YES + no license issue: clientNeedsConnection? → ClientConnectionLayout (client only)
      → LoginLayout → MainLayout
```

## Key Points

- **No auto-start on bootstrap** — Server starts only when user selects Server mode.
- **Mode selection every launch** — startup-mode is never auto-set from saved config; user must choose each session.
- **DB + license check** — When Server is selected and setup is complete: start server, validate license, then proceed or show LicenseRequiredLayout.
