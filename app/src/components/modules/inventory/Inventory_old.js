const { Row, StatefulRow } = Liteframe;
import { Tabs } from "../../utils/Tabs";
import { InventoryVM } from "./InventoryVM_old";
import { CardBody, CardHeader } from "../../utils/Card";

export function Inventory() {
  const viewModel = new InventoryVM();

  const render = (props) => {
    const activeTab = props.viewModel.getState('inventory-tab');
    return Row({ class: 'w-full h-full flex flex-col' }, [
      CardHeader({ class: 'px-6 flex items-center h-12' }, [
        Row({ class: 'text-md font-semibold' }, "Inventory Management"),
      ]),
      CardBody({ class: 'flex-1 flex flex-col gap-6 px-6 overflow-y-auto'}, [
        Row({ class: 'h-100 bg-white rounded-lg border border-gray-200 overflow-hidden' }, [
          InventoryTabs(props),
          Row({ class: 'p-6' }, [
            TabContents(props),
          ])
        ])
      ]),
      
      
    ]);
  }

  return StatefulRow({ class: 'h-full w-full', viewModel, stateKeys: ['loading'] }, render)
}

function InventoryTabs(props) {

  return Row({ class: 'px-6 pt-4 border-b border-gray-200 bg-gray-50' }, [
    Tabs({
      tabs: [
        { key: 'products', label: 'Products' },
        { key: 'stock', label: 'Stock' }
      ],
      activeKey: props.viewModel.getActiveTab(),
      onChange: (key) => props.viewModel.updateTab(key),
      class: 'w-20'
    })
  ])
}


function TabContents(props) {
  const { viewModel } = props;
  const activeTab = viewModel.getActiveTab() || 'stock';

  switch (activeTab) {
    case 'products':
      return Row({ class: 'text-3xl font-bold text-gray-500' }, 'Products');

    case 'stock':
      return Row({ class: 'text-3xl font-bold text-gray-500' }, 'Stock');

    default:
      return false;
  }
}