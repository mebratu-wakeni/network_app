import { describe, expect, it } from 'vitest'
import { compareVersions } from '../../electron/versionCompare.js'

describe('compareVersions', () => {
  it('orders semver-like versions', () => {
    expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0)
    expect(compareVersions('1.0.2', '1.0.2')).toBe(0)
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0)
  })

  it('treats missing parts as zero', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('1', '1.0.1')).toBeLessThan(0)
  })
})
