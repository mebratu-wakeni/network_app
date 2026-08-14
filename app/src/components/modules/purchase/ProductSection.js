import { CardHeader, CardBody } from '../../utils/Card';
import { Input } from '../../utils/Input';
import { Button } from '../../utils/Button';
import { IonIcon } from '../../utils/Icon';
import { DropdownSearch, DropdownSearchItem } from '../../utils/DropdownSearch';
import { permissionChecker } from '../../utils/PermissionChecker';
import ModalContent from '../inventory/CreateProductModal';
import { InventoryVM } from '../inventory/InventoryVM';
import Modal from '../../shared/Modal';

const { Row } = Liteframe;

export function ProductSection(props) {
  props.ensureLocalStateKey('productSearchQuery', '');
  const searchQuery = props.getLocalState('productSearchQuery') || '';
  // const filteredProducts = products.filter(product => product.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredProducts = props.viewModel.getState('product-list') || [];
  const productDropdownLoading = props.viewModel.getState('product-dropdown-loading') === true;

  props.ensureLocalStateKey('showProductDropdown', false);
  props.ensureLocalStateKey('productSearchQuery', '');
  props.ensureLocalStateKey('selectedProduct', null);

  const showProductDropdown = props.getLocalState('showProductDropdown');
  const productSearchQuery = props.getLocalState('productSearchQuery') || '';
  const loading = props.viewModel.getState('loading');

  const quantity = 100;
  const unitPrice = 100;
  const batchNumber = '1234567890';
  const expiryDate = '2027-01-01';

  const handleQuantityChange = (e) => {
    props.viewModel.updateProductForm('quantity', e.target.value);
  }
  const handleUnitPriceChange = (e) => {
    props.viewModel.updateProductForm('unit_price', e.target.value);
  }
  const handleBatchNumberChange = (e) => {
    props.viewModel.updateProductForm('batch_number', e.target.value);
  }
  const handleExpiryDateChange = (e) => {
    props.viewModel.updateProductForm('expiry_date', e.target.value);
  }

  // Local state for search input
  props.ensureLocalStateKey('productSearchInput', '');
  
  const searchInput = props.getLocalState('productSearchInput') || searchQuery;

  const handleProductSearch = (value) => {
    props.viewModel.updatePurchaseProductDropdownSearch(value);
    props.setLocalState('productSearchQuery', value);
  }

  const handleProductSelect = (product) => {
    props.viewModel.updateProductForm('product', product);
    props.setLocalState('productSearchQuery', product.name);
    props.setLocalState('showProductDropdown', false);
  }

  const handleAddToOrder = () => {
    props.viewModel.addItemToOrder();

    if(props.viewModel.getState('product-form').error) {
      return;
    }

    props.setLocalState('productSearchQuery', '');
  }

  const handleAddProduct = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanAddProduct', {
      actionName: 'add products'
    });
    if (hasPermission) {
      openAddProductModal(props);
    }
  }

  // console.log('productSearchQuery', productSearchQuery);

  const SearchProduct = () => {
    const menuRows = [];
    if (productDropdownLoading) {
      menuRows.push(Row({ key: 'pur-prod-dd-loading', class: 'px-3 py-2 text-xs text-gray-500 italic' }, 'Searching…'));
    } else if (filteredProducts.length === 0) {
      menuRows.push(
        Row(
          { key: 'pur-prod-dd-empty', class: 'px-3 py-2 text-xs text-gray-500' },
          productSearchQuery.trim() ? 'No products match your search.' : 'Type to search products by name or code.'
        )
      );
    } else {
      menuRows.push(
        ...filteredProducts.map((product) => {
          const productHeaderChildren = [Row({ class: 'font-semibold text-gray-900' }, product.name || 'Unknown Product')];
          if (product.category) {
            productHeaderChildren.push(
              Row({ class: 'text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded' }, product.category)
            );
          }
          const productCodeChildren = [Row({}, `Code: ${product.productCode || product.product_code || 'N/A'}`)];
          if (product.unit) {
            productCodeChildren.push(Row({}, `• ${product.unit}`));
          }
          const productChildren = [
            Row({ class: 'flex items-center justify-between gap-2' }, productHeaderChildren),
            Row({ class: 'flex items-center gap-2 text-xs text-gray-500' }, productCodeChildren),
          ];
          return DropdownSearchItem(
            {
              onSelect: () => handleProductSelect(product),
              key: product.id,
              class: 'py-3',
            },
            [Row({ class: 'flex flex-col gap-1' }, productChildren)]
          );
        })
      );
    }
    return DropdownSearch({
      open: showProductDropdown,
      value: productSearchQuery,
      placeholder: 'Search product...',
      onInput: handleProductSearch,
      onFocus: () => {
        props.viewModel.loadPurchaseProductsForDropdown(productSearchQuery);
        props.setLocalState('showProductDropdown', true);
      },
      getOpenState: () => props.getLocalState('showProductDropdown'),
      setOpenState: () => props.setLocalState('showProductDropdown', false),
      class: 'w-full relative',
    }, menuRows);
  }

  return Row({ class: 'flex-5/9 flex flex-col min-h-0 overflow-hidden border border-gray-200 rounded-lg' }, [
    CardHeader({ 
      class: 'px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0' 
    }, [
      Row({ class: 'flex items-center gap-2' }, [
        IonIcon({ name: 'cube-outline', class: 'text-lg' }),
        'Products'
      ])
    ]),
    CardBody({ class: 'p-4 flex flex-col flex-1 gap-4 min-h-0 overflow-auto' }, [
      Row({ class: 'w-full flex items-center justify-between gap-3'}, [
        SearchProduct(),
        Button({ variant: 'secondary', onClick: handleAddProduct }, [
          IonIcon({ name: 'add-circle-outline', class: 'text-2xl' }),
        ])
      ]), 
      Row({ class: 'flex gap-4'}, [
        formItem('Quantity', Input({
          type: 'number',
          value: props.viewModel.getState('product-form').quantity,
          onChange: handleQuantityChange,
          class: 'w-full'
        })),
        formItem('Unit Price', Input({
          type: 'number',
          value: props.viewModel.getState('product-form').unit_price,
          onChange: handleUnitPriceChange,
          class: 'w-full'
        })),
      ]),
      Row({ class: 'flex gap-4' }, [
        formItem('Batch Number', Input({
          type: 'text',
          value: props.viewModel.getState('product-form').batch_number,
          onChange: handleBatchNumberChange,
          class: 'w-full'
        })),
        formItem('Expiry Date', Input({
          type: 'date',
          value: props.viewModel.getState('product-form').expiry_date,
          onChange: handleExpiryDateChange,
          class: 'w-full'
        })),
      ]),
      props.viewModel.getState('product-form').error && Row({ class: 'bg-red-50 border border-red-200 rounded-lg p-2 text-red-500 text-sm' }, [
        Row({ class: 'text-sm text-red-500' }, props.viewModel.getState('product-form').error)
      ]),
      Button({
        onClick: handleAddToOrder,
        disabled: loading,
        class: 'w-full my-4 bg-indigo-600 text-white gap-2'
      }, [
        IonIcon({ name: 'add-circle-outline', class: 'text-white text-2xl',  }),
        'Add to Order'
      ])
    ]) 
  ])
}

export function formItem(label, input) {
  return Row({ class: 'flex-1/2 flex flex-col gap-2'}, [
    Row({tagType: 'label', class: 'text-sm text-gray-500'}, [label]),
    input
  ])
}

function openAddProductModal(props) {
  // Clear the form before opening the modal
  const viewModel = new InventoryVM();
  Modal({}, (delegator, closeHandler) => ModalContent(viewModel, delegator, closeHandler))
}
