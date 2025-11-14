import { Card, CardHeader, CardBody } from "../utils/Card";
import { Table, TableBody, TableDCell, TableFooter, TableHCell, TableHeader, TableRow } from "../utils/Table";
import Avatar from "../utils/Avatar";
import Badge from "../utils/Badge";
import UsersVM from "./UsersVM"
import { IconButton, IonIcon } from "../utils/Icon";
import { SelectOptions, SelectRelative } from "../utils/Select";
import { Input } from "../utils/Input";
import { Button } from "../utils/Button";
import Modal from "../shared/Modal";
import ModalContent from "./CreatUserModal";

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
    // props.ensureStateKey('selected-user');;
    // props.ensureStateKey('details-loading');

    const userList = props.viewModel.getState('user-list') || [];
    const loading = props.viewModel.getState('loading');
    const loadingMore = false;//props.viewModel.getState('loading-more');
    const error = props.viewModel.getState('error');
    const selectedUser = props.viewModel.getState('selected-user');
    const selectedUserId = 1; //props.viewModel.getState('selected-user-id');
    const detailsLoading = false;  // props.viewModel.getState('details-loading');
    const hasMore = false; //props.viewModel.getState('has-more');

    const handleScroll = (event) => {
      const container = event.currentTarget || event.target;
      if (!container) return;
      const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 80;
      if (nearBottom && !loadingMore) {
        props.viewModel.loadMoreUsers();
      }
    };

    const handleRowClick = (user) => {
      props.viewModel.openUserDetails(user.id);
    };

    const isPanelOpen = Boolean(detailsLoading || selectedUser);

    const triggerLoadMoreManually = () => {
      if (!loadingMore && hasMore) {
        props.viewModel.loadMoreUsers();
      }
    };

    return Card({class: 'relative'}, [
        CardHeader({class: 'text-xl font-semibold'}, "User Management"),
        CardBody({}, [
          error && Row({ class: 'mb-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm' }, error),
          loading && Row({ class: 'py-6 text-sm text-gray-500' }, 'Loading users...'),
          !loading && userList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500' }, 'No users found'),
          PageControl(props),
          !loading && userList.length > 0 && 
            table({
              userList,
              selectedUserId,
              onRowClick: handleRowClick
            }),
          !loading && hasMore && Row({ class: 'mt-3 flex justify-center' }, [
            Row({
              tagType: 'button',
              class: `px-4 py-2 rounded border text-sm ${loadingMore ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`,
              attributes: {
                disabled: loadingMore
              },
              events: {
                click: triggerLoadMoreManually
              }
            }, loadingMore ? 'Loading…' : 'Load More Users')
          ])
        ])
      ]);
      // UserDetailsPanel({
      //   isOpen: isPanelOpen,
      //   user: selectedUser,
      //   loading: detailsLoading,
      //   onClose: () => props.viewModel.closeUserDetails()
      // })
  }

  return StatefulRow({id: 'users-view', viewModel }, render);
}

function table({ userList, selectedUserId, onRowClick }) {

  return Table({ class: 'min-w-full divide-y divide-gray-200', id: 'users-table'}, [
    TableHeader({}, [
      TableHCell({ class: 'w-16' }, [ ]),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Full Name"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Username"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Email"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Status"),
    ]),
    TableBody({ class: 'max-h-[480px] overflow-y-auto'}, [
      ...userList.map(user => {
        const isSelected = selectedUserId === user.id;
        return TableRow({
          class: `transition-colors duration-150 cursor-pointer ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-blue-50'}`,
          events: {
            click: () => onRowClick(user)
          }
        }, [
          TableDCell({ class: 'px-4 py-3' }, [
            Avatar({
              src: user.avatar_url || user.avatar || null,
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
              tone: user.is_active ? 'success' : 'default'
            })
          ])
        ])
      })
    ]),
  ]);
}

function UserDetailsPanel({ isOpen, user, loading, onClose }) {
  const panelClasses = `fixed top-0 right-0 h-full w-full sm:w-[26rem] bg-white shadow-xl border-l border-gray-200 transform transition-transform duration-300 ease-in-out z-30 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;

  return Row({ class: panelClasses }, [
    Row({ class: 'flex items-center justify-between px-5 py-4 border-b border-gray-200' }, [
      Row({ tagType: 'h2', class: 'text-lg font-semibold text-gray-900' }, 'User Details'),
      Row({
        tagType: 'button',
        class: 'text-sm text-gray-500 hover:text-gray-700',
        events: {
          click: onClose
        }
      }, 'Close')
    ]),
    loading && Row({ class: 'p-5 text-sm text-gray-500' }, 'Loading user details...'),
    !loading && user && Row({ class: 'p-5 space-y-4 overflow-auto h-full' }, [
      Row({ class: 'flex items-center gap-3' }, [
        Avatar({
          src: user.avatar_url || user.avatar || null,
          alt: user.display_name || user.username || user.email || 'User Avatar',
          fallback: user.display_name || user.username || user.email || ''
        }),
        Row({ class: 'flex flex-col' }, [
          Row({ class: 'text-lg font-semibold text-gray-900' }, user.display_name || 'Unnamed User'),
          Row({ class: 'text-sm text-gray-500' }, user.email || 'No email provided')
        ])
      ]),
      Row({ class: 'space-y-2 text-sm text-gray-600' }, [
        Row({}, [Row({ class: 'font-medium text-gray-500 uppercase text-xs' }, 'Username'), Row({}, user.username || '—')]),
        Row({}, [Row({ class: 'font-medium text-gray-500 uppercase text-xs' }, 'Status'), Badge({ label: user.is_active ? 'Active' : 'Inactive', tone: user.is_active ? 'success' : 'default' })]),
        Row({}, [Row({ class: 'font-medium text-gray-500 uppercase text-xs' }, 'Created'), Row({}, user.created_at ? new Date(user.created_at).toLocaleString() : '—')]),
        Row({}, [Row({ class: 'font-medium text-gray-500 uppercase text-xs' }, 'Updated'), Row({}, user.updated_at ? new Date(user.updated_at).toLocaleString() : '—')])
      ])
    ]),
    !loading && !user && Row({ class: 'p-5 text-sm text-gray-500' }, 'User details unavailable')
  ]);
}

function PageControl(props)  {
  return Row({class: 'flex justify-between items-center pr-16 py-2'}, [
    Row({class: 'flex-1 flex items-center gap-5'}, [
      Button({ variant: 'primary', class: 'text-md font-bold text-white', onClick: openAddUserModal}, [
        IonIcon({ name: 'person-add-outline', class: 'mr-2 text-white text-xl text-md font-bold'}), 'Add'
      ]),
      Input({ name: 'search', placeholder: 'Search', class: 'max-w-100' }),
      Button({ variant: 'secondary', class: 'bg-gray-200' }, [
        IonIcon({ name: 'download-outline', class: 'mr-2 text-indigo-800 text-xl font-bold' }), 'Export to csv'
      ]),
    ]),
    Row({class: 'inline-flex items-center gap-4'}, [
      Row({tagType: 'p', class: 'font-sm text-gray-400'}, "Rows per page"),
      SelectRelative({}, SelectOptions({options: ['10', '25', '50', '100']})),
      Row({tagType: 'p', }, "|"),
      Row({class: 'inline-flex items-center gap-1'}, [
        Row({tagType: 'p', class: 'font-sm text-gray-400'}, " 1-10 of 20 "),
        IconButton({}, [IonIcon({ name: 'caret-back-outline' })]),
        IconButton({}, [IonIcon({ name: 'caret-forward-outline' })])
      ])
    ])
  ])
}

function openAddUserModal() {
  Modal({}, ModalContent) 
}

export default UsersTable;