import { formatUTCDate } from "../../shared/TimeConverters";
import { Button, Spinner } from "../../utils/Button";
import { CardBody, CardHeader } from "../../utils/Card";
import UserGeneralTab from "./tabs/General";
import { Tabs } from "../../utils/Tabs";
import { UserSecurity } from "./tabs/Security";
import { TestPermissions, UserAccess } from "./tabs/access";
import { IonIcon } from "../../utils/Icon";
import Badge from "../../utils/Badge";
import { getInitials } from "../../utils/Avatar";

const { Row } = Liteframe;

export function UserDetails(props) {

  const user = props.viewModel.getState('user');

  const loading = props.viewModel.getState('loading');

  const roles = props.viewModel.getState('user-roles').filter(rt => rt.isAssigned).map(rt => rt.role);

  return Row({ class: 'w-full h-full flex flex-col' }, [

    CardHeader({ class: 'px-6 flex items-center h-12' }, [
      Row({ class: 'text-md font-semibold' }, "User Profile"),
    ]),

    CardBody({ class: 'flex-1 flex flex-col gap-6 px-6 overflow-y-auto' }, [

      /* PROFILE HEADER CARD */
      Row({
        class: `flex gap-10 p-6 rounded-lg border border-gray-200 bg-gray-50`
      }, [
        UserAvatar(props),

        /* Identity + Meta */
        Row({ class: 'flex-1 flex flex-col justify-between' }, [

          /* Name + Action */
          Row({ class: 'flex items-start justify-between' }, [
            Row({ class: 'flex flex-col gap-1' }, [
              Row({ class: 'text-lg font-semibold text-gray-900' }, user.display_name),
              Row({ class: 'text-sm text-indigo-600' }, `@${user.username}`),
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
              Badge({ label: `${user.is_active ? 'Active' : 'Not Active'}`, tone: `${user.is_active ? 'success' : 'danger'}` }),
            ]),

            Row({ class: 'flex items-center gap-3' }, [
              Row({ class: 'text-sm text-gray-600' }, 'Last Login:'),
              Row({ class: 'text-sm text-gray-500' }, formatUTCDate(user.last_login_at))
            ])
          ])
        ])
      ]),

      Row({ class: 'flex flex-col gap-6' }, [
        Row({
          class: ` h-180
    bg-white
    border border-gray-200
    rounded-lg
    overflow-hidden
  `
        }, [
          /* Tabs bar */
          Row({
            class: ``
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

  console.log('[avatar] loading: ', loading);

  const UserInitials = () => {
    if(avatarPreview) return false;

    return Row({ class: 'w-full h-70 overflow-hidden rounded-md bg-gray-100 flex items-center justify-center'}, [
      Row({
        class: `w-30 h-30 rounded-full bg-blue-600 text-white text-5xl font-semibold flex items-center justify-center select-none`,
      }, getInitials(user.display_name))
    ]);
  } 






  return Row({ class: 'flex flex-col items-center gap-4 w-70' }, [
    UserInitials(),
   avatarPreview && Row({ class: 'w-full h-70 overflow-hidden rounded-md bg-gray-100 flex items-center justify-center' }, [
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
    Row({ class: 'w-full flex items-center justify-between gap-6' }, [
      Button({ variant: 'secondary', class: 'w-32', disabled: loading, onClick: () => props.viewModel.removeAvatar() }, loading ? [Spinner(), 'Remove'] : 'Remove'),
      Button({ variant: 'primary', class: 'w-32', disabled: loading, onClick: handleClick }, loading ? [Spinner(), 'Upload'] : 'Upload')
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
