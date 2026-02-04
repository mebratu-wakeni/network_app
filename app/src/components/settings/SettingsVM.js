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
    this.setState('form', {
      withhold_percentage: '',
      company_name: '',
      company_address: '',
      company_phone: '',
      company_email: '',
      company_tin: ''
    })
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
          company_tin: result.settings.company_tin ?? ''
        })
      }
    } catch (err) {
      this.updateState('error', err.message || 'Failed to load settings')
    } finally {
      this.updateState('loading', false)
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
        company_tin: form.company_tin || null
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
          company_tin: result.settings.company_tin ?? ''
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
