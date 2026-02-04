import { CardHeader, CardBody } from '../../utils/Card';
import { Input } from '../../utils/Input';
import { IonIcon } from '../../utils/Icon';
import { DropdownSearch, DropdownSearchItem } from '../../utils/DropdownSearch';
import { formItem } from './ProductSection';
import Badge from '../../utils/Badge';

const { Row } = Liteframe;

export function SupplierSection(props) {
  const suppliers = props.viewModel.getSupplierList();
  const selectedSupplier = props.viewModel.getState('selected-supplier');
  const searchQuery = props.viewModel.getState('supplier-search-query') || '';
  const loading = props.viewModel.getState('loading');

  const isWithholding = props.viewModel.getState('current-order').is_withholding;


  return Row({ class: 'flex-4/9 flex flex-col min-h-0 overflow-hidden border border-gray-200 rounded-lg' }, [
    CardHeader({ 
      class: 'px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0' 
    }, [
      Row({ class: 'flex items-center gap-2' }, [
        IonIcon({ name: 'business-outline', class: 'text-lg' }),
        'Suppliers'
      ])
    ]),
    CardBody({ class: 'p-4 flex flex-col gap-4 flex-1 min-h-0 overflow-auto' }, [
      SearchSupplier(props),
      Row({ class: 'flex gap-4 items-center mb-6', events: { click: () => props.viewModel.toggleWithholding() }}, [
        IonIcon({ name: `${isWithholding ? 'checkbox' : 'square-outline'}`, class: 'text-3xl select-none' }),
        Row({ tagType: 'label', class: 'text-sm text-gray-500 font-medium'}, ['Withholding']),
      ]),
      formItem('Invoice No.', Input({
        type: 'text',
        value: '',
        onChange: (e) => props.viewModel.updateCurrentOrderField('invoice_no', e.target.value),
        class: 'w-full'
      })),
      
    ])
  ])
}

function SearchSupplier(props) {
  // props.ensureLocalStateKey('supplierSearchQuery', '');
  const supplierSearchQuery = props.viewModel.getState('supplier-search-query') || '';
  props.ensureLocalStateKey('showSupplierDropdown', false);
  const showSupplierDropdown = props.getLocalState('showSupplierDropdown');

  const filteredSuppliers = props.viewModel.getState('supplier-list') || [];

  const handleSupplierSearch = (value) => {
    props.viewModel.updateSupplierSearch(value);
  }

  const handleSupplierSelect = (supplier) => {
    props.viewModel.selectSupplier(supplier);
    // props.setLocalState('supplierSearchQuery', supplier.name);
    props.viewModel.updateSupplierSearch(supplier.name);
    props.setLocalState('showSupplierDropdown', false);
  }

  return DropdownSearch({
    open: showSupplierDropdown,
    value: supplierSearchQuery,
    placeholder: 'Search suppliers...',
    onInput: handleSupplierSearch,
    onFocus: () => {
      props.viewModel.loadSuppliers('');
      props.setLocalState('showSupplierDropdown', true)
    },
    getOpenState: () => props.getLocalState('showSupplierDropdown'),
    setOpenState: () => props.setLocalState('showSupplierDropdown', false),
    class: 'w-full relative',
  }, filteredSuppliers.map(supplier => {
    // Helper to capitalize customer type
    const capitalizeCustomerType = (type) => {
      if (!type) return 'Supplier';
      return type.charAt(0).toUpperCase() + type.slice(1);
    };

    // Get badge color based on customer type
    const getCustomerTypeBadgeColor = (type) => {
      if (type === 'supplier') return 'info';
      if (type === 'retailer') return 'success';
      if (type === 'both') return 'warning';
      return 'default';
    };

    const partnerChildren = [
      Row({ class: 'flex items-center justify-between gap-2' }, [
        Row({ class: 'font-semibold text-gray-900' }, supplier.name || 'Unknown'),
        Badge({
          label: capitalizeCustomerType(supplier.customer_type),
          tone: getCustomerTypeBadgeColor(supplier.customer_type),
          class: 'text-xs px-2 py-0.5'
        })
      ]),
      Row({ class: 'flex items-center gap-2 text-xs text-gray-500' }, [
        ...(supplier.contact_person ? [
          Row({ class: 'flex items-center gap-1' }, [
            IonIcon({ name: 'person-outline', class: 'text-xs' }),
            supplier.contact_person
          ])
        ] : []),
        ...(supplier.contact_person ? [Row({}, '•')] : []),
        Row({}, supplier.phone || 'N/A')
      ])
    ];

    return DropdownSearchItem({
      onSelect: () => handleSupplierSelect(supplier),
      key: supplier.id,
      class: 'py-3'
    }, [
      Row({ class: 'flex flex-col gap-1' }, partnerChildren)
    ]);
  }));
}
