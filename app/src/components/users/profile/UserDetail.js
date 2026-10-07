import { formatUTCDate } from "../../shared/TimeConverters";
import { Button, Spinner } from "../../utils/Button";
import { CardBody, CardHeader } from "../../utils/Card";
import UserGeneralTab from "./tabs/General";
import { Tabs } from "../../utils/Tabs";
import { UserSecurity } from "./tabs/Security";
import { TestPermissions, UserAccess } from "./tabs/Access.js";
import { IonIcon } from "../../utils/Icon";
import Badge from "../../utils/Badge";
import { getInitials } from "../../utils/Avatar";

const { Row } = Liteframe;

export function UserDetails(props) {

  const user = props.viewModel.getState('user');

  const loading = props.viewModel.getState('loading');

  const roles = props.viewModel.getState('user-roles').filter(rt => rt.isAssigned).map(rt => rt.role);

  return Row({ class: 'w-full h-full flex flex-col overflow-hidden' }, [

    CardHeader({ class: 'px-6 flex items-center h-12 flex-shrink-0 border-b border-gray-200 bg-white' }, [
      Row({ class: 'text-lg font-semibold text-gray-900' }, "User Profile"),
    ]),

    CardBody({ class: 'flex-1 flex flex-col gap-6 px-6 py-6 overflow-y-auto min-h-0 bg-gray-50' }, [

      /* PROFILE HEADER CARD */
      Row({
        class: `flex gap-8 p-8 rounded-xl border border-gray-300 bg-white shadow-sm`
      }, [
        UserAvatar(props),

        /* Identity + Meta */
        Row({ class: 'flex-1 flex flex-col justify-between gap-6' }, [

          /* Name + Action */
          Row({ class: 'flex items-start justify-between' }, [
            Row({ class: 'flex flex-col gap-2' }, [
              Row({ class: 'text-2xl font-semibold text-gray-900' }, user.display_name),
              Row({ class: 'text-sm font-medium text-indigo-600' }, `@${user.username}`),
            ]),

            // Button(
            //   { variant: 'outline', class: 'px-4' },
            //   'Edit Personal Details'
            // )
          ]),

          /* Roles */
          Row({ class: 'flex items-center gap-4' }, [
            Row({ class: 'text-sm font-medium text-gray-700' }, 'Roles:'),
            Row({ class: 'flex flex-wrap gap-2' }, [
              ...roles.map(role => Row({ tagType: 'span', class: 'px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg flex items-center justify-center gap-2 border border-indigo-200' }, [
                IonIcon({ name: 'shield-checkmark', style: { color: role.color } }), `${role.name}`
              ]))
            ])
          ]),

          /* Status + Last Login */
          Row({
            class: 'flex items-center justify-between pt-6 mt-2 border-t border-gray-200'
          }, [
            Row({ class: 'flex items-center gap-3' }, [
              Row({ class: 'text-sm font-medium text-gray-700' }, 'Status:'),
              Badge({ label: `${user.is_active ? 'Active' : 'Not Active'}`, tone: `${user.is_active ? 'success' : 'danger'}` }),
            ]),

            Row({ class: 'flex items-center gap-3' }, [
              Row({ class: 'text-sm font-medium text-gray-700' }, 'Last Login:'),
              Row({ class: 'text-sm text-gray-600' }, formatUTCDate(user.last_login_at))
            ])
          ])
        ])
      ]),

      Row({ class: 'flex flex-col gap-6' }, [
        Row({
          class: `bg-white border border-gray-300 rounded-xl shadow-sm`
        }, [
          /* Tabs bar */
          Row({
            class: `border-b border-gray-200 bg-gray-50`
          }, UserProfileTabs(props)),

          /* Tab content */
          Row({ class: 'p-8' }, UserProfileTabContent(props))
        ])

      ])
    ])
  ])
}

export function UserAvatar(props) {

  const finalSrc = '/img/erin-lindford.jpg';

  const user = props.viewModel.getState('user');

  const avatarPreview = props.viewModel.getState('avatar-preview');


  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Generate preview immediately (UX-first)
    const reader = new FileReader();
    reader.onload = () => {
      props.viewModel.updateState('avatar-preview', reader.result);
      // props.viewModel.updateState('loading', true);
    };
    reader.readAsDataURL(file);

    try {
      // Pass file directly to VM (do NOT store in state)
      await props.viewModel.updateAvatar(file);
    } catch (error) {
      console.error('Avatar upload failed:', error);
    }
  };

  const fileInput = Row({ tagType: 'input', attributes: { type: 'file', accept: 'image/*', class: 'sr-only' }, events: { 'change': handleFileChange } });


  const handleClick = () => {
    fileInput.click();
  };

  const loading = props.viewModel.getState('loading');

  const UserInitials = () => {
    if(avatarPreview) return false;

    return Row({ class: 'w-full h-80 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center border-4 border-gray-200 shadow-md'}, [
      Row({
        class: `w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm text-white text-6xl font-bold flex items-center justify-center select-none border-4 border-white/30`,
      }, getInitials(user.display_name))
    ]);
  } 






  return Row({ class: 'flex flex-col items-center gap-5 w-80' }, [
    UserInitials(),
   avatarPreview && Row({ class: 'w-full h-80 overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center border-4 border-gray-200 shadow-md' }, [
      Row({
        tagType: 'img',
        class: 'w-full h-full object-cover',
        attributes: {
          src: avatarPreview,
          alt: user.display_name,
          loading: 'lazy',
          decoding: 'async',
          onerror: "this.onerror=null;this.src='/erin-lindford.jpg';"
        }
      })
    ]),
    Row({ class: 'w-full flex items-center justify-between gap-3' }, [
      Button({ variant: 'secondary', class: 'flex-1', disabled: loading, onClick: () => props.viewModel.removeAvatar() }, loading ? [Spinner(), 'Remove'] : 'Remove'),
      Button({ variant: 'primary', class: 'flex-1', disabled: loading, onClick: handleClick }, loading ? [Spinner(), 'Upload'] : 'Upload')
    ]
    ),
    fileInput,
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
    onChange: handleTabChange,
    class: 'px-6'
  });
}
