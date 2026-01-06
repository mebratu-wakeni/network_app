import { formatUTCDate } from "../../../shared/TimeConverters";
import { Button } from "../../../utils/Button";
import { FieldRow } from "./General";
import { Input } from "../../../utils/Input";
import { FormActions } from "./General";

const { Row } = Liteframe;

export function UserSecurity(props) {
  props.ensureLocalStateKey('show-password-form', false);
  const showPasswordForm = props.getLocalState('show-password-form');

  const handleFormShow = () => {
    props.setLocalState('show-password-form', true);
  }
  const handleFormClose = () => {
    props.setLocalState('show-password-form', false);
  }
  return Row({ class: 'flex gap-8'}, [
    Row({class: 'flex-1 flex flex-col bg-gray-50 border border-gray-200 rounded-lg p-6 gap-6'}, [
      Row({ class: 'text-sm font-medium text-gray-800 -mb-4' }, 'Authentication'),
      Row({ class: 'border-t border-gray-200' }),
      Row({ class: 'text-md font-semibold text-gray-900' }, 'Mebratu Fenta Wakeni'),
      Row({ class: 'flex items-center gap-6'}, [
        Row({ class: 'text-md text-gray-600'}, 'Password Last Changed:'),
        Row({ class: 'text-md text-gray-500'}, formatUTCDate(new Date()))
      ]),
      !showPasswordForm && Button({ variant: 'outline', class: 'w-50', onClick: handleFormShow}, 'Change Password'),
      showPasswordForm && Row({
          class: `flex flex-col gap-6
        
        ` }, [
          Row({ class: 'text-sm font-medium text-gray-800 -mb-4' }, 'Change Password'),
          Row({ class: 'border-t border-gray-200' }),
          FieldRow(
            'Old Password:',
            Input({ type: 'password', name: 'old-password', onInput: e => {} })
          ),

          FieldRow(
            'New Password:',
            Input({ type: 'password', name: 'new-password', onInput: e => update('phone', e.target.value) })
          ),
        FieldRow(
          'Repeat Password:',
          Input({ type: 'password', name: 'new-password', onInput: e => update('phone', e.target.value) })
        ),
          FormActions([
            Button({ variant: 'secondary', class: 'w-36 mr-6 text-nowrap', onClick: handleFormClose }, 'Cancel'),
            Button({ variant: 'primary', class: 'w-36 text-nowrap', onClick: () => { } }, 'Save Changes'),
          ])
        ])


      
    ]),
    Row({ class: 'flex-1 flex flex-col gap-6 bg-gray-50 border border-gray-200 rounded-lg p-6'}, [
      Row({ class: 'text-sm font-medium text-gray-800 -mb-4' }, 'Sessions'),
      Row({ class: 'border-t border-gray-200' }),
      Row({ class: 'flex items-center gap-6'}, [
        Row({ class: 'text-md text-gray-600'}, 'Logged in at:'),
        Row({ class: 'text-md text-gray-500' }, formatUTCDate(new Date()))
      ])
    ])
  ])

} 