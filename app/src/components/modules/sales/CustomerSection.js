import { CardHeader, CardBody } from '../../utils/Card';
import { Input } from '../../utils/Input';
import { IonIcon } from '../../utils/Icon';
import { DropdownSearch, DropdownSearchItem } from '../../utils/DropdownSearch';
import Badge from '../../utils/Badge';
import { formItem } from './ProductSection';

const { Row } = Liteframe;

function capitalizeCustomerType(type) {
  if (!type) return 'Customer';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getCustomerTypeBadgeColor(type) {
  if (type === 'supplier') return 'info';
  if (type === 'retailer') return 'success';
  if (type === 'both') return 'warning';
  return 'default';
}

export function CustomerSection(props) {
  const currentSale = props.viewModel.getState('current-sale') || {};
  const isWithholding = currentSale.is_withholding;
  // Walk-in customers cannot have withholding
  const isWalkIn = props.viewModel.isWalkInSale(currentSale);

  return Row({ class: 'flex-5/9 flex flex-col min-h-0 overflow-hidden border border-gray-200 rounded-lg' }, [
    CardHeader({
      class: 'px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0'
    }, [
      Row({ class: 'flex items-center gap-2' }, [
        IonIcon({ name: 'person-outline', class: 'text-lg' }),
        'Customer',
      ]),
    ]),
    CardBody({ class: 'p-4 flex flex-col gap-4 flex-1 min-h-0 overflow-auto' }, [
      SearchCustomer(props),
      // Only show withholding checkbox if not walk-in
      !isWalkIn && Row({ class: 'flex gap-4 items-center mb-6', events: { click: () => props.viewModel.toggleWithholding() } }, [
        IonIcon({ name: `${isWithholding ? 'checkbox' : 'square-outline'}`, class: 'text-3xl select-none' }),
        Row({ tagType: 'label', class: 'text-sm text-gray-500 font-medium' }, 'Withholding'),
      ]),
      isWithholding && !isWalkIn && formItem('Withhold Ref.', Input({
        type: 'text',
        value: currentSale.withhold_ref || '',
        onChange: (e) => props.viewModel.updateCurrentSaleField('withhold_ref', e.target.value),
        placeholder: 'Optional — customer receipt ref. if confirming now',
        class: 'w-full',
      })),
      formItem('Invoice No.', Input({
        type: 'text',
        value: currentSale.invoice_no || '',
        onChange: (e) => props.viewModel.updateCurrentSaleField('invoice_no', e.target.value),
        class: 'w-full',
      })),
    ]),
  ]);
}

function SearchCustomer(props) {
  const currentSale = props.viewModel.getState('current-sale') || {};
  const customerSearchQuery = props.viewModel.getState('customer-search-query') || '';
  const customerDropdownLoading = props.viewModel.getState('customer-dropdown-loading') === true;
  props.ensureLocalStateKey('showCustomerDropdown', false);
  const showCustomerDropdown = props.getLocalState('showCustomerDropdown');
  const filteredCustomers = props.viewModel.getState('customer-list') || [];

  const displayValue = currentSale.customer_id == null || currentSale.customer_id === ''
    ? 'Walk-in'
    : (currentSale.customer?.name || currentSale.customer?.full_name || customerSearchQuery || 'Search customers...');

  const handleCustomerSearch = (value) => {
    props.viewModel.updateCustomerSearch(value);
  };

  const handleCustomerSelect = (customer) => {
    props.viewModel.selectCustomer(customer);
    props.viewModel.updateCustomerSearch(customer.name || customer.full_name || '');
    props.setLocalState('showCustomerDropdown', false);
  };

  const menuRows = []
  if (customerDropdownLoading) {
    menuRows.push(
      Row({ key: 'cust-dd-loading', class: 'px-3 py-2 text-xs text-gray-500 italic' }, 'Searching…')
    )
  } else if (filteredCustomers.length === 0) {
    menuRows.push(
      Row(
        { key: 'cust-dd-empty', class: 'px-3 py-2 text-xs text-gray-500' },
        customerSearchQuery.trim() ? 'No customers match your search.' : 'No customers found for sales (retailer / both / other). Add them in Customer Management.'
      )
    )
  } else {
    menuRows.push(
      ...filteredCustomers.map((customer) => {
        const isWalkInOption = (customer.name || customer.full_name || '').trim().toLowerCase() === 'walk-in';
        const contactPerson = customer.contact_person || '';
        const phone = customer.phone || customer.contact_number || '';
        const partnerChildren = [
          Row({ class: 'flex items-center justify-between gap-2' }, [
            Row({ class: 'font-semibold text-gray-900 flex items-center gap-2' }, [
              isWalkInOption ? IonIcon({ name: 'walk-outline', class: 'text-base text-gray-500' }) : null,
              customer.name || customer.full_name || 'Unknown'
            ].filter(Boolean)),
            isWalkInOption
              ? Badge({ label: 'Walk-in', tone: 'default', class: 'text-xs px-2 py-0.5' })
              : Badge({
                  label: capitalizeCustomerType(customer.customer_type),
                  tone: getCustomerTypeBadgeColor(customer.customer_type),
                  class: 'text-xs px-2 py-0.5',
                }),
          ]),
          !isWalkInOption && Row({ class: 'flex items-center gap-2 text-xs text-gray-500' }, [
            ...(contactPerson ? [
              Row({ class: 'flex items-center gap-1' }, [
                IonIcon({ name: 'person-outline', class: 'text-xs' }),
                contactPerson,
              ]),
            ] : []),
            ...(contactPerson && phone ? [Row({}, '•')] : []),
            ...(phone ? [Row({}, phone)] : []),
          ]),
        ].filter(Boolean);
        return DropdownSearchItem({
          onSelect: () => handleCustomerSelect(customer),
          key: customer.id,
          class: 'py-3',
        }, [
          Row({ class: 'flex flex-col gap-1' }, partnerChildren),
        ]);
      })
    )
  }

  return DropdownSearch({
    open: showCustomerDropdown,
    value: showCustomerDropdown ? customerSearchQuery : displayValue,
    placeholder: 'Search customers…',
    onInput: handleCustomerSearch,
    onFocus: () => {
      props.viewModel.loadCustomers(props.viewModel.getState('customer-search-query') || '');
      props.setLocalState('showCustomerDropdown', true);
    },
    getOpenState: () => props.getLocalState('showCustomerDropdown'),
    setOpenState: () => props.setLocalState('showCustomerDropdown', false),
    class: 'w-full relative',
  }, menuRows);
}
