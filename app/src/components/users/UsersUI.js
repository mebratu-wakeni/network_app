import { Card, CardHeader, CardBody } from "../utils/Card";
import { Table, TableBody, TableDCell, TableFooter, TableHCell, TableHeader, TableRow } from "../utils/Table";
import Avatar from "../utils/Avatar";
import Badge from "../utils/Badge";
import UsersVM from "./UsersVM"
import { IconButton, IonIcon } from "../utils/Icon";
import { getApiAsset } from '../../../electron/config/apiConfig.js';
import { SelectOptions, SelectRelative } from "../utils/Select";
import { Input } from "../utils/Input";
import { Button } from "../utils/Button";
import Modal from "../shared/Modal";
import ModalContent from "./CreateUserModal";
import Drawer from "../shared/ExampleDrawer";
import { formatUTCDate } from "../shared/TimeConverters.js";
import GeneralTabContent from "./tabs/GeneralTab.js";    
import RolesTab from "./tabs/RolesTab.js";
import RulesTab from "./tabs/RulesTab.js";
import { getInitials } from "../utils/Avatar";

const { StatefulRow, Row } = Liteframe;


const UsersTable = () => {
  const viewModel = new UsersVM();

  if (!viewModel.__initialized) {
    viewModel.loadUsers();
    viewModel.__initialized = true;
  }

  

  const render = (props) => {
    props.ensureStateKey('loading');
    // props.ensureStateKey('user-list');
    // props.ensureStateKey('error');
    props.ensureStateKey('selected-user');
    // props.ensureStateKey('details-loading');

    props.ensureLocalStateKey('show-slide', false);
    const showSlide = props.getLocalState('show-slide');

    const userList = props.viewModel.getState('user-list');
    const loading = props.viewModel.getState('loading');
    const loadingMore = false;//props.viewModel.getState('loading-more');
    const error = props.viewModel.getState('error');
    const selectedUser = props.viewModel.getState('selected-user');
    const selectedUserId = 1; //props.viewModel.getState('selected-user-id');
    const detailsLoading = false;  // props.viewModel.getState('details-loading');
    const hasMore = false; //props.viewModel.getState('has-more');


    

    const handleRowClick = (user) => {
      props.viewModel.openUserDetails(user.id);

      setTimeout(() => {
        props.setLocalState('show-slide', true);
      }, 300)
      
    };

    props.ensureLocalStateKey('show-details', true);

    const showDetails = props.getLocalState('show-details');

    const isPanelOpen = Boolean(detailsLoading || selectedUser);

    return Card({class: 'flex-1 flex flex-col h-full'}, [
      CardHeader({ class: 'px-6 flex justify-between items-center flex-shrink-0 h-12'}, [
          Row({ class: 'text-md font-semibold' }, "User Management"),
          loading && Spinner(),
        ]),
        CardBody({class: 'flex-1 flex flex-col overflow-y-auto'}, [
          error && Row({ class: 'mb-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm flex-shrink-0' }, error),
          loading && userList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0' }, 'Loading users...'),
          !loading && userList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0' }, 'No users found'),
          Row({class: 'flex-shrink-0'}, [PageControl(props)]),
          userList.length > 0 && 
            table({
              userList,
              selectedUserId,
              onRowClick: handleRowClick
            }),
          selectedUser && Drawer({openSlide: showSlide, class: 'h-full'}, [
            loading && Row({class: 'absolute inset-0 flex items-center justify-center bg-gray-100/40 z-100'}, [
              Row({ class: 'animate-spin border-4 border-green-600 border-t-transparent rounded-full h-10 w-10' }, [])
            ]),
            showDetails && UserDetailsPanel(props),
            !showDetails && UserEditTabs(props, [
              GeneralTabContent(props),
              RolesTab(props),
              RulesTab(props),
              Row({ class: 'p-5 text-sm text-gray-500' }, 'Audit Log content goes here...'),
            ])
          ]),
        ])
      ]);
  }

  return StatefulRow({id: 'users-view', class: 'h-full', viewModel }, render);
}

function table({ userList, selectedUserId, onRowClick }) {

  return Table({ class: 'flex-1 min-h-0', id: 'users-table'}, [
    TableHeader({class: 'sticky top-0 z-10'}, [
      TableHCell({ class: 'w-16' }, [ ]),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Full Name"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Username"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Email"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Status"),
    ]),
    TableBody({}, [
      ...userList.map(user => {
        const isSelected = selectedUserId === user.id;
        const avatarPreview = getApiAsset(user.avatar_url);
        return TableRow({
          class: `transition-colors duration-150 cursor-pointer ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-blue-50'}`,
          onClick: () => onRowClick(user),
        }, [
          TableDCell({ class: 'px-4 py-3' }, [
            Avatar({
              src: avatarPreview,
              alt: user.display_name || user.username || user.email || 'User Avatar',
              fallback: user.display_name || user.username || user.email || ''
            })
          ]),
          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, [
            user.display_name || '—'
          ]),
          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, [
            user.username || '—'
          ]),
          TableDCell({ class: 'px-4 py-3 text-sm text-gray-500' }, [
            user.email || '—'
          ]),
          TableDCell({ class: 'px-4 py-3 text-sm' }, [
            Badge({
              label: user.is_active ? 'Active' : 'Inactive',
              tone: user.is_active ? 'success' : 'danger'
            })
          ])
        ])
      })
    ]),
  ]);
}

function UserDetailsPanel(props) {

  const loading = props.viewModel.getState('loading');
  const user = props.viewModel.getState('selected-user');

  const UserImage = () => {
    // Resolve avatar URL from API or fall back to bundled default image
    const avatarPreview = props.viewModel.getState('avatar-preview');

    const UserInitials = () => {
      if (avatarPreview) return false;

      return Row({ class: 'w-70 h-70 overflow-hidden rounded-md bg-gray-100 flex items-center justify-center' }, [
        Row({
          class: `w-40 h-40 rounded-full bg-blue-600 text-white text-5xl font-semibold flex items-center justify-center select-none`,
        }, getInitials(user.display_name))
      ]);
    } 



    return Row({ class: 'w-full flex flex-col items-center gap-2 mt-4' }, [
      UserInitials(),
      avatarPreview && Row({
        tagType: 'div',
        class: 'w-70 h-70 overflow-hidden rounded-md bg-gray-100 flex items-center justify-center',
        // attributes: { style: 'width:180px; height:180px;' }
      }, [
        Row({
          tagType: 'img',
          class: 'w-full h-full object-cover',
          attributes: {
            src: avatarPreview,
            alt: user?.display_name || 'User Avatar',
            loading: 'lazy',
            decoding: 'async',
            onerror: "this.onerror=null;this.src='/erin-lindford.jpg';"
          }
        })
      ]),
      Row({ class: 'text-sm font-medium text-gray-600 text-center truncate w-full' }, user.display_name || user.name || '')
    ]);
  };

  const UserInfo = ({label, value, icon}) => {
    return Row({ class: 'grid grid-rows-2 gap-3 items-center mb-4', attributes: { style: 'grid-template-columns: auto 1fr;' } }, [
      Row({ class: 'col-start-1 row-start-1 flex items-center' }, [IonIcon({ name: icon, class: 'text-indigo-800 text-xl' })]),
      Row({ class: 'col-start-2 row-start-1 text-md font-semibold text-gray-900' }, `${label}:`),
      Row({ class: 'col-start-2 row-start-2 text-sm text-gray-600 truncate' }, value || '—')
    ]);
  };

  const rolesObj = props.viewModel.getState('selected-user-roles') || [];
  const directRules = props.viewModel.getState('selected-user-direct-rules')    ;
  // const directRules = ['can.view.dashboard', 'can.edit.profile'];
  const permissionsLoading = props.viewModel.getState('permissions-loading');




  const formatToTitle = (input) => {
    return input
      .split('.')                 // Split by periods
      .map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)  // Capitalize first letter
      )
      .join(' ');                 // Join with spaces
  }
 
  const roleNames = rolesObj.filter(rn => rn.isAssigned).map(rn => Row({ class: 'px-2 py-1 bg-indigo-50 text-indigo-800 rounded text-sm' }, rn.role.name));
  const rules = directRules.filter(rn => rn.isDirect).map(rn => Row({ class: 'px-2 py-1 bg-indigo-50 text-indigo-800 rounded text-sm' }, rn.rule.description));

  const UserPermissions = ({label, values, icon}) => {
    return Row({ class: 'mb-4' }, [
      Row({ class: 'grid grid-rows-2 gap-x-3 gap-y-0.5 items-center', attributes: { style: 'grid-template-columns: auto 1fr;' } }, [
        Row({ class: 'col-start-1 row-start-1 items-center' }, [IonIcon({ name: icon, class: 'text-indigo-800 text-xl' })]),
        Row({ class: 'col-start-2 row-start-1 text-md font-semibold text-gray-900' }, `${label}:`),
        ...values.map((permit, idx) => Row({ class: `col-start-2 row-start-${idx + 2} text-sm text-gray-600 truncate` }, [permit]))
      ]),
      // Row({ class: 'grid grid-rows-2 gap-3 items-center bg-gray-300', attributes: { style: 'grid-template-columns: auto 1fr;' } }, [
      //     ...values.map((permit, idx) => (Row({class: `col-start-1 row-start-${idx+1} w-10 h-10`}), Row({ class: `col-start-2 row-start-${idx + 1} text-sm text-gray-900` }, `${permit}`)) )
      //   ])
      ])
  }

  

  const handleEdit = () => {
    props.setLocalState('show-details', false);
  };

  const handleClose = async (ms) => {

    const sleep = async (delay) => {
      return new Promise(resolve => setTimeout(resolve, delay));
    }

    


    props.setLocalState('show-slide', false);
    await sleep(ms);
    props.setLocalState('show-details', true);
    props.viewModel.updateState('selected-user', null);
  }

  return Row({ class: 'overflow-hidden h-full flex flex-col' }, [
    CardHeader({ class: 'px-2 flex justify-between items-center h-12 px-0' }, [
      // Row({ tagType: 'h2', class: 'text-xl text-indigo-800 font-semibold' }, user.display_name),
      Row({class: 'flex items-center gap-3'}, [
        IconButton({ onClick: async () => await handleClose(300), class: 'text-gray-500 hover:text-gray-700' }, [
          IonIcon({ name: 'close-outline', class: 'text-xl hydrated', }),
        ]),
        Row({ tagType: 'span', class: 'text-lg font-semibold text-indigo-800' }, 'User Details'),
      ]),
      Badge({label: user.is_active ? 'Active' : 'Inactive', tone: user.is_active ? 'success' : 'danger', class: 'mr-30'}),
      IconButton({ onClick: () => handleEdit() }, [
        IonIcon({ name: 'create-outline', class: 'font-bold text-xl' })
      ]),
    ]),
    loading && Row({ class: 'p-5 text-sm text-gray-500' }, 'Loading user details...'),
    !loading && user && Row({class: 'flex-1 overflow-y-auto'}, [
      UserImage(),
      Row({class: 'flex flex-col gap-1 px-4 py-5' }, [
        UserInfo({label: 'Email', value: user.email, icon: 'mail-outline'}),
        // UserInfo({label: 'Username', value: user.username, icon:  'person-outline'}),
        UserInfo({label: 'Last Updated',  value: formatUTCDate(user.updated_at), icon: 'hourglass-outline'}),
        UserPermissions({ label: 'Roles', values: roleNames, icon: 'shield-checkmark-outline' }),
        UserPermissions({ label: 'Direct Rules', values: rules, icon: 'key-outline' }),
    ]),
  ]),
    !loading && !user && Row({ class: 'p-5 text-sm text-gray-500' }, 'User details unavailable')
  ])
}

function PageControl(props)  {

  // Drawer({}, DrawerContent);


  

  const tableConfig = props.viewModel.getState('table-config');

  const initRow = parseInt(tableConfig.offset) + 1;
  let endRow = initRow + parseInt(tableConfig.limit);
  const totalRow = props.viewModel.getState('total-count');

  if(endRow > totalRow) endRow = totalRow;

  const handleSearch = (e) => {
    const query = e.target.value.trim();

    props.viewModel.setSearchQuery(query);

    // props.viewModel.updateState('search-query', query);

    // props.viewModel.loadUsers();
  };

  const handleExport = async () => {
    const result = await props.viewModel.exportUsersToCsv()
    console.log('export: ', result);
  }

  return Row({class: 'flex justify-between items-center pr-16 py-2'}, [
    Row({class: 'flex-1 flex items-center gap-5'}, [
      Button({ variant: 'primary', class: 'text-md font-bold text-white', onClick: () => openAddUserModal(props)}, [
        IonIcon({ name: 'person-add-outline', class: 'mr-2 text-white text-xl text-md font-bold'}), 'Add'
      ]),
      Input({ 
        placeholder: 'Search', class: 'max-w-100', value: props.viewModel.getState('search-query'),
        onChange: handleSearch
       }),
      Button({ variant: 'secondary', class: 'px-10 bg-gray-200 flex-nowrap', onClick: handleExport }, [
        IonIcon({ name: 'download-outline', class: 'mr-2 text-indigo-800 text-xl font-bold' }), 
        Row({class: 'text-sm font-md text-indigo-800 text-nowrap'}, 'Export to csv')
      ]),
    ]),
    Row({class: 'inline-flex items-center gap-4'}, [
      Row({tagType: 'p', class: 'font-sm text-gray-400'}, "Rows per page"),
      SelectRelative({name: 'limit', onChange: (e) => props.viewModel.setLimit(parseInt(e.target.value)), value: tableConfig.limit}, 
      SelectOptions({name: 'limit', options: ['10', '25', '50', '100'], selectedOption: tableConfig.limit + ''})),
      Row({tagType: 'p', }, "|"),
      Row({class: 'inline-flex items-center gap-1'}, [
        Row({tagType: 'p', class: 'font-sm text-gray-400'}, `${initRow}-${endRow} of ${totalRow}`),
        IconButton({onClick: () => props.viewModel.previousPage()}, [IonIcon({ name: 'caret-back-outline' })]),
        IconButton({onClick: () => props.viewModel.nextPage()}, [IonIcon({ name: 'caret-forward-outline' })])
      ])
    ])
  ])
}

function openAddUserModal(props) {
  Modal({}, (delegator, closeHandler) => ModalContent(props.viewModel,  delegator, closeHandler)) 
}

function Spinner() {
  return Row({ class: 'animate-spin border-3 border-green-600 border-t-transparent rounded-full h-6 w-6' }, []);
}

function UserEditTabs(props, children) {

  const handleClose = async (ms) => {

    const sleep = async (delay) => {
      return new Promise(resolve => setTimeout(resolve, delay));
    }


    props.setLocalState('show-slide', false);
    await sleep(ms);
    props.setLocalState('show-details', true);
    props.viewModel.updateState('selected-user', null);
  }

  props.ensureLocalStateKey('tabs', {
    general: true,
    roles: false,
    rules: false,
    auditLog: false,
  })

  const generalTab = props.getLocalState('tabs').general;
  const rolesTab = props.getLocalState('tabs').roles;
  const rulesTab = props.getLocalState('tabs').rules;
  // const auditLogTab = props.getLocalState('tabs').auditLog;



  const handleTabClick = (tab) => {

    props.setLocalState('tabs', {
      general: tab === 'general',
      roles: tab === 'roles-tab',
      rules: tab === 'rules-tab',
      auditLog: tab === 'audit-log-tab',
    }); 
  };

  const tabList = [
    {
      name: 'general',
      isActive: generalTab,
      displayAs: 'General'
    },
    {
      name: 'roles-tab',
      isActive: rolesTab,
      displayAs: 'Roles',
    },
    {
      name: 'rules-tab',
      isActive: rulesTab,
      displayAs: 'Rules'
    },
    // {
    //   name: 'audit-log-tab',
    //   isActive: auditLogTab,
    //   displayAs: 'Audit Log'
    // },
  ]

  const handleBackClick = () => {
    props.setLocalState('show-details', true);
  }

  const tabs = tabList.map(tab => Row({
    class: `h-full flex-1 flex justify-center items-center cursor-pointer py-2 px-4 ${tab.isActive ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-gray-500'}`,
    events: { 'click': () => handleTabClick(tab.name) }
  }, Row({ tagType: 'span', class: 'text-md' }, tab.displayAs)));

  return Row({class: 'flex flex-col h-full'}, [
    CardHeader({class: 'px-4 h-12 flex items-center'}, [
      IconButton({ className: 'mr-5 text-2xl', onClick: () => handleBackClick() }, [
        IonIcon({ name: 'arrow-back-outline', class: 'text-2xl hydrated' })
      ]),
      Row({class: 'h-full flex-1 flex justify-around'}, tabs),
      // ...tabs,
      IconButton({ className: 'ml-auto text-2xl', onClick: async () => await handleClose(300) }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ]),
    ]),
    Row({class: 'flex-1'}, [
      generalTab && children[0],
      rolesTab && children[1],
      rulesTab && children[2],
      // auditLogTab && children[3],
    ])
  ])
}

export default UsersTable;