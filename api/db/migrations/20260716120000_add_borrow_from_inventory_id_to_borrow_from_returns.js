/**
 * Link each borrow_from_returns row to the obligation (borrow_from_inventories.id).
 * Column stays nullable for safety; backfill assigns existing rows where possible.
 *
 * Managed Cloud (PostgreSQL on cPanel / phpPgAdmin only):
 *   api/db/sql/20260716120000_add_borrow_from_inventory_id_to_borrow_from_returns.sql
 */

export const up = async (knex) => {
  const client = knex.client.config.client
  const isPg = client === 'pg' || client === 'postgres'

  const hasColumn = await knex.schema.hasColumn('borrow_from_returns', 'borrow_from_inventory_id')
  if (!hasColumn) {
    await knex.schema.alterTable('borrow_from_returns', (t) => {
      t.bigInteger('borrow_from_inventory_id').unsigned().nullable()
    })
  }

  if (isPg) {
    const fkExists = await knex.raw(`
      SELECT 1 FROM pg_constraint
      WHERE conname = 'borrow_from_returns_borrow_from_inventory_id_foreign'
    `)
    if (!fkExists.rows?.length) {
      await knex.schema.alterTable('borrow_from_returns', (t) => {
        t.foreign('borrow_from_inventory_id')
          .references('id')
          .inTable('borrow_from_inventories')
          .onDelete('RESTRICT')
      })
    }
  }

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS borrow_from_returns_borrow_from_inventory_id_index
    ON borrow_from_returns (borrow_from_inventory_id)
  `)

  await backfillBorrowFromReturnObligations(knex)
}

export const down = async (knex) => {
  const client = knex.client.config.client
  const isPg = client === 'pg' || client === 'postgres'

  await knex.raw('DROP INDEX IF EXISTS borrow_from_returns_borrow_from_inventory_id_index')

  if (isPg) {
    await knex.schema.alterTable('borrow_from_returns', (t) => {
      t.dropForeign(['borrow_from_inventory_id'])
    })
  }

  const hasColumn = await knex.schema.hasColumn('borrow_from_returns', 'borrow_from_inventory_id')
  if (hasColumn) {
    await knex.schema.alterTable('borrow_from_returns', (t) => {
      t.dropColumn('borrow_from_inventory_id')
    })
  }
}

/**
 * Assign borrow_from_inventory_id on legacy return rows (FIFO by borrow date / id per inventory lot).
 */
async function backfillBorrowFromReturnObligations(knex) {
  const hasColumn = await knex.schema.hasColumn('borrow_from_returns', 'borrow_from_inventory_id')
  if (!hasColumn) return

  const legacyReturns = await knex('borrow_from_returns')
    .whereNull('borrow_from_inventory_id')
    .select('id', 'tenant_id', 'borrowed_inventory_id', 'quantity_returned', 'returned_on')
    .orderBy([
      { column: 'tenant_id', order: 'asc' },
      { column: 'borrowed_inventory_id', order: 'asc' },
      { column: 'returned_on', order: 'asc' },
      { column: 'id', order: 'asc' }
    ])

  if (!legacyReturns.length) return

  const groups = new Map()
  for (const row of legacyReturns) {
    const key = `${row.tenant_id}:${row.borrowed_inventory_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  for (const [key, returns] of groups) {
    const sep = key.indexOf(':')
    const tenantId = Number(key.slice(0, sep))
    const inventoryId = Number(key.slice(sep + 1))

    const obligations = await knex('borrow_from_inventories')
      .where({ tenant_id: tenantId, inventory_id: inventoryId })
      .select('id', 'quantity', 'borrowed_date')
      .orderBy([
        { column: 'borrowed_date', order: 'asc' },
        { column: 'id', order: 'asc' }
      ])

    if (obligations.length === 0) {
      console.warn(
        `[backfill borrow_from_returns] No borrow_from_inventories for tenant=${tenantId} inventory_id=${inventoryId}; ${returns.length} return(s) left unlinked`
      )
      continue
    }

    if (obligations.length === 1) {
      await knex('borrow_from_returns')
        .whereIn('id', returns.map((r) => r.id))
        .update({ borrow_from_inventory_id: obligations[0].id })
      continue
    }

    /** @type {Map<number, number>} obligationId -> qty already assigned from legacy returns */
    const allocated = new Map(obligations.map((o) => [o.id, 0]))

    for (const ret of returns) {
      const qty = parseInt(ret.quantity_returned, 10) || 0
      let assigned = null

      for (const ob of obligations) {
        const used = allocated.get(ob.id) || 0
        const cap = parseInt(ob.quantity, 10) || 0
        const remaining = cap - used
        if (remaining <= 0) continue
        if (qty <= remaining) {
          assigned = ob.id
          allocated.set(ob.id, used + qty)
          break
        }
      }

      if (!assigned) {
        for (const ob of obligations) {
          const used = allocated.get(ob.id) || 0
          const cap = parseInt(ob.quantity, 10) || 0
          if (used < cap) {
            assigned = ob.id
            allocated.set(ob.id, used + qty)
            break
          }
        }
      }

      if (assigned) {
        await knex('borrow_from_returns')
          .where({ id: ret.id })
          .update({ borrow_from_inventory_id: assigned })
      } else {
        console.warn(
          `[backfill borrow_from_returns] Could not FIFO-assign return id=${ret.id} tenant=${tenantId}`
        )
      }
    }
  }
}
