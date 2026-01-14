import { Button } from "../../../utils/Button";
import { Input } from "../../../utils/Input";
import { SelectFluid, SelectOptions, SelectRelative } from "../../../utils/Select";
import { IconButton } from "../../../utils/Icon";
import { IonIcon } from "../../../utils/Icon";
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from "../../../utils/Table";
import Dropdown from "../../../utils/Dropdown";
import { ActionDropdown, ActionItem } from "../../../utils/Action";
import Drawer from "../../../shared/ExampleDrawer";
import { CardHeader } from "../../../utils/Card";
import { DropdownSearch } from "../../../utils/DropdownSearch";

const { Row } = Liteframe;

export function Products(props) {

  const tableConfig = props.viewModel.getState('table-config');
  const initRow = parseInt(tableConfig.offset) + 1;
  let endRow = initRow + parseInt(tableConfig.limit) - 1;
  const totalRow = props.viewModel.getState('total-count');

  const loading = props.viewModel.getState('loading');
  const productList = props.viewModel.getProductList();
  props.ensureLocalStateKey('selected-product', null);
  const selectedProduct = props.getLocalState('selected-product');

  return Row({ class: 'w-full flex-1 flex flex-col'}, [
    loading && productList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0' }, 'Loading users...'),
    !loading && productList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0' }, 'No users found'),
    Row({ class: 'flex items-center justify-between gap-6 p-6'}, [
      Row({ class: 'flex items-center justify-between gap-6'}, [
        // Input({ placeholder: 'Search',}),
        Button({ variant: 'primary', class: 'text-nowrap' }, '+ Add'),
        Button({ variant: 'outline', class: 'text-nowrap' }, 'Import Products'),
      ]),
      Button({ variant: 'secondary', class: 'text-nowrap' }, 'Export to csv')
      
    ]),
    Row({ class: 'px-6 pb-6 flex items-center justify-between gap-12' }, [
      Input({ placeholder: 'Search', class: 'flex-1/2'}),
      Row({ class: 'flex-1/2 flex items-center gap-4 justify-end' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, "Rows per page"),
        SelectRelative({ name: 'limit', onChange: (e) => props.viewModel.setLimit(parseInt(e.target.value)), value: tableConfig.limit },
          SelectOptions({ name: 'limit', options: ['10', '25', '50', '100'], selectedOption: tableConfig.limit + '' })),
        Row({ tagType: 'p', }, "|"),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, `${initRow}-${endRow} of ${totalRow}`),
          IconButton({ onClick: () => props.viewModel.previousPage() }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: () => props.viewModel.nextPage() }, [IonIcon({ name: 'caret-forward-outline' })])
        ]),
      ]),
    ]),
    // Products Table
    ProductTable(props),
    ProductDetails(props)
  ])
}

function ProductTable(props) {
  const productList = props.viewModel.getProductList();
  props.ensureLocalStateKey('actionId', null);
  props.ensureLocalStateKey('selectedRowId', null);
  const selectedRowId = props.getLocalState('selectedRowId')
  const actionId = props.getLocalState('actionId');
  return Table({ 
    class: 'flex-1 flex flex-col', 
    getOpenActionState: () => props.getLocalState('actionId'), 
    setOpenActionState: () => props.setLocalState('actionId', null)  
  }, [
    TableHeader({ class: 'sticky top-0 z-10' }, [ // 'sticky top-12 z-10 mb-10'
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Code"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Description/Name"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Category"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Unit"),
      TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Action"),      
    ]),
    TableBody({ class: 'flex-1 overflow-y-auto'}, 
      productList.map(row => TableRow({ class: `transition-colors duration-150 cursor-pointer ${selectedRowId === row.id ? 'bg-blue-50 border-l-2 border-indigo-500' : ''} hover:bg-blue-50` }, [
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.product_code),
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.description || row.name),
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.category),
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.unit),
        ActionDropdown({
          actionId: row.id,
          open: row.id === actionId,
          class: 'text-center',
          onToggle: () => props.setLocalState('actionId', actionId === row.id ? null : row.id),
          class: 'px-4 py-3'
        }, [
          ActionItem({
            label: 'Edit',
            icon: 'create-outline',
            // class: 'bg-gray-200 text-indigo-700',
            onClick: () => {
              props.setLocalState('selected-product', row);
              props.setLocalState('actionId', null);
              props.setLocalState('selectedRowId', row.id);
            }
          }),
          ActionItem({
            label: 'Bin Card', 
            icon: 'reader-outline',
            danger: false,
            onClick: () => {
              // deactivateUser(product);
              props.setLocalState('actionId', null)
              // viewModel.updateState('openActionId', null);
            }
          }),
          // ActionItem({
          //   label: 'Delete',
          //   danger: true,
          //   onClick: () => {
          //     // deactivateUser(product);
          //     props.setLocalState('actionId', null)
          //     // viewModel.updateState('openActionId', null);
          //   }
          // })
        ]),

      ]))
    )
  ])
}

function ProductDetails(props) {
  if (props.getLocalState('selectedRowId') === null) return;

  const product = props.getLocalState('selected-product');
  console.log('product: ', product)

  const handleCancel = () => {
    props.setLocalState('selected-product', null);
    props.setLocalState('selectedRowId', null);
  }

  const handleSave = () => {

  }

  return Drawer({class: 'h-full overflow-y-hidden'}, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 mb-6' }, [
      Row({ class: 'text-md font-semibold' }, "Product Details"),
      IconButton({  onClick: () => props.setLocalState('selectedRowId', null)}, 
        IonIcon({ name: 'close-outline', class: 'text-xl font-bold'})
    )
    ]),

    Row({class: 'flex items-center gap-6 justify-end p-6 mb-8'}, [
      Button({variant: 'secondary', class: 'w-30', onClick: handleCancel}, 'Cancel'),
      Button({ variant: 'primary', class: 'w-30', onClick: handleSave }, 'Save')
    ]),
    
    formRow({
      left: Row({ tagType: 'label', attributes: { for: 'product-name' }, class: 'text-gray-800 font-medium float-right' }, 'Product Name:'),
      right: Input({
        value: product.name || '',
        class: 'text-gray-500 font-normal',
        onChange: (e) => {},
        name: 'product-name',
      }),
    }),

    formRow({
      left: Row({ tagType: 'label', attributes: { for: 'product-description' }, class: 'text-gray-800 font-medium float-right' }, 'Description:'),
      right: Input({
        value: product.description || '',
        class: 'text-gray-500 font-normal',
        onChange: (e) => { },
        name: 'product-description',
      }),
    }),

    formRow({
      left: Row({ tagType: 'label', attributes: {for: 'product-category'}, class: 'text-gray-800 font-medium float-right' }, 'Category:'),
      right: Row({ class: 'flex items-center gap-6' }, [
        SelectFluid({}, SelectOptions({ name: 'product-category', containerClass: 'flex-1', options: ['Regent', 'Supplies'], selectedOption: ''})),
        Button({variant: 'outline', class: 'w-20 text-nowrap'}, '+ New'),
      ])
    }),
    formRow({
      left: Row({ tagType: 'label', attributes: { for: 'product-unit' }, class: 'text-gray-800 font-medium float-right' }, 'Unit:'),
      right: Row({ class: 'flex items-center gap-6' }, [
        SelectFluid({}, SelectOptions({ name: 'product-unit', containerClass: 'flex-1', options: ['Bottle', 'PK', 'Kit'], selectedOption: '' })),
        Button({ variant: 'outline', class: 'w-20 text-nowrap' }, '+ New'),
      ])
    })



  ])
}

const formRow = ({ left, right }) => {
  return Row({ class: 'w-full flex justify-between items-center mb-6 gap-x-4 px-4 mb-20' }, [
    Row({ class: 'flex-1/4' }, [
      left
    ]),
    Row({ class: 'flex-3/4 pr-6' }, [
      right,

    ]),
  ]);
};

export { formRow}