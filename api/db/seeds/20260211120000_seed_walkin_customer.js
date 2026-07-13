/**
 * The "Walk-in" customer is now created per-tenant during tenant provisioning
 * (see TenantsService.createTenant()), not as a one-time global seed, because
 * `customers` is a tenant-scoped table and this seed runs before any tenant exists.
 */
export const seed = async (_knex) => {
  // Intentionally empty.
}
