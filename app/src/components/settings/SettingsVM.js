const { ViewModel, SharedStateManager } = Liteframe

export class SettingsVM extends ViewModel {
  constructor(stateManager) {
    super(stateManager)
    this.initializeStates()
    this.loadSettings()
  }

  initializeStates() {
    this.setState('loading', false)
    this.setState('error', null)
    this.setState('success', null)
    this.setState('settings-active-tab', 'general')
    this.setState('form', {
      withhold_percentage: '',
      company_name: '',
      company_address: '',
      company_phone: '',
      company_email: '',
      company_tin: '',
      company_logo_url: ''
    })
    this.setState('fiscal-years', [])
    this.setState('current-fiscal-year', null)
    this.setState('fiscal-years-loading', false)
    this.setState('fiscal-years-error', null)
    this.setState('close-fiscal-year-loading', false)
    this.setState('reopen-fiscal-year-loading', false)
    this.setState('create-fiscal-year-loading', false)
    this.setState('report-fy-year', null)
    this.setState('report-data', null)
    this.setState('report-loading', false)
  }

  async loadSettings() {
    this.updateState('loading', true)
    this.updateState('error', null)
    try {
      const result = await window.ipcRenderer.invoke('settings:get')
      if (result && result.success && result.settings) {
        this.updateState('form', {
          withhold_percentage: result.settings.withhold_percentage ?? '',
          company_name: result.settings.company_name ?? '',
          company_address: result.settings.company_address ?? '',
          company_phone: result.settings.company_phone ?? '',
          company_email: result.settings.company_email ?? '',
          company_tin: result.settings.company_tin ?? '',
          company_logo_url: result.settings.company_logo_url ?? ''
        })
      }
    } catch (err) {
      this.updateState('error', err.message || 'Failed to load settings')
    } finally {
      this.updateState('loading', false)
    }
  }

  getSettingsTab() {
    return this.getState('settings-active-tab') || 'general'
  }

  setSettingsTab(tab) {
    this.updateState('settings-active-tab', tab)
    if (tab === 'fiscal-year') {
      this.loadFiscalYears()
    }
  }

  async loadFiscalYears() {
    this.updateState('fiscal-years-loading', true)
    this.updateState('fiscal-years-error', null)
    try {
      const [listRes, currentRes] = await Promise.all([
        window.ipcRenderer.invoke('fiscal-years:list'),
        window.ipcRenderer.invoke('fiscal-years:get-current')
      ])
      if (listRes?.success && Array.isArray(listRes.fiscal_years)) {
        this.updateState('fiscal-years', listRes.fiscal_years)
      }
      if (currentRes?.success && currentRes.fiscal_year) {
        this.updateState('current-fiscal-year', currentRes.fiscal_year)
      } else {
        this.updateState('current-fiscal-year', null)
      }
    } catch (err) {
      this.updateState('fiscal-years-error', err.message || 'Failed to load fiscal years')
      this.updateState('fiscal-years', [])
      this.updateState('current-fiscal-year', null)
    } finally {
      this.updateState('fiscal-years-loading', false)
    }
  }

  async createFiscalYear({ fiscal_year, start_date, end_date }) {
    this.updateState('create-fiscal-year-loading', true)
    this.updateState('fiscal-years-error', null)
    try {
      const result = await window.ipcRenderer.invoke('fiscal-years:create', {
        fiscal_year: Number(fiscal_year),
        start_date,
        end_date
      })
      if (result?.success) {
        await this.loadFiscalYears()
        return true
      }
      this.updateState('fiscal-years-error', result?.error || 'Failed to create fiscal year')
      return false
    } catch (err) {
      this.updateState('fiscal-years-error', err.message || 'Failed to create fiscal year')
      return false
    } finally {
      this.updateState('create-fiscal-year-loading', false)
    }
  }

  async deleteFiscalYear(year, force = false) {
    this.updateState('fiscal-years-error', null)
    try {
      const result = await window.ipcRenderer.invoke('fiscal-years:delete-year', year, force)
      if (result?.success) {
        await this.loadFiscalYears()
        return true
      }
      return false
    } catch (err) {
      this.updateState('fiscal-years-error', err.message || 'Failed to delete fiscal year')
      return false
    }
  }

  async getFiscalYearReport(year) {
    this.updateState('report-loading', true)
    this.updateState('report-data', null)
    this.updateState('report-fy-year', year)
    try {
      const res = await window.ipcRenderer.invoke('fiscal-years:get-report', year)
      if (res?.success && res.report) {
        this.updateState('report-data', res.report)
      }
      return res
    } catch (e) {
      this.updateState('report-fy-year', null)
      throw e
    } finally {
      this.updateState('report-loading', false)
    }
  }

  closeReportDrawer() {
    this.updateState('report-fy-year', null)
    this.updateState('report-data', null)
  }

  async closeFiscalYear(year) {
    this.updateState('close-fiscal-year-loading', true)
    this.updateState('fiscal-years-error', null)
    try {
      const result = await window.ipcRenderer.invoke('fiscal-years:close-year', year)
      if (result?.success) {
        await this.loadFiscalYears()
        return true
      }
      this.updateState('fiscal-years-error', result?.error || 'Failed to close fiscal year')
      return false
    } catch (err) {
      this.updateState('fiscal-years-error', err.message || 'Failed to close fiscal year')
      return false
    } finally {
      this.updateState('close-fiscal-year-loading', false)
    }
  }

  async reopenFiscalYear(year) {
    this.updateState('reopen-fiscal-year-loading', true)
    this.updateState('fiscal-years-error', null)
    try {
      const result = await window.ipcRenderer.invoke('fiscal-years:reopen-year', year)
      if (result?.success) {
        await this.loadFiscalYears()
        return true
      }
      this.updateState('fiscal-years-error', result?.error || 'Failed to reopen fiscal year')
      return false
    } catch (err) {
      this.updateState('fiscal-years-error', err.message || 'Failed to reopen fiscal year')
      return false
    } finally {
      this.updateState('reopen-fiscal-year-loading', false)
    }
  }

  updateField(key, value) {
    const form = this.getState('form') || {}
    this.updateState('form', { ...form, [key]: value })
  }

  async saveSettings() {
    if (this.getState('loading')) return
    
    const form = this.getState('form') || {}
    this.updateState('loading', true)
    this.updateState('error', null)
    this.updateState('success', null)
    try {
      const payload = {
        withhold_percentage: form.withhold_percentage === '' ? null : Number(form.withhold_percentage),
        company_name: form.company_name || null,
        company_address: form.company_address || null,
        company_phone: form.company_phone || null,
        company_email: form.company_email || null,
        company_tin: form.company_tin || null,
        company_logo_url: form.company_logo_url || null
      }
      const result = await window.ipcRenderer.invoke('settings:update', payload)
      if (result && result.success) {
        this.updateState('success', 'Settings saved successfully.')
        this.updateState('form', {
          withhold_percentage: result.settings.withhold_percentage ?? '',
          company_name: result.settings.company_name ?? '',
          company_address: result.settings.company_address ?? '',
          company_phone: result.settings.company_phone ?? '',
          company_email: result.settings.company_email ?? '',
          company_tin: result.settings.company_tin ?? '',
          company_logo_url: result.settings.company_logo_url ?? ''
        })
      } else {
        this.updateState('error', result?.error || 'Failed to save settings')
      }
    } catch (err) {
      this.updateState('error', err.message || 'Failed to save settings')
    } finally {
      this.updateState('loading', false)
    }
  }
}
