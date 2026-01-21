import { formatUTCDate } from "../../../shared/TimeConverters";
import { Button } from "../../../utils/Button";
import { Input } from "../../../utils/Input";

const { Row } = Liteframe;

export default function UserGeneralTab(props) {
  const { viewModel } = props;

  const user = viewModel.getState('user'); // assumed loaded entity
  const form = viewModel.getState('general-form') || {};


  const handleSave = async () => {
    viewModel.updateUserProfile();
  };

  return Row({ class: 'flex gap-8' }, [

    /* ==============================
       Identity (Read-only)
    ============================== */
    Row({
      class: `flex-1 flex flex-col
        bg-white
        border border-gray-300
        rounded-xl
        shadow-sm
        p-8
      ` }, [
      Row({ class: 'text-base font-semibold text-gray-900 mb-2' }, 'Identity'),
      Row({ class: 'border-t border-gray-200 -mx-8 px-8 pt-4'}),
      Row({ class: 'grid grid-cols-1 gap-y-5' }, [

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
      class: `flex-1 flex flex-col
        bg-white
        border border-gray-300
        rounded-xl
        shadow-sm
        p-8
        ` }, [
      Row({ class: 'text-base font-semibold text-gray-900 mb-2' }, 'Personal Details'),
      Row({ class: 'border-t border-gray-200 -mx-8 px-8 pt-4' }),
      Row({ class: 'flex flex-col gap-5 mt-4' }, [
        FieldRow(
          'Display Name:',
          Input({ placeholder: 'Name', value: form.display_name || user.display_name || '', onInput: (e) => viewModel.updateGeneralForm('display_name', e.target.value.trim()) })
        ),

        FieldRow(
          'Phone Number:',
          Input({ placeholder: '+251 ...', value: form.phone || user.phone || '', onInput: e => viewModel.updateGeneralForm('phone', e.target.value) })
        ),
        FieldRow(
          'Email:',
          Input({ placeholder: 'johndoe@example.com', value: form.email || user.email || '', onInput: e => viewModel.updateGeneralForm('email', e.target.value) })
        ),
      ]),
      FormActions(Button({ variant: 'primary', onClick: handleSave }, 'Save Changes'))
    ])
  ]);
}

/* ==============================
   Helpers
============================== */

function InfoRow(label, value) {
  return Row({ class: 'flex gap-6' }, [
    Row({ class: 'w-44 text-sm font-medium text-gray-600' }, label),
    Row({ class: 'text-sm text-gray-900' }, value)
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
    { class: 'grid grid-cols-[180px_1fr] gap-6 items-center' },
    [
      Row({ class: 'text-sm font-medium text-gray-700' }, label),

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
      class: 'grid grid-cols-[180px_1fr] gap-6 pt-4'
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

