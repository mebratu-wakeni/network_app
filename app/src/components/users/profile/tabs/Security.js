import { formatUTCDate } from "../../../shared/TimeConverters";
import { Button, Spinner } from "../../../utils/Button";
import { FieldRow } from "./General";
import { ErrorMessage, Input } from "../../../utils/Input";
import { FormActions } from "./General";

const { Row } = Liteframe;

export function UserSecurity(props) {
  props.ensureLocalStateKey('show-password-form', false);
  const loading = props.viewModel.getState('loading');
  const error = props.viewModel.getState('error')
  
  const showPasswordForm = props.getLocalState('show-password-form');

  const user = props.viewModel.getState('user');

  const handleFormUpdate = (key, value) => {
    props.viewModel.updateSecurityForm(key, value);
  }

  const handleFormShow = () => {
    props.viewModel.updateState('security-form', {})
    props.setLocalState('show-password-form', true);
  }
  const handleFormClose = () => {
    props.viewModel.updateState('security-form', {})
    props.setLocalState('show-password-form', false);
  } 

  const handleSave = async () => {
    await props.viewModel.changePassword();
  }
  return Row({ class: 'flex gap-8'}, [
    Row({class: 'flex-1 flex flex-col bg-gray-50 border border-gray-200 rounded-lg p-6 gap-6'}, [
      Row({ class: 'text-sm font-medium text-gray-800 -mb-4' }, 'Authentication'),
      Row({ class: 'border-t border-gray-200' }),
      Row({ class: 'text-md font-semibold text-gray-900' }, 'Mebratu Fenta Wakeni'),
      Row({ class: 'flex items-center gap-6'}, [
        Row({ class: 'text-md text-gray-600'}, 'Password Last Changed:'),
        Row({ class: 'text-md text-gray-500'}, formatUTCDate(user.last_password_changed_at))
      ]),
      !showPasswordForm && Button({ variant: 'outline', class: 'w-50', onClick: handleFormShow}, 'Change Password'),
      showPasswordForm && Row({
          class: `flex flex-col gap-6
        
        ` }, [
          Row({ class: 'text-sm font-medium text-gray-800 -mb-4' }, 'Change Password'),
          Row({ class: 'border-t border-gray-200' }),
          FieldRow(
            'Current Password:',
            Input({ type: 'password', onInput: e => handleFormUpdate('currentPassword', e.target.value) })
          ),

          FieldRow(
            'New Password:',
            Input({ type: 'password', onInput: e => handleFormUpdate('newPassword', e.target.value) })
          ),
          FieldRow(
            'Repeat Password:',
            Input({ type: 'password', onInput: e => handleFormUpdate('confirmPassword', e.target.value) })
          ),
          error && FieldRow('',
            ErrorMessage({name: 'password-error', message: error.message})
          ),
          FormActions([
            Button({ variant: 'secondary', class: 'w-36 mr-6 text-nowrap', onClick: handleFormClose }, 'Cancel'),
            Button({ variant: 'primary', class: 'w-36 text-nowrap', disabled: loading, onClick: handleSave }, loading ? [Spinner(), 'Save'] : 'Save Changes'),
          ])
        ])


      
    ]),
    Row({ class: 'flex-1 flex flex-col gap-6 bg-gray-50 border border-gray-200 rounded-lg p-6'}, [
      Row({ class: 'text-sm font-medium text-gray-800 -mb-4' }, 'Sessions'),
      Row({ class: 'border-t border-gray-200' }),
      Row({ class: 'flex items-center gap-6'}, [
        Row({ class: 'text-md text-gray-600'}, 'Logged in at:'),
        Row({ class: 'text-md text-gray-500' }, formatUTCDate(user.last_login_at))
      ])
    ])
  ])

} 