import { Button } from "../../utils/Button";
import { Input } from "../../utils/Input";
import { IonIcon } from "../../utils/Icon";

const { Row } = Liteframe;

export default function RolesTab(props) {
  const user = props.viewModel.getState('selected-user');
  props.ensureLocalStateKey('is-modifying', false);
  // props.ensureLocalStateKey('user-roles', props.viewModel.getState('selected-user-roles'));

  props.ensureLocalStateKey('role-search', '');

  const roleSearch = props.getLocalState('role-search')
  
  const isModifying = props.getLocalState('is-modifying'); // boolean
  const allRoles = props.viewModel.getState('selected-user-roles').filter(rt => {
    return rt.role.name.toLowerCase().includes(roleSearch);
  }); 


  const handleModify = () => {
    props.setLocalState('is-modifying', true);
  };
  const handleDone = () => {
    props.setLocalState('is-modifying', false);
  };
  const handleRoleClick = async (role, idx) => {
    // const updatedRole = {
    //   ...role,
    //   isAssigned: !role.isAssigned
    // };

    // allRoles[idx] = updatedRole;

    const roleData = {
      roleId: role.role.id,
      roleName: role.role.name,
    }


    if (role.isAssigned) {
      await props.viewModel.removeRole(user.id, roleData);
    } else {
      await props.viewModel.assignRole(user.id, roleData);
    }

    // props.setLocalState('user-roles', allRoles)
  }
  const handleSearch = (e) => {
    const query = e.target.value.trim().toLowerCase();
    props.setLocalState('role-search', query);
  }
  const assignedRoles = allRoles.filter(rn => rn.isAssigned).map(rn => rn.role);

  return Row({ class: 'h-full flex flex-col min-h-0 overflow-hidden' }, [
    Row({class: 'text-gray-900 font-medium px-4 mt-8 mb-4'}, user.display_name),
    Row({class: 'flex justify-between items-center px-4 '}, [
      Row({class: 'text-gray-600 font-small'}, `Roles Assigned (${assignedRoles.length})`),
      !isModifying && Button({ variant: 'secondary', class: 'mr-8 px-12', onClick: handleModify, }, 'Modify'),
      isModifying && Button({ variant: 'secondary', class: 'mr-8 px-12', onClick: handleDone, }, 'Done')
    ]),
    Row({class: 'bg-gray-100 px-4 py-2 mt-6 border-b border-indigo-900'},[
      Input({ class: 'w-full bg-gray-50', placeholder: 'Search', value: roleSearch, onInput: handleSearch })
    ]),
    !isModifying && Row({class: 'bg-gray-100 flex-1 min-h-0 overflow-y-auto'}, [
      ...assignedRoles.map(role => {
        return Row({class: 'flex items-center gap-4 border-b border-gray-200 px-4 py-2' }, [  //            ${roleColor}                              
          Row({ class: `w-8 h-8 flex items-center px-1 py-1 justify-center rounded-full  text-white text-xl select-none`, style: {backgroundColor: role.color}}, role.name.charAt(0).toUpperCase()),
          Row({ class: 'text-gray-600 font-medium'}, `${role.name}`),
        ])
    }),
    ]),
    isModifying && Row({ class: 'bg-gray-100 flex-1 min-h-0 overflow-y-auto' }, [
      ...allRoles.map((role, idx) => {
        return Row({ class: 'flex items-center gap-4 border-b border-gray-200 px-4 py-2'}, [
          Row({class: 'inline-block', events: {'click': () => handleRoleClick(role, idx)}}, [
            IonIcon({ 
              name: `${role.isAssigned ? 'checkbox' : 'square-outline'}`, 
              class: `${role.isAssigned ? 'text-indigo-500' : 'text-gray=600'} text-3xl select-none` 
            }),
          ]),
          
          Row({ class: 'flex items-center gap-2' }, [
            Row({ class: `w-8 h-8 flex items-center p-1 justify-center rounded-full text-white text-xl select-none`, style: {backgroundColor: role.role.color} }, role.role?.name.charAt(0).toUpperCase()),
            Row({ class: 'text-gray-600 font-medium' }, `${role.role?.name}`),
          ])
      ])
    })
    ])
  ]);
}

function UserRoles() {
  return [
    {
    name: 'Admin',
    description: 'Full access',
    isAssigned: true,
    color: 'green',
    },
    {
      name: 'Sales Person',
      description: 'Sales access',
      isAssigned: false,
      color: 'blue',
    },
    {
      name: 'Inventory Manager',
      description: 'Inventory access',
      isAssigned: false,
      color: 'red',
    }
  ]
}