const { Row, StatefulRow } = Liteframe
import { CardBody, CardHeader } from '../utils/Card.js'
import { Button } from '../utils/Button.js'
import { Input } from '../utils/Input.js'
import { SettingsVM } from './SettingsVM.js'
import { navigationVM } from '../navigation/NavigationVM.js'

export function SettingsUI() {
  const viewModel = new SettingsVM()

  const render = (props) => {
    const auth = navigationVM.getState('auth') || {}
    const userRules = (auth.user && auth.user.rules) ? auth.user.rules : []
    const canEdit = Array.isArray(userRules) && userRules.includes('CanEditSettings')

    if (!canEdit) {
      return Row({ class: 'w-full h-full flex items-center justify-center p-8' }, [
        Row({ class: 'text-center max-w-md' }, [
          Row({ tagType: 'ion-icon', attributes: { name: 'lock-closed-outline' }, class: 'text-6xl text-gray-400 mx-auto mb-4' }),
          Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-700 mb-2' }, 'Access denied'),
          Row({ tagType: 'p', class: 'text-gray-500' }, 'Only administrators can view and edit system settings.')
        ])
      ])
    }

    const form = props.viewModel.getState('form') || {}
    const loading = props.viewModel.getState('loading')
    const error = props.viewModel.getState('error')
    const success = props.viewModel.getState('success')

    const handleChange = (key) => (e) => {
      props.viewModel.updateField(key, e.target.value)
    }

    const handleSubmit = async () => {
      await props.viewModel.saveSettings()
    }

    return Row({ class: 'w-full h-full overflow-auto p-6' }, [
      Row({ tagType: 'div', class: 'max-w-2xl mx-auto' }, [
        CardHeader({ class: 'mb-4' }, [
          Row({ tagType: 'h1', class: 'text-xl font-semibold text-gray-800' }, 'System Settings')
        ]),
        CardBody({ class: 'p-6 bg-white rounded-lg border border-gray-200 shadow-sm' }, [
          Row({ tagType: 'form', class: 'space-y-6', events: { submit: handleSubmit } }, [
            error ? Row({ class: 'p-3 rounded-md bg-red-50 text-red-700 text-sm' }, error) : null,
            success ? Row({ class: 'p-3 rounded-md bg-green-50 text-green-700 text-sm' }, success) : null,

            Row({ class: 'space-y-2' }, [
              Row({ tagType: 'h2', class: 'text-sm font-medium text-gray-700 border-b border-gray-100 pb-2' }, 'Withhold'),
              Row({}, [
                Row({ tagType: 'label', attributes: { for: 'withhold_percentage' }, class: 'block text-sm text-gray-600 mb-1' }, 'Withhold percentage (%)'),
                Input({
                  id: 'withhold_percentage',
                  type: 'number',
                  min: 0,
                  max: 100,
                  step: 0.01,
                  value: form.withhold_percentage,
                  onChange: handleChange('withhold_percentage'),
                  class: 'w-full max-w-xs',
                  placeholder: 'e.g. 2'
                })
              ])
            ]),

            Row({ class: 'space-y-2' }, [
              Row({ tagType: 'h2', class: 'text-sm font-medium text-gray-700 border-b border-gray-100 pb-2' }, 'Company information'),
              Row({}, [
                Row({ tagType: 'label', attributes: { for: 'company_name' }, class: 'block text-sm text-gray-600 mb-1' }, 'Company name'),
                Input({
                  id: 'company_name',
                  value: form.company_name,
                  onChange: handleChange('company_name'),
                  class: 'w-full',
                  placeholder: 'Company name'
                })
              ]),
              Row({}, [
                Row({ tagType: 'label', attributes: { for: 'company_address' }, class: 'block text-sm text-gray-600 mb-1' }, 'Address'),
                Input({
                  id: 'company_address',
                  value: form.company_address,
                  onChange: handleChange('company_address'),
                  class: 'w-full',
                  placeholder: 'Address'
                })
              ]),
              Row({ class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' }, [
                Row({}, [
                  Row({ tagType: 'label', attributes: { for: 'company_phone' }, class: 'block text-sm text-gray-600 mb-1' }, 'Phone'),
                  Input({
                    id: 'company_phone',
                    value: form.company_phone,
                    onChange: handleChange('company_phone'),
                    class: 'w-full',
                    placeholder: 'Phone'
                  })
                ]),
                Row({}, [
                  Row({ tagType: 'label', attributes: { for: 'company_email' }, class: 'block text-sm text-gray-600 mb-1' }, 'Email'),
                  Input({
                    id: 'company_email',
                    type: 'email',
                    value: form.company_email,
                    onChange: handleChange('company_email'),
                    class: 'w-full',
                    placeholder: 'Email'
                  })
                ])
              ]),
              Row({}, [
                Row({ tagType: 'label', attributes: { for: 'company_tin' }, class: 'block text-sm text-gray-600 mb-1' }, 'TIN (optional)'),
                Input({
                  id: 'company_tin',
                  value: form.company_tin,
                  onChange: handleChange('company_tin'),
                  class: 'w-full max-w-xs',
                  placeholder: 'Tax ID'
                })
              ])
            ]),

            Row({ class: 'pt-4' }, [
              Button({
                onClick: handleSubmit,
                variant: 'primary',
                disabled: !!loading,
                class: 'px-6'
              }, loading ? 'Saving...' : 'Save settings')
            ])
          ])
        ])
      ])
    ])
  }

  return StatefulRow({
    id: 'SettingsUI',
    viewModel,
    stateKeys: ['loading']
  }, (props) => {
    const auth = navigationVM.getState('auth') || {}
    const userRules = (auth.user && auth.user.rules) ? auth.user.rules : []
    const canEdit = Array.isArray(userRules) && userRules.includes('CanEditSettings')
    if (canEdit && props.viewModel.getState('form') === undefined && !props.viewModel.getState('loading')) {
      props.viewModel.loadSettings()
    }
    return render(props)
  })
}
