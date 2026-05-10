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

export function SalesUI(props = {}) {
  const { router, navigationVM } = props
  const viewModel = new SalesVM();

  const render = (renderProps) => {
    const mergedProps = { ...renderProps, router, navigationVM }
    mergedProps.ensureLocalStateKey('isExpanded', false);

    // Handle cross-module navigation: open Sales History with specific order (from ReceivablesTab)
    const pendingOpen = navigationVM?.getState?.('pending-sales-open')
    if (pendingOpen && mergedProps.viewModel.getActiveTab() !== 'sales-history') {
      setTimeout(() => {
        mergedProps.viewModel.updateTab('sales-history')
        mergedProps.setLocalState('isExpanded', true)
      }, 0)
    }

    // Handle cross-module navigation: open Sales History with date filter (from Dashboard)
    const pendingFilter = navigationVM?.getState?.('pending-sales-filter')
    if (pendingFilter && mergedProps.viewModel.getActiveTab() !== 'sales-history') {
      setTimeout(() => {
        mergedProps.viewModel.updateTab('sales-history')
        mergedProps.viewModel.updateSalesOrderTableConfig({
          date_from: pendingFilter.date_from,
          date_to: pendingFilter.date_to,
          offset: 0
        })
        mergedProps.setLocalState('isExpanded', true)
        if (navigationVM) navigationVM.updateState('pending-sales-filter', null)
      }, 0)
    } else if (pendingFilter && mergedProps.viewModel.getActiveTab() === 'sales-history') {
      setTimeout(() => {
        mergedProps.viewModel.updateSalesOrderTableConfig({
          date_from: pendingFilter.date_from,
          date_to: pendingFilter.date_to,
          offset: 0
        })
        if (navigationVM) navigationVM.updateState('pending-sales-filter', null)
      }, 0)
    }

    return Row({ class: 'w-full h-full flex flex-col overflow-hidden' }, [
      CardHeader({
        class: 'px-6 text-gray-900 text-md font-semibold flex items-center h-12 flex-shrink-0'
      }, 'Sales Management'),
      CardBody({ class: 'px-3 md:px-4 py-2 flex flex-row h-full overflow-hidden gap-3' }, [
        LeftPanel(mergedProps),
        RightPanel(mergedProps),
      ]),
    ]);
  };

  return StatefulRow({
    class: 'w-full h-full overflow-hidden',
    viewModel,
    stateKeys: [
      'loading',
      'sales-tab',
      'customer-list',
      'customer-search-query',
      'customer-dropdown-loading',
      'product-list',
      'product-search-query',
      'product-dropdown-loading',
    ],
  }, render)
}

function LeftPanel(props) {
  const isExpanded = props.getLocalState('isExpanded')
  return Row({
    class: `flex-shrink-0 flex flex-col min-h-0 overflow-hidden gap-4 transition-[width,min-width] duration-300 ease-in-out ${isExpanded ? 'w-0 min-w-0' : 'w-1/3 min-w-0'}`,
  }, [
    ProductSection(props),
    CustomerSection(props),
  ]);
}

function RightPanel(props) {
  const isExpanded = props.getLocalState('isExpanded')

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
  return Row({ class: `${isExpanded ? 'flex-1' : 'flex-2/3'} flex flex-col gap-2 min-h-0 overflow-x-visible overflow-y-hidden border border-gray-200 rounded-lg min-w-0` }, [
    SalesTabs(props),
    Row({ class: 'flex flex-wrap justify-between px-3 md:px-6 py-1 items-center gap-2' }, [
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
  const activeTab = props.viewModel.getActiveTab()
  const pendingOpen = props.navigationVM?.getState?.('pending-sales-open')

  const tabContent = () => {
    switch (activeTab) {
      case 'current-sale':
        return CurrentSale(props)
      case 'sales-history':
        return SalesHistory({ ...props, pendingSalesOpen: pendingOpen })
      case 'hold-orders':
        return HoldOrders(props)
      default:
        return CurrentSale(props)
    }
  }

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-auto' }, [
    tabContent(),
  ]);
}
