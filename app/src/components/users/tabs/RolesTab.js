import { Button } from "../../utils/Button";
import { Input } from "../../utils/Input";

const { Row } = Liteframe;

export default function RolesTab(props) {
  const user = props.viewModel.getState('selected-user');
  const roles = ['admin', 'sales_person', 'inventory_manager'];
  return Row({}, [
    Row({class: 'text-gray-900 font-medium px-4 mt-8 mb-4'}, user.display_name),
    Row({class: 'flex justify-between items-center px-4 '}, [
      Row({class: 'text-gray-600 font-small'}, `Roles Assigned (2)`),
      Button({variant: 'secondary', class: 'mr-8 px-12',  onClick: () => console.log('Modify is clicked')}, 'Modify')
    ]),
    Row({class: 'bg-gray-100 px-4 py-2 mt-6 border-b border-indigo-900'},[
      Input({ class: 'w-full bg-gray-50', placeholder: 'Search', onChange: () => console.log('Search is changed')})
    ]),
    Row({class: 'bg-gray-100'}, [
      ...roles.map(role => Row({class: 'flex items-center gap-4 border-b border-gray-200 px-4 py-2' }, [
        Row({ class: 'w-8 h-8 flex items-center px-1 py-1 justify-center rounded-full bg-green-600 text-white text-xl select-none'}, 'A')
      ]))
    ])
  ]);
}