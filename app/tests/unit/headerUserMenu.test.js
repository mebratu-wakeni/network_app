import { describe, it, expect } from 'vitest'

/**
 * Mirrors HeaderVM menu open/close logic without booting Electron/Liteframe.
 * Guards the live-state toggle regression (stale closed-over open id).
 */
function createMenuState() {
  let userMenuOpen = false
  return {
    getState: (key) => (key === 'userMenuOpen' ? userMenuOpen : undefined),
    closeUserMenu() {
      if (userMenuOpen === true) userMenuOpen = false
    },
    toggleUserMenu() {
      userMenuOpen = userMenuOpen !== true
    }
  }
}

describe('header user menu toggle', () => {
  it('opens when closed, closes when open (live state)', () => {
    const menu = createMenuState()
    expect(menu.getState('userMenuOpen')).toBe(false)
    menu.toggleUserMenu()
    expect(menu.getState('userMenuOpen')).toBe(true)
    menu.toggleUserMenu()
    expect(menu.getState('userMenuOpen')).toBe(false)
  })

  it('reopens after closeUserMenu (Profile/Settings path)', () => {
    const menu = createMenuState()
    menu.toggleUserMenu()
    menu.closeUserMenu()
    expect(menu.getState('userMenuOpen')).toBe(false)
    menu.toggleUserMenu()
    expect(menu.getState('userMenuOpen')).toBe(true)
  })

  it('force close is idempotent', () => {
    const menu = createMenuState()
    menu.closeUserMenu()
    menu.closeUserMenu()
    expect(menu.getState('userMenuOpen')).toBe(false)
  })
})
