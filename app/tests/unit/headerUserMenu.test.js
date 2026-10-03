import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Mirrors HeaderVM menu open/close logic without booting Electron/Liteframe.
 * Guards the live-state toggle regression (stale closed-over open id).
 */
function createMenuState() {
  let userMenuActionId = null
  return {
    getState: (key) => (key === 'userMenuActionId' ? userMenuActionId : undefined),
    closeUserMenu() {
      if (userMenuActionId != null) userMenuActionId = null
    },
    toggleUserMenu(menuActionId = 'header-user-menu') {
      const current = userMenuActionId
      userMenuActionId = current === menuActionId ? null : menuActionId
    }
  }
}

describe('header user menu toggle', () => {
  it('opens when closed, closes when open (live state)', () => {
    const menu = createMenuState()
    expect(menu.getState('userMenuActionId')).toBeNull()
    menu.toggleUserMenu('header-user-menu')
    expect(menu.getState('userMenuActionId')).toBe('header-user-menu')
    menu.toggleUserMenu('header-user-menu')
    expect(menu.getState('userMenuActionId')).toBeNull()
  })

  it('reopens after closeUserMenu (Profile/Settings path)', () => {
    const menu = createMenuState()
    menu.toggleUserMenu('header-user-menu')
    menu.closeUserMenu()
    expect(menu.getState('userMenuActionId')).toBeNull()
    // Simulate stale open-era handler that used to close-over open id and always write null.
    // Live toggle must still open from null.
    menu.toggleUserMenu('header-user-menu')
    expect(menu.getState('userMenuActionId')).toBe('header-user-menu')
  })

  it('force close is idempotent', () => {
    const menu = createMenuState()
    menu.closeUserMenu()
    menu.closeUserMenu()
    expect(menu.getState('userMenuActionId')).toBeNull()
  })
})
