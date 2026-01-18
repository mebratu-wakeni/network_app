import { Button } from "../../utils/Button";
import { IonIcon } from "../../utils/Icon";
import { Input } from "../../utils/Input";
const { Row } = Liteframe;

export default function RulesTab(props) {
  const user = props.viewModel.getState('selected-user');
  props.ensureLocalStateKey('show-directly-assigned', true);
  // const dbRules = props.viewModel.getState('selected-user-direct-rules');
  // console.log('DB rules :', dbRules);
  props.ensureLocalStateKey('is-rule-modifying', false);

  const isRuleModifying = props.getLocalState('is-rule-modifying');

  props.ensureLocalStateKey('rule-search', '');

  const rSearch = props.getLocalState('rule-search')


  const allRules = props.viewModel.getState('selected-user-direct-rules').filter(rt => {
    return rt.rule.key.toLowerCase().includes(rSearch);
  });
  const isDirectlyAssigned = props.getLocalState('show-directly-assigned');


  const assignedRules = allRules.filter(rt => rt.isDirect);
  const allAssignment = allRules.filter(rt => rt.isDirect || rt.roles.length > 0);

  const nDirectlyAssignedRules = assignedRules.length;
  const nAllRules = nDirectlyAssignedRules + allRules.filter(rule => rule.roles.length > 0).length;
  const handleStateChange = () => {
    if(isDirectlyAssigned) props.setLocalState('is-rule-modifying', false); 
    props.setLocalState('show-directly-assigned', !props.getLocalState('show-directly-assigned')); 
  }
  const handleModify= () => {
    props.setLocalState('is-rule-modifying', true);
  }
  const handleDone = () => {
    props.setLocalState('is-rule-modifying', false);
  }
  const handleRuleClick = async (rt, idx) => {

    const ruleData = {
      ruleKey: rt.rule.key,
      userId: user.id,
    };

    

    if(rt.isDirect) {
      await props.viewModel.removeRule(user.id, ruleData);
    } else {
      await props.viewModel.assignRule(user.id, ruleData);
    }

  }

  const handleSearch = (e) => {
    const query = e.target.value.trim().toLowerCase();
    props.setLocalState('rule-search', query)
  }
  return Row({ class: 'h-full flex flex-col min-h-0 overflow-hidden' }, [
    Row({ class: 'text-gray-900 font-medium px-4 mt-8 mb-4'}, user.display_name),
    Row({ class: 'flex justify-between items-center px-4 '}, [
      Row({ class: 'flex flex-col gap-2'}, [
        Row({ class: 'flex items-center gap-3', events: {'click': handleStateChange}}, [
          IonIcon({ name: `radio-button-${isDirectlyAssigned ? 'on' : 'off'}`, class: `text-xl ${!isDirectlyAssigned ? 'text-gray-600' : ''}` }), 
          Row({class: 'text-gray-800 text-md'}, `Assigned directly (${nDirectlyAssignedRules})`)
        ]),
        Row({ class: 'flex items-center gap-3', events: { 'click': handleStateChange } }, [
          IonIcon({ name: `radio-button-${isDirectlyAssigned ? 'off' : 'on'}`, class: `text-xl ${isDirectlyAssigned ? 'text-gray-600' : ''}`  }),
          Row({ class: 'text-gray-800 text-md' }, `All assignments (${nAllRules})`)
        ]),
      ]),
      !isRuleModifying && Button({ variant: 'secondary', class: 'w-40 mr-8 px-12 bg-gray-100 text-indigo-600 font-md font-semibold', onClick: handleModify, disabled: !isDirectlyAssigned }, 'Modify'),
      isRuleModifying && Button({ variant: 'secondary', class: 'w-40 mr-8 px-12 bg-gray-150 text-indigo-600 font-md font-semibold', onClick: handleDone }, 'Done')
    ]),
    Row({class: 'bg-gray-100 px-4 py-2 mt-6 border-b border-indigo-900'},[
      Input({ class: 'w-full bg-gray-50', placeholder: 'Search', value: rSearch, onInput: handleSearch })
    ]),
    // display all the assigned directly rules
    !isRuleModifying && isDirectlyAssigned && Row({class: 'bg-gray-100 flex-1 min-h-0 overflow-y-auto'}, [
      ...assignedRules.map(rt => Row({class: 'flex flex-col border-b border-gray-200 px-4 py-2' }, [
        Row({ class: 'text-gray-700 font-medium'}, rt.rule.key),
        Row({ class: 'text-gray-500 text-sm'}, rt.rule.description),
      ]))
    ]),
    // lets to assign rules 
    isRuleModifying && isDirectlyAssigned && Row({ class: 'bg-gray-100 flex-1 min-h-0 overflow-y-auto' }, [
      ...allRules.map((rt, idx) => Row({ class: 'flex items-center gap-4 border-b border-gray-200 px-4 py-2' }, [
        Row({ class: 'inline-block', events: { 'click': () => handleRuleClick(rt, idx) } }, [
          IonIcon({ 
            name: `${rt.isDirect ? 'checkbox' : 'square-outline'}`, 
            class: `${rt.isDirect? 'text-indigo-600' : 'text-gray-500'} text-3xl select-none` }),
        ]),
        Row({class: 'flex flex-col'}, [
          Row({ class: 'text-gray-700 font-medium' }, rt.rule.key),
          Row({ class: 'text-gray-500 text-sm' }, rt.rule.description),
        ]),
        
      ]))
    ]),
    !isRuleModifying && !isDirectlyAssigned && Row({ class: 'bg-gray-100 flex-1 min-h-0 overflow-y-auto' }, [
      ...allAssignment.map(rt => Row({ class: 'flex flex-col border-b border-gray-200 px-4 py-2 gap-2' }, [
        Row({class: 'flex items-center gap-2'}, [
          Row({ class: 'text-gray-700 font-medium' }, `${rt.rule.key}:`),
          Row({ class: 'text-gray-500 text-sm' }, rt.rule.description),
        ]),
        Row({class: 'flex items-center gap-3'}, [
          rt.isDirect && Row({tagType: 'span', class: 'px-2 py-0.5 bg-gray-200 text-gray-500 text-sm rounded-md flex items-center justify-center'}, 'Assigned directly'),
          ...rt.roles.map(role => {
            return Row({ tagType: 'span', class: 'px-2 py-0.5 bg-gray-200 text-indigo-800 text-sm rounded-md flex items-center justify-center gap-2'}, [
              IonIcon({name: 'shield-checkmark', style: {color: role.color}}), `${role.name}`
            ])
          })
        ]),
      ]))
    ])
  ]);
}

function UserRules() {
  const userRulesState = [
    {
      id: "rule_01",
      name: "CanViewInventory",
      description: "View stock levels across all warehouses.",
      isDirect: false,
      sources: [
        { id: "role_wm", name: "Warehouse Manager", color: "text-[#0bbed7]" }
      ]
    },
    {
      id: "rule_02",
      name: "CanAdjustStock",
      description: "Manually update stock counts for damaged goods or returns.",
      isDirect: false,
      sources: [
        { id: "role_wm", name: "Warehouse Manager", color: "text-[#f44336]" }
      ]
    },
    {
      id: "rule_03",
      name: "CanShipOrders",
      description: "Mark orders as dispatched and generate tracking.",
      isDirect: false,
      sources: [
        { id: "role_wm", name: "Warehouse Manager", color: "text-[#00a037]" }
      ]
    },
    {
      id: "rule_04",
      name: "CanApproveOrders",
      description: "Verify and approve high-value or controlled substance orders.",
      isDirect: true,
      sources: []
    },
    {
      id: "rule_05",
      name: "CanCreateOrders",
      description: "Create new purchase orders for pharmacies.",
      isDirect: false,
      sources: [] // Not assigned to this user
    },
    {
      id: "rule_06",
      name: "CanManageUsers",
      description: "Create, edit, or deactivate staff accounts.",
      isDirect: false,
      sources: [] // Not assigned to this user
    }
  ];

  return userRulesState;
}