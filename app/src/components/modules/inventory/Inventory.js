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
      CardHeader({ class: 'px-6 text-gray-900 text-md font-semibold flex items-center h-12 flex-shrink-0' }, 'Inventory Management'),
      CardBody({ class: 'p-6 flex flex-col overflow-hidden flex-1 min-h-0'}, [
        Row({ class: 'bg-white border border-gray-200 rounded-lg flex-1 w-full flex flex-col min-h-0 overflow-hidden' }, [
          InventoryTabs(props),
          InventoryTabContents(props)
        ])
      ])
    ])
  } 

  return StatefulRow({ class: 'w-full h-full overflow-hidden', viewModel, stateKeys: ['loading']}, render)
}

function InventoryTabs(props) {
  return Row({ class: 'mb-6'}, [
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


  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden'}, [
    tabContent()
  ])
}