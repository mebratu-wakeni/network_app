import knex from '../db/knex.js'

export const listItems = async (_req, res) => {
  const items = await knex('test_items').select('*').orderBy('id', 'desc')
  res.json({ ok: true, items })
}

export const getItem = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: 'Invalid id' })
  const item = await knex('test_items').where({ id }).first()
  if (!item) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, item })
}

export const createItem = async (req, res) => {
  const { name, quantity } = req.body || {}
  if (!name || typeof name !== 'string') return res.status(400).json({ ok: false, error: 'name is required' })
  const qty = quantity == null ? 0 : Number(quantity)
  if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ ok: false, error: 'quantity must be a non-negative number' })
  const [created] = await knex('test_items')
    .insert({ name, quantity: qty })
    .returning(['id', 'name', 'quantity', 'created_at', 'updated_at'])
  res.status(201).json({ ok: true, item: created })
}

export const updateItem = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: 'Invalid id' })
  const { name, quantity } = req.body || {}
  const update = {}
  if (name != null) {
    if (typeof name !== 'string' || !name) return res.status(400).json({ ok: false, error: 'Invalid name' })
    update.name = name
  }
  if (quantity != null) {
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ ok: false, error: 'quantity must be a non-negative number' })
    update.quantity = qty
  }
  if (Object.keys(update).length === 0) return res.status(400).json({ ok: false, error: 'No fields to update' })
  const [updated] = await knex('test_items')
    .where({ id })
    .update(update)
    .returning(['id', 'name', 'quantity', 'created_at', 'updated_at'])
  if (!updated) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, item: updated })
}

export const deleteItem = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: 'Invalid id' })
  const deleted = await knex('test_items').where({ id }).del()
  if (!deleted) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true })
}

export default { listItems, getItem, createItem, updateItem, deleteItem }

