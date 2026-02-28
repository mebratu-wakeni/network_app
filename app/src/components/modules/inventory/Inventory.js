import { CardBody, CardHeader } from "../../utils/Card";
import { Tabs } from "../../utils/Tabs";
import { InventoryVM } from "./InventoryVM";
import { Products } from "./tabs/Products";
import { Stock } from "./tabs/Stock";

const { Row, StatefulRow } = Liteframe;


export function InventoryUI() {
  const viewModel = new InventoryVM();

  const render = (props) => {
    return Row({ class: 'w-full h-full flex flex-col overflow-hidden'}, [
      CardHeader({ class: 'px-4 md:px-6 text-gray-900 text-md font-semibold flex items-center h-11 flex-shrink-0' }, 'Inventory Management'),
      CardBody({ class: 'px-3 md:px-4 py-2 flex flex-col overflow-y-auto flex-1 min-h-0'}, [
        Row({ class: 'bg-white border border-gray-200 rounded-lg w-full flex flex-col min-h-full' }, [
          InventoryTabs(props),
          InventoryTabContents(props)
        ])
      ])
    ])
  } 

  return StatefulRow({
    class: 'w-full h-full overflow-hidden',
    viewModel,
    stateKeys: [
      'loading',
      'inventory-tab',
      'product-list',
      'product-total-count',
      'product-table-config',
      'product-search-query',
      'product-filter',
      'product-stats',
      'stock-list'
    ]
  }, render)
}

function InventoryTabs(props) {
  return Row({ class: 'mb-1'}, [
    Tabs({
      tabs: [
        { key: 'products', label: 'Products'},
        { key: 'stock', label: 'Stock'}
      ],
      activeKey: props.viewModel.getActiveTab(),
      onChange: (key) => props.viewModel.updateTab(key),
      class: 'w-20 px-1'
    })
  ])
}

function InventoryTabContents(props) {

  const activeTab = props.viewModel.getActiveTab();

  const tabContent = () => {
    switch(activeTab) {
      case 'products':
        return Products(props);
      case 'stock':
        return Stock(props);
      default:
        return false;
    }

  }


  return Row({ class: 'flex flex-col'}, [
    tabContent()
  ])
}