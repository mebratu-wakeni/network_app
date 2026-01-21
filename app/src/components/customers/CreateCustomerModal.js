import { Button, Spinner } from "../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../utils/Card";
import { IconButton, IonIcon } from "../utils/Icon";
import { Input } from "../utils/Input";
import Label from "../utils/Label";
import { SelectFluid, SelectOptions } from "../utils/Select";
import { permissionChecker } from "../utils/PermissionChecker";

const { Row, StatefulRow } = Liteframe;

// --- The Modal Content Component (Child) ---
const ModalContent = (viewModel, delegator, handleClose) => {

  const render = (props) => {
    // Get form data from viewModel state
    const loading = props.viewModel.getState('loading');
    const customerForm = props.viewModel.getState('customer-form') || {};
    
    const handleSave = async () => {
      const hasPermission = await permissionChecker.checkPermission('CanAddCustomer', {
        actionName: 'create customers'
      });
      if (!hasPermission) {
        return;
      }

      try {
        await props.viewModel.createCustomer(customerForm);
        props.viewModel.resetCustomerForm();
        handleClose();
      } catch (error) {
        // Error is handled by viewModel and displayed via error state
        console.error('Error creating customer:', error);
      }
    };

    // Validation: check if required fields are filled
    const hasName = customerForm.name && customerForm.name.trim() !== '';
    const hasCustomerType = customerForm.customer_type && customerForm.customer_type.trim() !== '';
    const canSave = hasName && hasCustomerType;

    return Card({
      class: 'bg-white rounded-lg shadow-2xl w-full max-w-lg transform transition-all max-h-[90vh] overflow-hidden flex flex-col'
    }, [
      CardHeader({ class: 'flex justify-between items-center px-6 h-12 border-b border-gray-200' }, [
        Row({ class: 'flex items-center gap-3' }, [
          IonIcon({ name: 'person-outline', class: 'text-xl text-indigo-600' }),
          Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Add New Customer'),
        ]),
        IconButton({ onClick: handleClose, size: 'medium', delegator }, [
          IonIcon({ name: 'close-outline', class: 'text-xl' })
        ])
      ]),

      CardBody({ class: 'flex-1 overflow-y-auto p-6' }, [
        Row({ class: 'flex flex-col gap-6' }, [
          // Customer Name (Required)
          Row({ class: 'flex flex-col gap-2' }, [
            Label({ name: 'customer-name', text: 'Customer Name *', class: 'text-sm font-medium text-gray-700' }),
            Input({ 
              name: 'customer-name', 
              value: customerForm.name || '', 
              placeholder: 'Enter customer name', 
              class: 'w-full', 
              onChange: (e) => props.viewModel.updateCustomerForm('name', e.target.value.trim()), 
              delegator
            })
          ]),

          // Contact Person (Optional)
          Row({ class: 'flex flex-col gap-2' }, [
            Label({ name: 'contact-person', text: 'Contact Person', class: 'text-sm font-medium text-gray-700' }),
            Input({ 
              name: 'contact-person', 
              value: customerForm.contact_person || '', 
              placeholder: 'Enter contact person name (optional)', 
              class: 'w-full', 
              onChange: (e) => props.viewModel.updateCustomerForm('contact_person', e.target.value.trim()), 
              delegator
            })
          ]),

          // Customer Type (Required)
          Row({ class: 'flex flex-col gap-2' }, [
            Label({ name: 'customer-type', text: 'Customer Type *', class: 'text-sm font-medium text-gray-700' }),
            SelectFluid({ 
              name: 'customer-type', 
              value: customerForm.customer_type || '',
              onChange: (e) => props.viewModel.updateCustomerForm('customer_type', e.target.value),
              delegator
            }, [
              Row({ tagType: 'option', attributes: { value: '', selected: !customerForm.customer_type } }, 'Select Customer Type'),
              Row({ tagType: 'option', attributes: { value: 'supplier', selected: customerForm.customer_type === 'supplier' } }, 'Supplier'),
              Row({ tagType: 'option', attributes: { value: 'retailer', selected: customerForm.customer_type === 'retailer' } }, 'Retailer'),
              Row({ tagType: 'option', attributes: { value: 'both', selected: customerForm.customer_type === 'both' } }, 'Both'),
              Row({ tagType: 'option', attributes: { value: 'other', selected: customerForm.customer_type === 'other' } }, 'Other')
            ])
          ])
        ])
      ]),

      CardFooter({ class: 'flex justify-end gap-3 px-6 py-4 border-t border-gray-200' }, [
        Button({ variant: 'secondary', onClick: handleClose, delegator }, 'Cancel'),
        Button({ 
          variant: 'primary', 
          delegator, 
          onClick: handleSave, 
          disabled: loading || !canSave 
        }, loading ? [Spinner(), ' Creating...'] : 'Create Customer'),
      ])
    ]);
  }
  
  return StatefulRow({ 
    class: 'fixed inset-0 bg-gray-800/0 flex items-center justify-center', 
    viewModel, 
    stateKeys: ['loading', 'customer-form'] 
  }, render) 
};

export default ModalContent;
