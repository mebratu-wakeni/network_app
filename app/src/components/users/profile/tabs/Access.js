const { Row } = Liteframe;
import { IonIcon } from "../../../utils/Icon";

export function UserAccess(props) {
  const rules = props.viewModel.getState('user-rules').filter(rt => rt.isDirect || rt.roles.length > 0);
  const assignedRoles = props.viewModel.getState('user-roles').filter(rt => rt.isAssigned).map(rt => rt.role);

  console.log('user rules: ', rules);
  console.log('user rules: ', assignedRoles)

  return Row({ class: 'flex flex-col gap-6' }, [
    /* Assigned Roles - Full Width on Top */
    Row({ class: 'w-full flex flex-col bg-white border border-gray-300 rounded-xl shadow-sm p-8' }, [
      Row({ class: 'text-base font-semibold text-gray-900 mb-2' }, 'Assigned Roles'),
      Row({ class: 'border-t border-gray-200 -mx-8 px-8 pt-4' }),
      Row({ class: 'flex flex-wrap gap-4' }, [
        ...assignedRoles.map(role => {
          return Row({ class: 'flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 bg-gray-50' }, [  //            ${roleColor}                              
            Row({ class: `w-10 h-10 flex items-center justify-center rounded-full text-white text-lg font-semibold select-none shadow-md`, 
              style: { backgroundColor: role.color } }, role.name.charAt(0).toUpperCase()),
            Row({ class: 'text-sm text-gray-900 font-medium' }, `${role.name}`),
          ])
        }),
      ]),
    ]),

    /* All Permissions and Directly Assigned Permissions - Equal Columns Below */
    Row({ class: 'flex gap-8' }, [
      /* All Permissions - Left Column */
      Row({ class: 'flex-1 flex flex-col bg-white border border-gray-300 rounded-xl shadow-sm p-8' }, [
        Row({ class: 'text-base font-semibold text-gray-900 mb-2' }, 'All Permissions'),
        Row({ class: 'border-t border-gray-200 -mx-8 px-8 pt-4' }),
        Row({ class: 'overflow-y-auto overflow-x-auto max-h-96' }, [
          Row({ class: 'min-w-full' }, [
            ...rules.map(rt => Row({ class: 'flex flex-col border-b border-gray-200 py-4 gap-3 min-w-max' }, [
              Row({ class: 'flex items-center gap-2' }, [
                Row({ class: 'text-sm text-gray-900 font-semibold' }, `${rt.rule.key}:`),
                Row({ class: 'text-gray-600 text-sm' }, rt.rule.description),
              ]),
              Row({ class: 'flex items-center gap-2 flex-wrap' }, [
                rt.isDirect && Row({ tagType: 'span', class: 'px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md flex items-center justify-center border border-gray-300' }, 'Assigned directly'),
                ...rt.roles.map(role => {
                  return Row({ tagType: 'span', class: 'px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md flex items-center justify-center gap-2 border border-indigo-200' }, [
                    IonIcon({ name: 'shield-checkmark', style: { color: role.color } }), `${role.name}`
                  ])
                })
              ]),
            ]))
          ])
        ])
      ]),

      /* Directly Assigned Permissions - Right Column */
      Row({ class: 'flex-1 flex flex-col bg-white border border-gray-300 rounded-xl shadow-sm p-8' }, [
        Row({ class: 'text-base font-semibold text-gray-900 mb-2' }, 'Directly Assigned Permissions'),
        Row({ class: 'border-t border-gray-200 -mx-8 px-8 pt-4' }),
        Row({ class: 'overflow-y-auto overflow-x-auto max-h-96' }, [
          Row({ class: 'min-w-full' }, [
            rules.filter(rt => rt.isDirect).length === 0  && Row({ class: 'text-sm text-gray-500 mt-4' }, 'No directly Assigned Rules'),
            ...rules.map(rt => {
              if (!rt.isDirect) return false

              return Row({ class: 'flex items-center gap-4 border-b border-gray-200 py-4 min-w-max' }, [
                
                Row({ class: 'inline-block' }, [
                  IonIcon({
                    name: 'checkbox',
                    class: `text-indigo-600 text-2xl select-none`
                  }),
                ]),
                Row({ class: 'flex flex-col gap-1' }, [
                  Row({ class: 'text-sm text-gray-900 font-semibold' }, rt.rule.key),
                  Row({ class: 'text-sm text-gray-600' }, rt.rule.description),
                ]),

              ])
            })
          ])
        ])
      ])
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