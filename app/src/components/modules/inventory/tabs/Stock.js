import { ActionDropdown, ActionItem } from '../../../utils/Action';
import { DropdownSearch, DropdownSearchItem } from '../../../utils/DropdownSearch';
import { ManageDSOutsideClick, ManageOutsideClick } from '../../../utils/OutsideClick';

const { Row } = Liteframe;

let cleanupOutsideClick;

export function Stock(props) {

  return UsersTable(props);
}

function UsersTable(props) {
  const productList = props.viewModel.getProductList();

  props.ensureLocalStateKey('openActionId', null);

  props.ensureLocalStateKey('open-search', false);
  props.ensureLocalStateKey('search-query', '');
  props.ensureLocalStateKey('selected-item', {});

  const openActionId = props.getLocalState('openActionId');

  const filterProducts = (query) => {
    return props.viewModel.filterProductList(query)
  }

  return Row({ class: 'relative w-full' }, [
    DropdownSearch({
      open: props.getLocalState('open-search'),
      value: props.getLocalState('search-query'),
      placeholder: 'Search..',
      onInput: (value) => {

        props.setLocalState('search-query', value);
        props.setLocalState('open-search', true);
      },
      onFocus: () => {
        console.log('search is focused.')
        props.setLocalState('open-search', true)
      },
      getOpenState: () => props.getLocalState('open-search'),
      setOpenState: () => props.setLocalState('open-search', false),

    }, [
      filterProducts(props.getLocalState('search-query')).length === 0 &&
      Row({ class: 'px-3 py-2 text-sm text-gray-500' }, 'No results'),
      filterProducts(props.getLocalState('search-query')).map(product => DropdownSearchItem({
        class: 'border border-bottom border-gray-200',
        onSelect: () => {
          props.setLocalState('selected-item', product);
          props.setLocalState('search-query', product.name);
          props.setLocalState('open-search', false)
        }
      }, [
        Row({}, product.name),
        Row({}, product.category),
      ]))
    ])
  ]);

  // Register once
  // if (!cleanupOutsideClick) {
  //   cleanupOutsideClick = ManageDSOutsideClick({
  //     containerEl: container,
  //     handleGetState: () => props.getLocalState('openActionId'),
  //     handleSetState: () => props.setLocalState('openActionId', null)
  //   });
  // }

}


// productList.map(product =>
//   Row({ class: 'flex items-center justify-between py-2' }, [
//     Row({}, product.description || product.name),

//     ActionDropdown({
//       actionId: product.id,
//       open: openActionId === product.id,
//       onToggle: () => {
//         // viewModel.updateState(
//         //   'openActionId',
//         //   state.openActionId === user.id ? null : user.id
//         // );

//         props.setLocalState('openActionId', openActionId === product.id ? null : product.id)
//       }
//     }, 

// [
//       ActionItem({
//         label: 'Edit',
//         // class: 'bg-gray-200 text-indigo-700',
//         onClick: () => {
//           // editUser(product);
//           // viewModel.updateState('openActionId', null);
//           props.setLocalState('openActionId', null)
//         }
//       }),
//       ActionItem({
//         label: 'Deactivate',
//         danger: true,
//         onClick: () => {
//           // deactivateUser(product);
//           props.setLocalState('openActionId', null)
//           // viewModel.updateState('openActionId', null);
//         }
//       })
//     ]
  
//   )
//   ])
// ),
