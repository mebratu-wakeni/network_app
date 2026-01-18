import { Button, Spinner } from "../../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../../utils/Card";
import { IconButton, IonIcon } from "../../utils/Icon";
import { Input } from "../../utils/Input";
import Label from "../../utils/Label";
import { SelectFluid, SelectOptions } from "../../utils/Select";

const { Row, StatefulRow } = Liteframe;

// --- The Modal Content Component (Child) ---
const ModalContent = (viewModel, delegator, handleClose) => {

  const render = (props) => {
    // Local state only for UI concerns (inline forms visibility)
    props.ensureLocalStateKey('show-new-category-form', false);
    props.ensureLocalStateKey('show-new-unit-form', false);
    props.ensureLocalStateKey('new-category-name', '');
    props.ensureLocalStateKey('new-category-description', '');
    props.ensureLocalStateKey('new-unit-name', '');
    props.ensureLocalStateKey('new-unit-abbreviation', '');
    props.ensureLocalStateKey('new-unit-description', '');
    
    // Get form data from viewModel state
    const loading = props.viewModel.getState('loading');
    const productForm = props.viewModel.getState('product-form') || {};
    
    const showNewCategoryForm = props.getLocalState('show-new-category-form');
    const newCategoryName = props.getLocalState('new-category-name');
    const newCategoryDescription = props.getLocalState('new-category-description');
    const showNewUnitForm = props.getLocalState('show-new-unit-form');
    const newUnitName = props.getLocalState('new-unit-name');
    const newUnitAbbreviation = props.getLocalState('new-unit-abbreviation');
    const newUnitDescription = props.getLocalState('new-unit-description');

    const handleSaveNewCategory = () => {
      // Handle saving new category
      console.log('Saving new category:', {
        name: newCategoryName,
        description: newCategoryDescription
      });
      // Add to category options and select it
      props.viewModel.updateProductForm('category', newCategoryName);
      props.setLocalState('show-new-category-form', false);
      props.setLocalState('new-category-name', '');
      props.setLocalState('new-category-description', '');
    };

    const handleCancelNewCategory = () => {
      props.setLocalState('show-new-category-form', false);
      props.setLocalState('new-category-name', '');
      props.setLocalState('new-category-description', '');
    };

    const handleSaveNewUnit = () => {
      // Handle saving new unit
      console.log('Saving new unit:', {
        name: newUnitName,
        abbreviation: newUnitAbbreviation,
        description: newUnitDescription
      });
      // Add to unit options and select it
      props.viewModel.updateProductForm('unit', newUnitName);
      props.setLocalState('show-new-unit-form', false);
      props.setLocalState('new-unit-name', '');
      props.setLocalState('new-unit-abbreviation', '');
      props.setLocalState('new-unit-description', '');
    };

    const handleCancelNewUnit = () => {
      props.setLocalState('show-new-unit-form', false);
      props.setLocalState('new-unit-name', '');
      props.setLocalState('new-unit-abbreviation', '');
      props.setLocalState('new-unit-description', '');
    };

    const handleSave = async () => {
      try {
        await props.viewModel.createProduct(productForm);
        props.viewModel.resetProductForm();
        handleClose();
      } catch (error) {
        // Error is handled by viewModel and displayed via error state
        console.error('Error creating product:', error);
      }
    };

    const canSave = productForm.name && productForm.name.trim() !== '' && 
                    productForm.category && productForm.unit;

    return Card({
      class: 'bg-white rounded-lg shadow-2xl w-full max-w-lg transform transition-all max-h-[90vh] overflow-hidden flex flex-col'
    }, [
      CardHeader({ class: 'flex justify-between items-center px-6 h-12 border-b border-gray-200' }, [
        Row({ class: 'flex items-center gap-3' }, [
          IonIcon({ name: 'cube-outline', class: 'text-xl text-indigo-600' }),
          Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Add New Product'),
        ]),
        IconButton({ onClick: handleClose, size: 'medium', delegator }, [
          IonIcon({ name: 'close-outline', class: 'text-xl' })
        ])
      ]),

      CardBody({ class: 'flex-1 overflow-y-auto p-6' }, [
        Row({ class: 'flex flex-col gap-6' }, [
          // Product Name
          Row({ class: 'flex flex-col gap-2' }, [
            Label({ name: 'product-name', text: 'Product Name *', class: 'text-sm font-medium text-gray-700' }),
            Input({ 
              name: 'product-name', 
              value: productForm.name || '', 
              placeholder: 'Enter product name', 
              class: 'w-full', 
              onChange: (e) => props.viewModel.updateProductForm('name', e.target.value.trim()), 
              delegator
            })
          ]),

          // Description
          Row({ class: 'flex flex-col gap-2' }, [
            Label({ name: 'product-description', text: 'Description', class: 'text-sm font-medium text-gray-700' }),
            Input({ 
              name: 'product-description', 
              value: productForm.description || '', 
              placeholder: 'Enter product description', 
              class: 'w-full', 
              onChange: (e) => props.viewModel.updateProductForm('description', e.target.value.trim()), 
              delegator
            })
          ]),

          // Category
          Row({ class: 'flex flex-col gap-2' }, [
            Label({ name: 'product-category', text: 'Category *', class: 'text-sm font-medium text-gray-700' }),
            !showNewCategoryForm && Row({ class: 'flex items-center gap-2' }, [
              SelectFluid({ 
                name: 'product-category', 
                containerClass: 'flex-1', 
                value: productForm.category || '',
                onChange: (e) => props.viewModel.updateProductForm('category', e.target.value),
                delegator
              }, SelectOptions({ 
                options: ['Regent', 'Supplies'], 
                selectedOption: productForm.category || ''
              })),
              Button({ 
                variant: 'outline', 
                class: 'w-20 text-nowrap text-xs',
                onClick: () => props.setLocalState('show-new-category-form', true),
                delegator
              }, '+ New')
            ]),
            showNewCategoryForm && NewCategoryForm({
              name: newCategoryName,
              description: newCategoryDescription,
              onNameChange: (e) => props.setLocalState('new-category-name', e.target.value),
              onDescriptionChange: (e) => props.setLocalState('new-category-description', e.target.value),
              onSave: handleSaveNewCategory,
              onCancel: handleCancelNewCategory,
              delegator
            })
          ]),

          // Unit
          Row({ class: 'flex flex-col gap-2' }, [
            Label({ name: 'product-unit', text: 'Unit *', class: 'text-sm font-medium text-gray-700' }),
            !showNewUnitForm && Row({ class: 'flex items-center gap-2' }, [
              SelectFluid({ 
                name: 'product-unit', 
                containerClass: 'flex-1', 
                value: productForm.unit || '',
                onChange: (e) => props.viewModel.updateProductForm('unit', e.target.value),
                delegator
              }, SelectOptions({ 
                options: ['Bottle', 'PK', 'Kit', 'Box', 'Unit'], 
                selectedOption: productForm.unit || ''
              })),
              Button({ 
                variant: 'outline', 
                class: 'w-20 text-nowrap text-xs',
                onClick: () => props.setLocalState('show-new-unit-form', true),
                delegator
              }, '+ New')
            ]),
            showNewUnitForm && NewUnitForm({
              name: newUnitName,
              abbreviation: newUnitAbbreviation,
              description: newUnitDescription,
              onNameChange: (e) => props.setLocalState('new-unit-name', e.target.value),
              onAbbreviationChange: (e) => props.setLocalState('new-unit-abbreviation', e.target.value),
              onDescriptionChange: (e) => props.setLocalState('new-unit-description', e.target.value),
              onSave: handleSaveNewUnit,
              onCancel: handleCancelNewUnit,
              delegator
            })
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
        }, loading ? [Spinner(), ' Creating...'] : 'Create Product'),
      ])
    ]);
  }
  
  return StatefulRow({ class: 'fixed inset-0 bg-gray-800/0 flex items-center justify-center', viewModel }, render) 
};

// New Category Inline Form (for modal)
function NewCategoryForm({ name, description, onNameChange, onDescriptionChange, onSave, onCancel, delegator }) {
  return Row({ class: 'bg-blue-50 border border-blue-200 rounded-lg p-4' }, [
    Row({ class: 'text-xs font-semibold text-blue-800 mb-3' }, 'Add New Category'),
    Row({ class: 'flex flex-col gap-3' }, [
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Category Name:'),
        Input({
          value: name,
          onChange: onNameChange,
          name: 'new-category-name',
          placeholder: 'Enter category name',
          class: 'w-full',
          delegator
        })
      ]),
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Description:'),
        Input({
          value: description,
          onChange: onDescriptionChange,
          name: 'new-category-description',
          placeholder: 'Enter category description',
          class: 'w-full',
          delegator
        })
      ]),
      Row({ class: 'flex items-center gap-2 justify-end mt-2' }, [
        Button({ 
          variant: 'secondary', 
          class: 'text-xs px-3 py-1',
          onClick: onCancel,
          delegator
        }, 'Cancel'),
        Button({ 
          variant: 'primary', 
          class: 'text-xs px-3 py-1',
          onClick: onSave,
          disabled: !name || name.trim() === '',
          delegator
        }, 'Save Category')
      ])
    ])
  ]);
}

// New Unit Inline Form (for modal)
function NewUnitForm({ name, abbreviation, description, onNameChange, onAbbreviationChange, onDescriptionChange, onSave, onCancel, delegator }) {
  return Row({ class: 'bg-blue-50 border border-blue-200 rounded-lg p-4' }, [
    Row({ class: 'text-xs font-semibold text-blue-800 mb-3' }, 'Add New Unit'),
    Row({ class: 'flex flex-col gap-3' }, [
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Unit Name:'),
        Input({
          value: name,
          onChange: onNameChange,
          name: 'new-unit-name',
          placeholder: 'Enter unit name (e.g., Bottle)',
          class: 'w-full',
          delegator
        })
      ]),
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Abbreviation:'),
        Input({
          value: abbreviation,
          onChange: onAbbreviationChange,
          name: 'new-unit-abbreviation',
          placeholder: 'Enter abbreviation (e.g., BTL)',
          class: 'w-full',
          delegator
        })
      ]),
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Description:'),
        Input({
          value: description,
          onChange: onDescriptionChange,
          name: 'new-unit-description',
          placeholder: 'Enter unit description',
          class: 'w-full',
          delegator
        })
      ]),
      Row({ class: 'flex items-center gap-2 justify-end mt-2' }, [
        Button({ 
          variant: 'secondary', 
          class: 'text-xs px-3 py-1',
          onClick: onCancel,
          delegator
        }, 'Cancel'),
        Button({ 
          variant: 'primary', 
          class: 'text-xs px-3 py-1',
          onClick: onSave,
          disabled: !name || name.trim() === '' || !abbreviation || abbreviation.trim() === '',
          delegator
        }, 'Save Unit')
      ])
    ])
  ]);
}

export default ModalContent;
