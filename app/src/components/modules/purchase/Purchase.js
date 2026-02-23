import { CardBody, CardHeader } from "../../utils/Card";
import { Tabs } from "../../utils/Tabs";
import { PurchaseVM } from "./PurchaseVM";
import { CurrentOrder } from "./tabs/CurrentOrder";
import { OrderHistory } from "./tabs/OrderHistory";
import { HoldOrders } from "./tabs/HoldOrders";
import { ProductSection } from "./ProductSection";
import { SupplierSection } from "./SupplierSection";
import { PaymentModalContent } from "./PaymentModal";
import Modal from "../../shared/Modal";
import { IconButton, IonIcon } from "../../utils/Icon";
import { Button } from "../../utils/Button";
import { OpenImportPurchaseOrderModal } from "./OpenImportPurchaseOrder";
import { showAlert } from '../../utils/ModalHelpers';

const { Row, StatefulRow } = Liteframe;

export function PurchaseUI(props = {}) {
  const { router, navigationVM } = props;
  const viewModel = new PurchaseVM();

  const render = (renderProps) => {
    const mergedProps = { ...renderProps, router, navigationVM };
    const leftPanelCollapsed = mergedProps.viewModel.getState('left-panel-collapsed');

    mergedProps.ensureLocalStateKey('isExpanded', false);

    // Handle cross-module navigation: open Order History with specific order (from PayablesTab)
    const pendingOpen = navigationVM?.getState?.('pending-purchase-open');
    if (pendingOpen && mergedProps.viewModel.getActiveTab() !== 'order-history') {
      setTimeout(() => {
        mergedProps.viewModel.updateTab('order-history');
        mergedProps.setLocalState('isExpanded', true);
      }, 0);
    }

    // Handle cross-module navigation: open Order History with date filter (from Dashboard)
    const pendingFilter = navigationVM?.getState?.('pending-purchase-filter');
    if (pendingFilter && mergedProps.viewModel.getActiveTab() !== 'order-history') {
      setTimeout(() => {
        mergedProps.viewModel.updateTab('order-history');
        mergedProps.viewModel.updateOrderTableConfig({
          date_from: pendingFilter.date_from,
          date_to: pendingFilter.date_to,
          offset: 0
        });
        mergedProps.setLocalState('isExpanded', true);
        if (navigationVM) navigationVM.updateState('pending-purchase-filter', null);
      }, 0);
    } else if (pendingFilter && mergedProps.viewModel.getActiveTab() === 'order-history') {
      setTimeout(() => {
        mergedProps.viewModel.updateOrderTableConfig({
          date_from: pendingFilter.date_from,
          date_to: pendingFilter.date_to,
          offset: 0
        });
        if (navigationVM) navigationVM.updateState('pending-purchase-filter', null);
      }, 0);
    }
    
    return Row({ class: 'w-full h-full flex flex-col overflow-hidden'}, [
      CardHeader({ 
        class: 'px-6 text-gray-900 text-md font-semibold flex items-center h-12 flex-shrink-0' 
      }, 'Purchase Management'),
      CardBody({ class: 'px-4 py-2 flex flex-row h-full overflow-hidden gap-4'}, [
        LeftPanel(mergedProps),
        RightPanel(mergedProps)
      ]),
    ])
  } 

  return StatefulRow({ 
    class: 'w-full h-full overflow-hidden', 
    viewModel, 
    stateKeys: ['loading', 'purchase-tab'] 
  }, render)
}

function LeftPanel(props) {
  const isExpanded = props.getLocalState('isExpanded');
  return Row({
    class: `flex-shrink-0 flex flex-col min-h-0 overflow-hidden gap-4 transition-[width,min-width] duration-300 ease-in-out ${isExpanded ? 'w-0 min-w-0' : 'w-1/3 min-w-0'}`,
  }, [
    ProductSection(props),
    SupplierSection(props),
  ]);
}

  

function RightPanel(props) {
  const isExpanded = props.getLocalState('isExpanded');
  const purchaseTab = props.viewModel.getActiveTab();

  const handleImportPurchaseOrder = () => {
    OpenImportPurchaseOrderModal(props);
  };
  const handleExportPurchaseOrder = async () => {
    try {
      const result = await props.viewModel.exportPurchaseOrder();
      if (result && !result.success) {
        showAlert({ message: 'Failed to export purchase order', variant: 'error' });
      }
    } catch (error) {
      console.error('[Purchase] Export error:', error);
      showAlert({ message: error.message || 'Failed to export purchase order', variant: 'error' });
    }
  };

  return Row({ class: `${isExpanded ? 'flex-1' : 'flex-2/3'} flex flex-col gap-2 min-h-0 overflow-hidden border border-gray-200 rounded-lg min-w-0` }, [
    PurchaseTabs(props),
    Row(
      { class: 'flex justify-between px-6 items-center' },
      [
        Row({ class: 'flex items-center gap-4' }, [
          Button({ variant: 'outline', class: 'text-nowrap', onClick: handleImportPurchaseOrder }, 'Import Purchase Order'),
          purchaseTab === 'order-history' ? Button({ variant: 'secondary', class: 'text-nowrap', onClick: handleExportPurchaseOrder }, 'Export Purchase Order') : null
        ]),
        IconButton({
          onClick: () => props.setLocalState('isExpanded', !props.getLocalState('isExpanded')),
          class: 'text-indigo-600 text-2xl self-end'
        }, IonIcon({ name: `${isExpanded ? 'contract-outline' : 'expand-outline'}` }))
      ]
    ),
    PurchaseTabContents(props)
  ]);
}
function PurchaseTabs(props) {
  // props.ensureLocalStateKey('purchase-tab', 'current-order');

  // const activeTab = props.getLocalState('purchase-tab');
  const activeTab = props.viewModel.getActiveTab();

  const updateTab = (tabKey) => {
    // props.setLocalState('purchase-tab', tabKey);
    if (tabKey === 'order-history' || tabKey === 'hold-orders') {
      props.setLocalState('isExpanded', true);
    }
    if (tabKey === 'current-order') {
      props.setLocalState('isExpanded', false);
    }
    props.viewModel.updateTab(tabKey);
  }
  return Row({ class: ''}, [
    Tabs({
      tabs: [
        { key: 'current-order', label: 'Current Order'},
        { key: 'order-history', label: 'Order History'},
        { key: 'hold-orders', label: 'Hold Orders'},
      ],
      activeKey: activeTab,
      onChange: (key) => updateTab(key),
      class: 'px-4'
    })
  ])
}

function PurchaseTabContents(props) {
  const activeTab = props.viewModel.getActiveTab();
  const pendingOpen = props.navigationVM?.getState?.('pending-purchase-open');

  const tabContent = () => {
    switch(activeTab) {
      case 'current-order':
        return CurrentOrder(props);
      case 'order-history':
        return OrderHistory({ ...props, pendingPurchaseOpen: pendingOpen });
      case 'hold-orders':
        return HoldOrders(props);
      default:
        return CurrentOrder(props);
    }
  }

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden'}, [
    tabContent()
  ])
}
