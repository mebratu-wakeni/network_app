import { compareVersions } from '../lib/versionCompare.js'

/**
 * Reject desktop clients older than MIN_SUPPORTED_CLIENT_VERSION.
 *
 * Opt-in: when the env var is unset/empty, this is a no-op.
 * Requests without X-Client-Version (curl, admin tooling, browsers) are allowed
 * so ops and non-desktop callers keep working. Packaged Electron always sends
 * the header via apiFetch.
 */
export function minClientVersion(req, res, next) {
  const min = String(process.env.MIN_SUPPORTED_CLIENT_VERSION || '').trim()
  if (!min) return next()

  const clientVersion = String(
    req.get('x-client-version') || req.get('X-Client-Version') || ''
  ).trim()
  if (!clientVersion) return next()

  if (compareVersions(clientVersion, min) < 0) {
    return res.status(426).json({
      ok: false,
      error: 'Client update required',
      code: 'CLIENT_OUTDATED',
      minSupportedVersion: min,
      message: `PharmaSuit ${min} or newer is required. Please update the app to continue.`
    })
  }

  return next()
}
