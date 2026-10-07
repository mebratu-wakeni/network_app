/**
 * The default chart of accounts is now provisioned per-tenant during tenant
 * creation (see TenantsService.createTenant(), which uses the account list in
 * src/modules/tenants/defaultChartOfAccounts.js), not as a one-time global seed,
 * because chart_of_accounts is a tenant-scoped table and this seed runs before
 * any tenant exists.
 */
export const seed = async (_knex) => {
  // Intentionally empty.
}
