import { CardBody, CardHeader } from "../../utils/Card";
import { Tabs } from "../../utils/Tabs";
import { SalesVM } from "./SalesVM";
import { CurrentSale } from "./tabs/CurrentSale";
import { SalesHistory } from "./tabs/SalesHistory";
import { HoldOrders } from "./tabs/HoldOrders";
import { ProductSection } from "./ProductSection";
import { CustomerSection } from "./CustomerSection";
import { PaymentModalContent } from "./PaymentModal";
import Modal from "../../shared/Modal";
import { IconButton, IonIcon } from "../../utils/Icon";
import { Button } from "../../utils/Button";
import { OpenImportSalesOrderModal } from "./OpenImportSalesOrder";
// import showAlert from "../../utils/ModalHelpers";
import { showAlert } from '../../utils/ModalHelpers';

const { Row, StatefulRow } = Liteframe;

export function SalesUI() {
  const viewModel = new SalesVM();

  const render = (props) => {
    props.ensureLocalStateKey('isExpanded', false);

    return Row({ class: 'w-full h-full flex flex-col overflow-hidden' }, [
      CardHeader({
        class: 'px-6 text-gray-900 text-md font-semibold flex items-center h-12 flex-shrink-0'
      }, 'Sales Management'),
      CardBody({ class: 'p-6 flex flex-row h-full overflow-hidden gap-4' }, [
        LeftPanel(props),
        RightPanel(props),
      ]),
    ]);
  };

  return StatefulRow({
    class: 'w-full h-full overflow-hidden',
    viewModel,
    stateKeys: ['loading'],
  }, render);
}

function LeftPanel(props) {
  const isExpanded = props.getLocalState('isExpanded');
  return Row({
    class: `flex-shrink-0 flex flex-col min-h-0 overflow-hidden gap-4 transition-[width,min-width] duration-300 ease-in-out ${isExpanded ? 'w-0 min-w-0' : 'w-1/3 min-w-0'}`,
  }, [
    ProductSection(props),
    CustomerSection(props),
  ]);
}

function RightPanel(props) {
  const isExpanded = props.getLocalState('isExpanded');

  const handleImportSalesOrder = () => {
    OpenImportSalesOrderModal(props);
  };
  const handleExportSalesOrder = async () => {
    try {
      const result = await props.viewModel.exportSalesOrder();
      if (result && !result.success) {
        showAlert({ message: 'Failed to export sales order', variant: 'error' });
      }
    } catch (error) {
      console.error('[Sales] Export error:', error);
      showAlert({ message: error.message || 'Failed to export sales order', variant: 'error' });
    }
  };
  return Row({ class: `${isExpanded ? 'flex-1' : 'flex-2/3'} flex flex-col gap-4 min-h-0 overflow-hidden border border-gray-200 rounded-lg min-w-0` }, [
    SalesTabs(props),
    Row({ class: 'flex justify-between pt-4 px-6 items-center' }, [
        Row({ class: 'flex items-center gap-4'}, [
          Button({ variant: 'outline', class: 'text-nowrap', onClick: handleImportSalesOrder }, 'Import Sales Order'),
          props.viewModel.getActiveTab() === 'sales-history' ? Button({ variant: 'secondary', class: 'text-nowrap', onClick: handleExportSalesOrder }, 'Export Sales Order') : null,
        ]),
        IconButton({
          onClick: () => props.setLocalState('isExpanded', !props.getLocalState('isExpanded')),
          class: 'text-indigo-600 text-2xl self-end',
        }, IonIcon({ name: `${isExpanded ? 'contract-outline' : 'expand-outline'}` })),
      ]
    ),
    SalesTabContents(props),
  ]);
}

function SalesTabs(props) {
  const activeTab = props.viewModel.getActiveTab();

  const updateTab = (tabKey) => {
    if (tabKey === 'sales-history' || tabKey === 'hold-orders') {
      props.setLocalState('isExpanded', true);
    }
    if (tabKey === 'current-sale') {
      props.setLocalState('isExpanded', false);
    }
    props.viewModel.updateTab(tabKey);
  };
  return Row({ class: '' }, [
    Tabs({
      tabs: [
        { key: 'current-sale', label: 'Current Sale' },
        { key: 'sales-history', label: 'Sales History' },
        { key: 'hold-orders', label: 'Hold Orders' },
      ],
      activeKey: activeTab,
      onChange: (key) => updateTab(key),
      class: 'px-4',
    }),
  ]);
}

function SalesTabContents(props) {
  const activeTab = props.viewModel.getActiveTab();

  const tabContent = () => {
    switch (activeTab) {
      case 'current-sale':
        return CurrentSale(props);
      case 'sales-history':
        return SalesHistory(props);
      case 'hold-orders':
        return HoldOrders(props);
      default:
        return CurrentSale(props);
    }
  };

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }, [
    tabContent(),
  ]);
}
