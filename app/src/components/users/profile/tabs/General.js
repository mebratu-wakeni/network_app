import { formatUTCDate } from "../../../shared/TimeConverters";
import { Button } from "../../../utils/Button";
import { Input } from "../../../utils/Input";

const { Row } = Liteframe;

export default function UserGeneralTab(props) {
  const { viewModel } = props;

  const user = viewModel.getState('user'); // assumed loaded entity
  const form = viewModel.getState('generalForm') || {};

  const update = (key, value) => {
    viewModel.updateState('generalForm', {
      ...form,
      [key]: value
    });
  };

  const handleSave = () => {
    viewModel.dispatch('saveGeneralDetails');
  };

  return Row({ class: 'flex gap-8' }, [

    /* ==============================
       Identity (Read-only)
    ============================== */
    Row({
      class: `flex-1 flex flex-col
        bg-gray-50
        border border-gray-200
        rounded-lg
        p-6
        // gap-6
      ` }, [
      Row({ class: 'text-sm font-medium text-gray-800 -mb-4' }, 'Identity'),
      Row({ class: 'border-t border-gray-200'}),
      Row({ class: 'grid grid-cols-1 gap-x-12 gap-y-4 text-sm ' }, [

        InfoRow('Username', user.username),
        InfoRow('Full Name', user.full_name),
        InfoRow('Employee ID', user.employee_id || '—'),
        InfoRow('Account Status', user.status),
        InfoRow('Created On', formatUTCDate(user.created_at)),

      ])
    ]),

    /* ==============================
       Editable Personal Details
    ============================== */
    Row({
      class: `flex-1 flex flex-col gap-6 pt-6 border-t border-gray-200 flex flex-col gap-4
        bg-gray-50
        border border-gray-200
        rounded-lg
        p-6
        ` }, [
      Row({ class: 'text-sm font-medium text-gray-800 -mb-4' }, 'Personal Details'),
      Row({ class: 'border-t border-gray-200' }),
      FieldRow(
        'Display Name:',
        Input({ name: 'name', placeholder: 'Name', value: form.display_name || user.display_name || '', onInput: e => update('display_name', e.target.value) })
      ),

      FieldRow(
        'Phone Number:',
        Input({ name: 'phone', placeholder: '+252 ...', value: form.phone || user.phone || '', onInput: e => update('phone', e.target.value) })
      ),
      FieldRow(
        'Email:',
        Input({ name: 'email', placeholder: 'johndoe@example.com', value: form.email || user.email || '', onInput: e => update('phone', e.target.value) })
      ),
      FormActions(Button({ variant: 'primary', onClick: handleSave }, 'Save Changes'))
    ])
  ]);
}

/* ==============================
   Helpers
============================== */

function InfoRow(label, value) {
  return Row({ class: 'flex gap-4' }, [
    Row({ class: 'w-40 text-gray-500' }, label),
    Row({ class: 'text-gray-800' }, value)
  ]);
}

// function FieldRow(label, field) {
//   return Row({ class: 'grid grid-cols-[160px_1fr] items-center gap-6' }, [
//     Row({ class: 'text-sm text-gray-600' }, label),
//     field
//   ]);
// }
export function FieldRow(label, field) {
  return Row(
    { class: 'grid grid-cols-[160px_1fr] gap-6 items-center' },
    [
      Row({ class: 'text-sm text-gray-600' }, label),

      // width responsibility lives here
      Row(
        { class: 'max-w-md w-full' },
        field
      )
    ]
  );
}


function Option(label, value = label) {
  return Row({
    tagType: 'option',
    attributes: { value }
  }, label);
}

const inputClass = `
  w-full
  px-3 py-2
  text-sm
  rounded-md
  border border-gray-300
  focus:outline-none
  focus:ring-2 focus:ring-indigo-500
  bg-white
`;

export function FormActions(actions) {
  return Row(
    {
      class: 'grid grid-cols-[160px_1fr] gap-6 pt-6'
    },
    [
      Row(), // empty label column
      Row(
        { class: 'max-w-md w-full flex justify-end' },
        actions
      )
    ]
  );
}

