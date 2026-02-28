import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/components/utils/PermissionChecker.js', () => ({
  permissionChecker: {
    loadPermissions: vi.fn().mockResolvedValue(true)
  }
}))

import { InventoryVM } from '../../../src/components/modules/inventory/InventoryVM.js'

describe('InventoryVM', () => {
  beforeEach(() => {
    window.ipcRenderer.invoke.mockReset()
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'inventory:get-products') {
        return { success: true, products: [], total: 0, stats: { outOfStock: 0, lowStock: 0 } }
      }
      return { success: true }
    })
  })

  it('loads products and updates list, count, and stats', async () => {
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'inventory:get-products') {
        return {
          success: true,
          products: [{ id: 1, name: 'Paracetamol' }],
          total: 1,
          stats: { outOfStock: 2, lowStock: 4 }
        }
      }
      return { success: true }
    })

    const vm = new InventoryVM()
    await vm.loadProducts()

    expect(vm.getState('product-list')).toEqual([{ id: 1, name: 'Paracetamol' }])
    expect(vm.getState('product-total-count')).toBe(1)
    expect(vm.getState('product-stats')).toEqual({ outOfStock: 2, lowStock: 4 })
  })

  it('fails createProduct when category is missing and sets error state', async () => {
    const vm = new InventoryVM()
    vm.updateState('loading', false)
    await expect(
      vm.createProduct({
        name: 'New Product',
        unit_id: 1
      })
    ).rejects.toThrow('Category is required')

    expect(vm.getState('error')).toEqual({ message: 'Category is required' })
  })

  it('updates filter, resets paging, and triggers reload', () => {
    const vm = new InventoryVM()
    const loadSpy = vi.fn()
    vm.loadProducts = loadSpy
    vm.updateState('product-table-config', { limit: 10, offset: 30, sortBy: 'id', orderBy: 'desc' })

    vm.setProductFilter('low-stock')

    expect(vm.getState('product-filter')).toBe('low-stock')
    expect(vm.getState('product-table-config').offset).toBe(0)
    expect(loadSpy).toHaveBeenCalledTimes(1)
  })
})
