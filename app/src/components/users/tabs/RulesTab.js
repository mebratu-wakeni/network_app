import { Button } from "../../utils/Button";
import { IonIcon } from "../../utils/Icon";
import { Input } from "../../utils/Input";
const { Row } = Liteframe;

export default function RulesTab(props) {
  const user = props.viewModel.getState('selected-user');
  const rules = ['products.read', 'products.write', 'sales.read'];
  props.ensureLocalStateKey('show-directly-assigned', true);
  const isDirectlyAssigned = props.getLocalState('show-directly-assigned');
  
  const handleStateChange = () => {
    props.setLocalState('show-directly-assigned', !props.getLocalState('show-directly-assigned'));
  }
  return Row({}, [
    Row({ class: 'text-gray-900 font-medium px-4 mt-8 mb-4'}, user.display_name),
    Row({ class: 'flex justify-between items-center px-4 '}, [
      Row({ class: 'flex flex-col gap-2'}, [
        Row({ class: 'flex items-center gap-3', events: {'click': handleStateChange}}, [
          IonIcon({ name: `radio-button-${isDirectlyAssigned ? 'on' : 'off'}`, class: `text-xl ${!isDirectlyAssigned ? 'text-gray-600' : ''}` }), 
          Row({class: 'text-gray-800 text-md'}, `Assigned directly`)
        ]),
        Row({ class: 'flex items-center gap-3', events: { 'click': handleStateChange } }, [
          IonIcon({ name: `radio-button-${isDirectlyAssigned ? 'off' : 'on'}`, class: `text-xl ${isDirectlyAssigned ? 'text-gray-600' : ''}`  }),
          Row({ class: 'text-gray-800 text-md' }, `All assignments`)
        ]),
      ]),
      Button({variant: 'secondary', class: 'mr-8 px-12',  onClick: () => console.log('Modify is clicked')}, 'Modify')
    ]),
    Row({class: 'bg-gray-100 px-4 py-2 mt-6 border-b border-indigo-900'},[
      Input({ class: 'w-full bg-gray-50', placeholder: 'Search', onChange: () => console.log('Search is changed')})
    ]),
    Row({class: 'bg-gray-100'}, [
      ...rules.map(rule => Row({class: 'flex flex-col border-b border-gray-200 px-4 py-2' }, [
        Row({ class: 'text-gray-700 font-medium'}, rule),
        Row({ class: 'text-gray-500 text-sm'}, rule.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')),
      ]))
    ])
  ]);
}