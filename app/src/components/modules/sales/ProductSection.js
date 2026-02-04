import { CardHeader, CardBody } from '../../utils/Card';
import { Input } from '../../utils/Input';
import { Button } from '../../utils/Button';
import { IonIcon } from '../../utils/Icon';
import { DropdownSearch, DropdownSearchItem } from '../../utils/DropdownSearch';
import { permissionChecker } from '../../utils/PermissionChecker';

const { Row } = Liteframe;

const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatExpiry = (d) => (d ? String(d).slice(0, 10) : '—');

export function ProductSection(props) {
  const inventoryItems = props.viewModel.getState('product-list') || [];
  const loading = props.viewModel.getState('loading');
  const canEditSalesPrice = permissionChecker.hasRule('CanEditSalesPrice');
  props.ensureLocalStateKey('showProductDropdown', false);
  props.ensureLocalStateKey('productSearchQuery', '');
  const showProductDropdown = props.getLocalState('showProductDropdown');
  const productSearchQuery = props.getLocalState('productSearchQuery') || '';
  const searchQuery = props.viewModel.getState('product-search-query') || '';

  const handleQuantityChange = (e) => props.viewModel.updateProductForm('quantity', e.target.value);
  const handleUnitPriceChange = (e) => props.viewModel.updateProductForm('unit_price', e.target.value);

  const handleProductSearch = async (value) => {
    await props.viewModel.getProducts(value);
    props.setLocalState('productSearchQuery', value);
  };

  const handleProductSelect = (inv) => {
    props.viewModel.updateProductForm('product', inv);
    props.viewModel.updateProductForm('unit_price', inv.sellingPrice != null ? inv.sellingPrice : '');
    props.setLocalState('productSearchQuery', inv.name || '');
    props.setLocalState('showProductDropdown', false);
  };

  const handleAddToSale = () => {
    props.viewModel.addItemToSale();
    if (props.viewModel.getState('product-form').error) return;
    props.setLocalState('productSearchQuery', '');
  };

  const SearchProduct = () =>
    DropdownSearch({
      open: showProductDropdown,
      value: productSearchQuery,
      placeholder: 'Search inventory (name, code, batch)...',
      onInput: handleProductSearch,
      onFocus: async () => {
        await props.viewModel.getProducts(searchQuery);
        props.setLocalState('showProductDropdown', true);
      },
      getOpenState: () => props.getLocalState('showProductDropdown'),
      setOpenState: () => props.setLocalState('showProductDropdown', false),
      class: 'w-full relative',
    }, inventoryItems.map((inv) => {
      const name = inv.name || 'Unknown';
      const code = inv.productCode || inv.product_code || 'N/A';
      const price = inv.sellingPrice != null ? `Br ${financeFormat(inv.sellingPrice)}` : '—';
      const batch = inv.batchNumber || inv.batch_number || '—';
      const expiry = formatExpiry(inv.expiryDate || inv.expiry_date);
      const availableQty = inv.quantity != null ? Number(inv.quantity) : 0;
      const outOfStock = availableQty <= 0;
      return DropdownSearchItem({
        onSelect: () => !outOfStock && handleProductSelect(inv),
        key: inv.id,
        class: `py-2 ${outOfStock ? 'opacity-60 cursor-not-allowed' : ''}`,
      }, [
        Row({ class: 'flex flex-col gap-0.5' }, [
          Row({ class: 'flex items-center justify-between gap-2 text-sm' }, [
            Row({ class: 'font-semibold text-gray-900 truncate min-w-0' }, name),
            Row({ class: 'font-medium text-gray-700 shrink-0' }, price),
            Row({ class: 'shrink-0 inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600' }, code),
          ]),
          Row({ class: 'flex items-center justify-between gap-2 text-xs text-gray-500' }, [
            Row({}, `Batch: ${batch}`),
            Row({}, `Exp: ${expiry}`),
            Row({ class: outOfStock ? 'text-red-600 font-medium' : 'text-gray-600' }, outOfStock ? 'Out of stock' : `Available: ${availableQty}`),
          ]),
        ]),
      ]);
    }));

  return Row({ class: 'flex-4/9 flex flex-col min-h-0 overflow-hidden border border-gray-200 rounded-lg' }, [
    CardHeader({
      class: 'px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0'
    }, [
      Row({ class: 'flex items-center gap-2' }, [IonIcon({ name: 'cube-outline', class: 'text-lg' }), 'Products']),
    ]),
    CardBody({ class: 'p-4 flex flex-col flex-1 gap-4 min-h-0 overflow-auto' }, [
      Row({ class: 'w-full' }, [SearchProduct()]),
      Row({ class: 'flex gap-4' }, [
        formItem(
          'Quantity',
          Input({
            type: 'number',
            min: 1,
            max: (() => {
              const product = props.viewModel.getState('product-form').product;
              const qty = product?.quantity != null ? Number(product.quantity) : undefined;
              return qty != null && qty >= 0 ? qty : undefined;
            })(),
            value: props.viewModel.getState('product-form').quantity,
            onChange: handleQuantityChange,
            class: 'w-full',
            placeholder: (() => {
              const product = props.viewModel.getState('product-form').product;
              const qty = product?.quantity != null ? Number(product.quantity) : null;
              return qty != null && qty > 0 ? `Max ${qty}` : undefined;
            })(),
          })
        ),
        canEditSalesPrice
          ? formItem('Unit Price (Selling)', Input({
              type: 'number',
              value: props.viewModel.getState('product-form').unit_price,
              onChange: handleUnitPriceChange,
              class: 'w-full',
            }))
          : formItem('Unit Price (Selling)', Row({
              class: 'min-h-[2.25rem] px-3 py-1.5 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-md',
              title: 'View only. You need CanEditSalesPrice permission to change the selling price.',
            }, [
              props.viewModel.getState('product-form').unit_price != null && props.viewModel.getState('product-form').unit_price !== ''
                ? `Br ${financeFormat(props.viewModel.getState('product-form').unit_price)}`
                : '—',
            ])),
      ]),
      props.viewModel.getState('product-form').error && Row({ class: 'bg-red-50 border border-red-200 rounded-lg p-2 text-red-500 text-sm' }, [Row({ class: 'text-sm text-red-500' }, props.viewModel.getState('product-form').error)]),
      Button({ onClick: handleAddToSale, disabled: loading, class: 'w-full my-4 bg-indigo-600 text-white gap-2' }, [IonIcon({ name: 'add-circle-outline', class: 'text-white text-2xl' }), 'Add to Sale']),
    ]),
  ]);
}

export function formItem(label, input) {
  return Row({ class: 'flex-1/2 flex flex-col gap-2' }, [Row({ tagType: 'label', class: 'text-sm text-gray-500' }, [label]), input]);
}
