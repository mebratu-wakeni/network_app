const { Row } = Liteframe;
import { IonIcon } from "../../../utils/Icon";

export function UserAccess(props) {
  const rules = TestPermissions().rules;
  const assignedRoles = TestPermissions().roles;

  return Row({ class: 'flex gap-8'}, [
    Row({ class: 'flex-2/9 flex flex-col bg-gray-50 border border-gray-200 rounded-lg p-6' }, [
      Row({ class: 'text-sm font-medium text-gray-800 mb-2' }, 'Assigned Roles'),
      Row({ class: 'border-t border-gray-200 mb-6' }),
      Row({ class: 'border-t border-gray-200' }),
      ...assignedRoles.map(role => {
        return Row({ class: 'flex items-center gap-4 border-b border-gray-200 py-2' }, [  //            ${roleColor}                              
          Row({ class: `w-8 h-8 flex items-center px-1 py-1 justify-center rounded-full  text-white text-xl select-none`, style: { backgroundColor: role.color } }, role.name.charAt(0).toUpperCase()),
          Row({ class: 'text-sm text-gray-500 font-medium' }, `${role.name}`),
        ])
      }),
    ]),
    Row({ class: 'flex-4/9 flex flex-col bg-gray-50 border border-gray-200 rounded-lg p-6' }, [
      Row({ class: 'text-sm font-medium text-gray-800 mb-2' }, 'All Permissions'),
      Row({ class: 'border-t border-gray-200 mb-6' }), 
      Row({ class: 'border-t border-gray-200' }),
      ...rules.map(rule => Row({ class: 'flex flex-col border-b border-gray-200 px-4 py-2 gap-2' }, [
        Row({ class: 'flex items-center gap-2' }, [
          Row({ class: 'text-sm text-gray-700 font-medium' }, `${rule.key}:`),
          Row({ class: 'text-gray-500 text-sm' }, rule.description),
        ]),
        Row({ class: 'flex items-center gap-3' }, [
          rule.isDirect && Row({ tagType: 'span', class: 'px-2 py-0.5 bg-gray-200 text-gray-500 text-sm rounded-md flex items-center justify-center' }, 'Assigned directly'),
          ...rule.roles.map(role => {
            return Row({ tagType: 'span', class: 'px-2 py-0.5 bg-gray-200 text-indigo-800 text-sm rounded-md flex items-center justify-center gap-2' }, [
              IonIcon({ name: 'shield-checkmark', style: { color: role.color } }), `${role.name}`
            ])
          })
        ]),
      ]))
    ]),
    Row({ class: 'flex-1/3 flex flex-col bg-gray-50 border border-gray-200 rounded-lg p-6' }, [
      Row({ class: 'text-sm font-medium text-gray-800 mb-2' }, 'Directly Assigned Permissions'),
      Row({ class: 'border-t border-gray-200 mb-6' }),
      Row({ class: 'border-t border-gray-200' }),
      ...rules.map((rule) => {
        if (!rule.isDirect) return false

        return Row({ class: 'flex items-center gap-4 border-b border-gray-200 py-2' }, [
          Row({ class: 'inline-block' }, [
            IonIcon({
              name: 'checkbox',
              class: `text-indigo-600 text-3xl select-none`
            }),
          ]),
          Row({ class: 'flex flex-col' }, [
            Row({ class: 'text-gray-700 font-medium' }, rule.key),
            Row({ class: 'text-gray-500 text-sm' }, rule.description),
          ]),

        ])
      })
    ])
  ])
}

export function TestPermissions() {
  return {
    rules: [
      {
      key: 'CanSeeUsers',
      description: 'Can see user details and access levels',
      roles: [{
        name: 'Admin',
        color: 'blue',
        },
      ],
      isDirect: true,
    },
    {
      key: 'CanEditUsers',
      description: 'Can edit user details and access levels',
      roles: [{
        name: 'Admin',
        color: 'blue',
      }
      ],
      isDirect: false,
    },
  ],
  roles: [
    {
      name: 'Admin',
      color: 'blue',
      isAssigned: true,
    },
    {
      name: 'Manager',
      color: 'red',
      isAssigned: false
    }
  ]
  }
}