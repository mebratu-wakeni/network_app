/**
 * Cloud desktop client constants (tenant SaaS — not the tenant's own customers).
 *
 * Tenant = business using PharmaSuit → identified by `client_code` at connect.
 * Customer = tenant's supplier/retailer → `customer_code` in the Customers module.
 */

export function isCloudClient() {
  return import.meta.env.VITE_CLOUD_MODE === 'true'
}

/** Default API origin (no trailing slash) for the connect screen. */
export function getDefaultServerUrl() {
  if (import.meta.env.VITE_DEFAULT_SERVER_URL) {
    return String(import.meta.env.VITE_DEFAULT_SERVER_URL).replace(/\/+$/, '')
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:4000'
  }
  return 'https://mltplc.com'
}
