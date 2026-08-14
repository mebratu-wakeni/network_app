import { describe, expect, it } from 'vitest'
import {
  displayErrorText,
  extractErrorMessage,
  formatUserError,
  isNoOpenFiscalYearError,
  summarizeLoadErrors
} from '../../../src/components/utils/userErrorMessage.js'

describe('userErrorMessage', () => {
  it('strips Electron IPC wrapper text', () => {
    const raw =
      "Error invoking remote method 'purchase:get-stats': Error: Authentication required"
    expect(extractErrorMessage(raw)).toBe('Authentication required')
    expect(formatUserError(raw)).toBe(
      'Your session has expired. Please sign out and sign in again.'
    )
  })

  it('maps missing fiscal year to setup guidance', () => {
    expect(formatUserError('No open fiscal year found')).toBe(
      'No fiscal year is set up yet. Open Settings → Fiscal Year to create one.'
    )
    expect(isNoOpenFiscalYearError('No open fiscal year found')).toBe(true)
  })

  it('summarizes duplicate dashboard auth failures', () => {
    const msg = summarizeLoadErrors([
      new Error("Error invoking remote method 'sales:get-orders': Error: Authentication required"),
      new Error("Error invoking remote method 'purchase:get-stats': Error: Authentication required")
    ])
    expect(msg).toBe('Your session has expired. Please sign out and sign in again.')
  })

  it('displayErrorText handles VM error shapes', () => {
    expect(displayErrorText({ message: 'No open fiscal year found' })).toContain('Fiscal Year')
    expect(displayErrorText('plain error', 'fallback')).toBe('plain error')
  })
})
