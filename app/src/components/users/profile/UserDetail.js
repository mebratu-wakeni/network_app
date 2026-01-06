import { formatUTCDate } from "../../shared/TimeConverters";
import { Button } from "../../utils/Button";
import { CardBody, CardHeader } from "../../utils/Card";
import UserGeneralTab from "./tabs/General";
import { Tabs } from "../../utils/Tabs";
import { UserSecurity } from "./tabs/Security";
import { TestPermissions, UserAccess } from "./tabs/access";
import { IonIcon } from "../../utils/Icon";

const { Row } = Liteframe;

export function UserDetails(props) {

  const roles = TestPermissions().roles;

  return Row({ class: 'w-full h-full flex flex-col' }, [

    CardHeader({ class: 'px-6 flex items-center h-12' }, [
      Row({ class: 'text-md font-semibold' }, "User Profile"),
    ]),

    CardBody({ class: 'flex-1 flex flex-col gap-10 px-6 overflow-y-auto' }, [

      /* PROFILE HEADER CARD */
      Row({
        class: `
          flex gap-6
          p-6
          rounded-lg
          border border-gray-200
          bg-gray-50
        `
      }, [
        UserAvatar(props),

        /* Identity + Meta */
        Row({ class: 'flex-1 flex flex-col justify-between' }, [

          /* Name + Action */
          Row({ class: 'flex items-start justify-between' }, [
            Row({ class: 'flex flex-col gap-1' }, [
              Row({ class: 'text-lg font-semibold text-gray-900' }, 'Mebratu Fenta Wakeni'),
              Row({ class: 'text-sm text-indigo-600' }, '@mebratu'),
            ]),

            // Button(
            //   { variant: 'outline', class: 'px-4' },
            //   'Edit Personal Details'
            // )
          ]),

          /* Roles */
          Row({ class: 'flex items-center gap-4 mt-4' }, [
            Row({ class: 'text-sm text-gray-600' }, 'Roles:'),
            Row({ class: 'flex gap-3' }, [
              ...roles.map(role => Row({ tagType: 'span', class: 'px-2 py-0.5 bg-gray-200 text-indigo-800 text-sm rounded-md flex items-center justify-center gap-2' }, [
                IonIcon({ name: 'shield-checkmark', style: { color: role.color } }), `${role.name}`
              ]))
            ])
          ]),

          /* Status + Last Login */
          Row({
            class: 'flex items-center justify-between pt-4 mt-6 border-t border-gray-200'
          }, [
            Row({ class: 'flex items-center gap-3' }, [
              Row({ class: 'text-sm text-gray-600' }, 'Status:'),
              Row({
                tagType: 'span',
                class: 'px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-md'
              }, 'Active'),
            ]),

            Row({ class: 'flex items-center gap-3' }, [
              Row({ class: 'text-sm text-gray-600' }, 'Last Login:'),
              Row({ class: 'text-sm text-gray-500' }, formatUTCDate(new Date()))
            ])
          ])
        ])
      ]),

      Row({ class: 'flex flex-col gap-6' }, [
        Row({
          class: `
    bg-white
    border border-gray-200
    rounded-lg
    overflow-hidden
  `
        }, [
          /* Tabs bar */
          Row({
            class: `
      px-6
      pt-4
      border-b border-gray-200
      bg-gray-50
    `
          }, UserProfileTabs(props)),

          /* Tab content */
          Row({ class: 'p-6' }, UserProfileTabContent(props))
        ])

      ])
    ])
  ])
}

export function UserAvatar(props) {
  const finalSrc = '/img/erin-lindford.jpg';

  return Row({ class: 'flex flex-col items-center gap-4 w-70' }, [
    Row({ class: 'w-full h-70 overflow-hidden rounded-md bg-gray-100 flex items-center justify-center' }, [
      Row({
        tagType: 'img',
        class: 'w-full h-full object-cover',
        attributes: {
          src: finalSrc,
          alt: 'User Avatar',
          loading: 'lazy',
          decoding: 'async',
          onerror: "this.onerror=null;this.src='/erin-lindford.jpg';"
        }
      })
    ]),
    Row({ class: 'w-full flex items-center justify-between gap-6' }, [
      Button({ variant: 'secondary', class: 'w-32' }, 'Remove'),
      Button({ variant: 'primary', class: 'w-32' }, 'Upload')
    ]
    )
  ])
}

export function UserProfileTabContent(props) {
  const { viewModel } = props;
  const activeTab = viewModel.getState('profileTab') || 'general';

  switch (activeTab) {
    case 'general':
      return UserGeneralTab(props);

    case 'security':
      return UserSecurity(props);

    case 'access':
      return UserAccess(props);

    case 'activity':
      return Row({}, 'Audit log summary');

    default:
      return false;
  }
}

export function UserProfileTabs(props) {
  const { viewModel } = props;

  const activeTab = viewModel.getState('profileTab') || 'general';


  const handleTabChange = (key) => {
    viewModel.updateState('profileTab', key);
  };

  return Tabs({
    tabs: [
      { key: 'general', label: 'General' },
      { key: 'security', label: 'Security' },
      { key: 'access', label: 'Access & Permissions' },
      // { key: 'activity', label: 'Activity' }
    ],
    activeKey: activeTab,
    onChange: handleTabChange
  });
}
