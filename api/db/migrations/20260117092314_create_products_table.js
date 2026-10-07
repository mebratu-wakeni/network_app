export const up = async (knex) => {
  await knex.schema.createTable('products', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.text('product_code')
    t.string('name', 255).notNullable()
    t.text('description')
    t.bigInteger('category_id')
    t.bigInteger('unit_id')
    t.text('remark')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('category_id').references('id').inTable('categories').onDelete('SET NULL')
    t.foreign('unit_id').references('id').inTable('units').onDelete('SET NULL')

    t.unique(['tenant_id', 'product_code'], 'products_tenant_id_product_code_unique')
    t.unique(['tenant_id', 'name', 'description', 'category_id', 'unit_id'], 'uq_product_details')
    t.index('tenant_id', 'products_tenant_id_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('products')
}
