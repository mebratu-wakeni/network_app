import { Button, Spinner } from "../../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../../utils/Card";
import { IconButton, IonIcon } from "../../utils/Icon";
import { Input } from "../../utils/Input";
import Label from "../../utils/Label";
import { DropdownSearch, DropdownSearchItem } from "../../utils/DropdownSearch";
import { showAlert } from "../../utils/ModalHelpers";
import { permissionChecker } from "../../utils/PermissionChecker";
import Badge from "../../utils/Badge";

const { Row, StatefulRow } = Liteframe;

// --- The Modal Content Component (Child) ---
const ModalContent = (viewModel, delegator, handleClose) => {

  const render = (props) => {
    // Create props object with viewModel from closure and add delegator/handleClose
  
    // Local state for UI concerns
    props.ensureLocalStateKey('show-product-dropdown', false);
    props.ensureLocalStateKey('product-search-query', '');
    props.ensureLocalStateKey('show-partner-dropdown', false);
    props.ensureLocalStateKey('partner-search-query', '');
    
    // Form state - will be managed here for this modal
    props.ensureLocalStateKey('selected-product', null);
    props.ensureLocalStateKey('selected-partner', null);
    props.ensureLocalStateKey('product-name', '');
    props.ensureLocalStateKey('description', '');
    props.ensureLocalStateKey('purchase-price', '');
    props.ensureLocalStateKey('quantity', '');
    props.ensureLocalStateKey('batch-number', '');
    props.ensureLocalStateKey('expiry-date', '');
    props.ensureLocalStateKey('submitting', false);
    
    const loading = props.viewModel.getState('loading');
    const productList = props.viewModel.getProductList() || [];
    const partnerList = props.viewModel.getPartnerList() || [];

    // Data should already be loaded before modal opens (in button click handler)
    // Just read from state - no loading calls here to avoid infinite re-rendering
    const showProductDropdown = props.getLocalState('show-product-dropdown');
    const productSearchQuery = props.getLocalState('product-search-query');
    const showPartnerDropdown = props.getLocalState('show-partner-dropdown');
    const partnerSearchQuery = props.getLocalState('partner-search-query');
    const selectedProduct = props.getLocalState('selected-product');
    const selectedPartner = props.getLocalState('selected-partner');
    const productName = props.getLocalState('product-name');
    const description = props.getLocalState('description');
    const purchasePrice = props.getLocalState('purchase-price');
    const quantity = props.getLocalState('quantity');
    const batchNumber = props.getLocalState('batch-number');
    const expiryDate = props.getLocalState('expiry-date');
    const submitting = props.getLocalState('submitting');
    
    // Filter products based on search query
    const filteredProducts = productList.filter(product => {
      if (!productSearchQuery) return true;
      const query = productSearchQuery.toLowerCase();
      return (product.name || '').toLowerCase().includes(query) ||
             (product.productCode || '').toLowerCase().includes(query);
    });
    
    // Filter partners based on search query
    // Partners are already filtered by customer_type=supplier from the API
    const filteredPartners = partnerList.filter(partner => {
      if (!partnerSearchQuery) return true;
      const query = partnerSearchQuery.toLowerCase();
      return (partner.name || '').toLowerCase().includes(query) ||
             (partner.code || '').toLowerCase().includes(query);
    });
    
    // Check if product and partner are selected
    const productSelected = selectedProduct !== null;
    const partnerSelected = selectedPartner !== null;
    
    const handleProductSearch = (query) => {
      props.setLocalState('product-search-query', query);
      props.setLocalState('show-product-dropdown', true);
    };
    
    const handleProductSelect = (product) => {
      props.setLocalState('selected-product', product);
      props.setLocalState('product-name', product.name || '');
      // Pre-fill description from product, but allow user to edit
      props.setLocalState('description', product.description || description || '');
      props.setLocalState('show-product-dropdown', false);
      props.setLocalState('product-search-query', '');
    };
    
    const handlePartnerSearch = (query) => {
      props.setLocalState('partner-search-query', query);
      props.setLocalState('show-partner-dropdown', true);
    };
    
    const handlePartnerSelect = (partner) => {
      props.setLocalState('selected-partner', partner);
      props.setLocalState('show-partner-dropdown', false);
      props.setLocalState('partner-search-query', partner.name);
    };
    
    const handleSubmit = async () => {
      const hasPermission = await permissionChecker.checkPermission('CanReceiveBorrowedFromStock', {
        actionName: 'borrow stock from partners'
      });
      if (!hasPermission) {
        return;
      }

      // Validate required fields
      if (!selectedPartner) {
        showAlert({
          title: 'Partner Required',
          message: 'Please select a partner/customer',
          variant: 'warning',
          icon: 'warning-outline'
        });
        return;
      }
      if (!selectedProduct) {
        showAlert({
          title: 'Product Required',
          message: 'Please select a product',
          variant: 'warning',
          icon: 'warning-outline'
        });
        return;
      }
      if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
        showAlert({
          title: 'Invalid Purchase Price',
          message: 'Purchase price is required and must be greater than 0',
          variant: 'warning',
          icon: 'warning-outline'
        });
        return;
      }
      if (!quantity || parseFloat(quantity) <= 0) {
        showAlert({
          title: 'Invalid Quantity',
          message: 'Quantity is required and must be greater than 0',
          variant: 'warning',
          icon: 'warning-outline'
        });
        return;
      }
      
      props.setLocalState('submitting', true);
      
      try {
        // Create inventory item with "borrowed-from" status
        const borrowFromData = {
          partnerId: Number(selectedPartner.id),
          productId: Number(selectedProduct.id),
          purchasePrice: parseFloat(purchasePrice),
          quantity: parseInt(quantity),
          batchNo: batchNumber || null,
          expiryDate: expiryDate || null,
          description: description || null,
          location: null // Can be added later if needed
        };
        
        // Call ViewModel method to create borrowed-from inventory item
        const result = await props.viewModel.createBorrowedFromStock(borrowFromData);
        
        if (!result || !result.success) {
          throw new Error(result?.error || 'Failed to create borrowed from stock');
        }
        
        // Close modal and reload stock
        handleClose();
        props.viewModel.loadStock();
      } catch (error) {
        console.error('[BorrowFromModal] Error creating borrowed from stock:', error);
        console.error('[BorrowFromModal] Error details:', {
          message: error.message,
          stack: error.stack
        });
        showAlert({
          title: 'Error',
          message: error.message || 'Failed to create borrowed from stock',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
      } finally {
        props.setLocalState('submitting', false);
      }
    };
    
    return Row({ class: 'flex flex-col h-full' }, [
      Card({ class: 'w-full max-w-[1400px] mx-auto my-8 flex flex-col max-h-[95vh] overflow-hidden' }, [
        CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200 flex-shrink-0' }, [
          Row({ class: 'flex items-center gap-3' }, [
            IonIcon({ name: 'arrow-down-outline', class: 'text-xl text-blue-600' }),
            Row({ class: 'text-lg font-semibold text-gray-800' }, 'Borrow From Partner')
          ]),
          IconButton({ onClick: handleClose, size: 'medium', delegator }, [
            IonIcon({ name: 'close-outline', class: 'text-xl' })
          ])
        ]),
        
        CardBody({ class: 'px-6 py-4 overflow-y-auto flex-1' }, [
          Row({ class: 'flex flex-col gap-6' }, [
            // Top row: Partner and Product Selection in one row
            Row({ class: 'grid grid-cols-2 gap-6' }, [
              // Partner Selection
              Row({ class: 'flex flex-col gap-2' }, [
                Label({ name: 'partner', text: 'Borrowing From (Partner/Customer) *', class: 'text-sm font-medium text-gray-700' }),
                DropdownSearch({
                  open: showPartnerDropdown,
                  value: partnerSearchQuery || (selectedPartner ? selectedPartner.name : ''),
                  placeholder: selectedPartner ? selectedPartner.name : 'Search or select partner/customer...',
                  onInput: handlePartnerSearch,
                  onFocus: () => props.setLocalState('show-partner-dropdown', true),
                  getOpenState: () => props.getLocalState('show-partner-dropdown'),
                  setOpenState: () => props.setLocalState('show-partner-dropdown', false),
                  class: 'w-full relative',
                  delegator,
                }, filteredPartners.map(partner => {
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
                      Row({ class: 'font-semibold text-gray-900' }, partner.name || 'Unknown'),
                      Badge({
                        label: capitalizeCustomerType(partner.customer_type),
                        tone: getCustomerTypeBadgeColor(partner.customer_type),
                        class: 'text-xs px-2 py-0.5'
                      })
                    ]),
                    Row({ class: 'flex items-center gap-2 text-xs text-gray-500' }, [
                      ...(partner.contact_person ? [
                        Row({ class: 'flex items-center gap-1' }, [
                          IonIcon({ name: 'person-outline', class: 'text-xs' }),
                          partner.contact_person
                        ])
                      ] : []),
                      ...(partner.contact_person ? [Row({}, '•')] : []),
                      Row({}, partner.code || 'N/A')
                    ])
                  ];
                  
                  return DropdownSearchItem({
                    onSelect: () => handlePartnerSelect(partner),
                    key: partner.id,
                    delegator,
                    class: 'py-3'
                  }, [
                    Row({ class: 'flex flex-col gap-1' }, partnerChildren)
                  ]);
                }))
              ]),
              
              // Product Selection
              Row({ class: 'flex flex-col gap-2' }, [
                Label({ name: 'product-name', text: 'Product Name *', class: 'text-sm font-medium text-gray-700' }),
                DropdownSearch({
                  open: showProductDropdown,
                  value: productSearchQuery || (selectedProduct ? selectedProduct.name : ''),
                  placeholder: selectedProduct ? selectedProduct.name : 'Search or select product...',
                  onInput: handleProductSearch,
                  onFocus: () => props.setLocalState('show-product-dropdown', true),
                  getOpenState: () => props.getLocalState('show-product-dropdown'),
                  setOpenState: () => props.setLocalState('show-product-dropdown', false),
                  class: 'w-full relative',
                  delegator,
                }, filteredProducts.map(product => {
                  const productHeaderChildren = [
                    Row({ class: 'font-semibold text-gray-900' }, product.name || 'Unknown Product')
                  ];
                  
                  if (product.category) {
                    productHeaderChildren.push(
                      Row({ class: 'text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded' }, product.category)
                    );
                  }
                  
                  const productCodeChildren = [
                    Row({}, `Code: ${product.productCode || product.product_code || 'N/A'}`)
                  ];
                  
                  if (product.unit) {
                    productCodeChildren.push(
                      Row({}, `• ${product.unit}`)
                    );
                  }
                  
                  const productChildren = [
                    Row({ class: 'flex items-center justify-between gap-2' }, productHeaderChildren),
                    Row({ class: 'flex items-center gap-2 text-xs text-gray-500' }, productCodeChildren)
                  ];
                  
                  return DropdownSearchItem({
                    onSelect: () => handleProductSelect(product),
                    key: product.id,
                    delegator,
                    class: 'py-3'
                  }, [
                    Row({ class: 'flex flex-col gap-1' }, productChildren)
                  ]);
                }))
              ])
            ]),
            
            // 2x2 Grid for other fields
            Row({ class: 'grid grid-cols-2 gap-6' }, [
              // Description
              Row({ class: 'flex flex-col gap-2' }, [
                Label({ name: 'description', text: 'Description', class: 'text-sm font-medium text-gray-700' }),
                Input({
                  type: 'text',
                  name: 'description',
                  value: description,
                  onChange: (e) => props.setLocalState('description', e.target.value),
                  placeholder: 'Product description (optional)',
                  class: 'w-full',
                  delegator
                })
              ]),
              
              // Purchase Price (Required)
              Row({ class: 'flex flex-col gap-2' }, [
                Label({ name: 'purchase-price', text: 'Purchase Price *', class: 'text-sm font-medium text-gray-700' }),
                Row({ class: 'flex items-center gap-2' }, [
                  Row({ class: 'text-gray-600' }, 'Br'),
                  Input({
                    type: 'number',
                    name: 'purchase-price',
                    value: purchasePrice,
                    onChange: (e) => props.setLocalState('purchase-price', e.target.value),
                    placeholder: '0.00',
                    step: '0.01',
                    min: '0',
                    required: true,
                    class: 'flex-1',
                    delegator
                  })
                ])
              ]),
              
              // Quantity (Required)
              Row({ class: 'flex flex-col gap-2' }, [
                Label({ name: 'quantity', text: 'Quantity *', class: 'text-sm font-medium text-gray-700' }),
                Input({
                  type: 'number',
                  name: 'quantity',
                  value: quantity,
                  onChange: (e) => props.setLocalState('quantity', e.target.value),
                  placeholder: '0',
                  min: '1',
                  required: true,
                  class: 'w-full',
                  delegator
                })
              ]),
              
              // Batch Number
              Row({ class: 'flex flex-col gap-2' }, [
                Label({ name: 'batch-number', text: 'Batch Number', class: 'text-sm font-medium text-gray-700' }),
                Input({
                  type: 'text',
                  name: 'batch-number',
                  value: batchNumber,
                  onChange: (e) => props.setLocalState('batch-number', e.target.value),
                  placeholder: 'Batch/lot number (optional)',
                  class: 'w-full',
                  delegator
                })
              ])
            ]),
            
            // Expiry Date (full width)
            Row({ class: 'flex flex-col gap-2' }, [
              Label({ name: 'expiry-date', text: 'Expiry Date', class: 'text-sm font-medium text-gray-700' }),
              Input({
                type: 'date',
                name: 'expiry-date',
                value: expiryDate,
                onChange: (e) => props.setLocalState('expiry-date', e.target.value),
                class: 'w-full',
                delegator
              })
            ])
          ])
        ]),
        
        CardFooter({ class: 'px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0' }, [
          Button({
            variant: 'outline',
            onClick: handleClose,
            delegator: delegator,
            disabled: submitting
          }, 'Cancel'),
          Button({
            variant: 'primary',
            onClick: handleSubmit,
            delegator: delegator,
            disabled: submitting || !partnerSelected || !productSelected || !purchasePrice || !quantity
          }, submitting ? [
            Spinner({ class: 'mr-2' }),
            'Submitting...'
          ] : 'Borrow From Partner')
        ])
      ])
    ]);
  };
  
  return StatefulRow({
    stateKeys: ['loading', 'product-list', 'partner-list', 'product-total-count'],
    viewModel
  }, render);
};

export default function BorrowFromModalContent(viewModel, delegator, handleClose) {
  return ModalContent(viewModel, delegator, handleClose);
}
