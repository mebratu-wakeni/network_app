import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { listItems, getItem, createItem, updateItem, deleteItem } from '../controllers/testItems.controller.js'

const router = Router()

// Example RBAC: only admin can create/update/delete, viewer can read
router.get('/', requireRole(['admin', 'viewer']), listItems)
router.get('/:id', requireRole(['admin', 'viewer']), getItem)
router.post('/', requireRole(['admin']), createItem)
router.put('/:id', requireRole(['admin']), updateItem)
router.delete('/:id', requireRole(['admin']), deleteItem)

export default router

