# Component Usage Guide: Select & DropdownSearch

This guide documents the **correct usage patterns** for `Select` and `DropdownSearch` components to avoid common pitfalls.

---

## 📋 Select Components

### Component Structure

- **Wrapper Components**: `SelectFluid`, `SelectRelative`, `SelectCompact`
- **Child Component**: `SelectOptions`

### ✅ Correct Pattern

**Props go to the WRAPPER, options go to SelectOptions:**

```javascript
SelectFluid({ 
  name: 'field-name',               // HTML name attribute (on wrapper)
  value: currentValue,              // Current selected value (on wrapper)
  onChange: (e) => handleChange(e.target.value),  // Handler (on wrapper)
  containerClass: 'flex-1',         // Optional styling (on wrapper)
  delegator: props.delegator        // Required in modals/drawers (on wrapper)
}, SelectOptions({ 
  options: ['Option1', 'Option2'],  // Array of option strings (REQUIRED)
  selectedOption: currentValue      // Currently selected option (REQUIRED)
  // Note: 'name' is NOT needed in SelectOptions (it's only on wrapper)
}))
```

### ❌ Common Mistakes

**❌ WRONG - Passing control props to SelectOptions:**
```javascript
SelectFluid({}, SelectOptions({ 
  name: 'field-name',
  onChange: (e) => handleChange(e.target.value),  // ❌ WRONG!
  value: currentValue,                             // ❌ WRONG!
  options: ['Option1', 'Option2'],
  selectedOption: currentValue
}))
```

**❌ WRONG - Missing delegator in modals:**
```javascript
SelectFluid({ 
  name: 'field-name',
  value: currentValue,
  onChange: handleChange
  // ❌ Missing delegator - events won't work in modals!
}, SelectOptions({ ... }))
```

### Real-World Examples

**Example 1: In a form (Products.js)**
```javascript
SelectFluid({ 
  name: 'product-category', 
  containerClass: 'flex-1', 
  value: productCategory,
  onChange: (e) => props.viewModel.updateProductDetailsForm('category', e.target.value),
  delegator: props.delegator  // Required!
}, SelectOptions({ 
  options: ['Regent', 'Supplies'], 
  selectedOption: productCategory
}))
```

**Example 2: Pagination (UsersUI.js)**
```javascript
SelectRelative({
  name: 'limit', 
  onChange: (e) => props.viewModel.setLimit(parseInt(e.target.value)), 
  value: tableConfig.limit 
}, SelectOptions({
  options: ['10', '25', '50', '100'], 
  selectedOption: tableConfig.limit + '' 
}))
```

---

## 🔍 DropdownSearch Component

### Component Structure

- **Wrapper**: `DropdownSearch`
- **Items**: `DropdownSearchItem` (as children)

### ✅ Correct Pattern

**When using Local State (BorrowFromModal pattern):**

```javascript
DropdownSearch({
  open: showDropdown,                                    // Current open state (boolean)
  value: searchQuery || (selectedItem ? selectedItem.name : ''),  // Display value
  placeholder: selectedItem ? selectedItem.name : 'Search...',
  onInput: (query) => {
    props.setLocalState('search-query', query);
    props.setLocalState('show-dropdown', true);
  },
  onFocus: () => props.setLocalState('show-dropdown', true),
  getOpenState: () => props.getLocalState('show-dropdown'),      // Getter function
  setOpenState: () => props.setLocalState('show-dropdown', false), // Setter function
  class: 'w-full relative',
  delegator: props.delegator  // Required in modals!
}, filteredItems.map(item => 
  DropdownSearchItem({
    onSelect: () => {
      handleSelect(item);
      props.setLocalState('show-dropdown', false);
      props.setLocalState('search-query', '');
    },
    key: item.id,
    delegator: props.delegator  // Required!
  }, `${item.name} (${item.code || 'N/A'})`)
))
```

**When using ViewModel State (AdjustStockDrawer pattern):**

```javascript
DropdownSearch({
  open: showDropdown,  // Snapshot value from ViewModel state
  value: searchQuery || (selectedItem ? selectedItem.name : ''),
  placeholder: selectedItem ? selectedItem.name : 'Search...',
  onInput: (query) => {
    props.viewModel.updateForm('searchQuery', query);
    props.viewModel.updateForm('showDropdown', true);
    // ⚠️ IMPORTANT: Must trigger re-render (see State Management below)
  },
  onFocus: () => {
    props.viewModel.updateForm('showDropdown', true);
    // ⚠️ IMPORTANT: Must trigger re-render (see State Management below)
  },
  getOpenState: () => {
    // ⚠️ CRITICAL: Must read from ViewModel dynamically, not use snapshot!
    const form = props.viewModel.getState('form-name');
    return form ? (form.showDropdown || false) : false;
  },
  setOpenState: () => props.viewModel.updateForm('showDropdown', false),
  class: 'w-full relative',
  delegator: props.delegator
}, filteredItems.map(item => 
  DropdownSearchItem({
    onSelect: () => {
      props.viewModel.updateForm('itemId', item.id);
      props.viewModel.updateForm('showDropdown', false);
      props.viewModel.updateForm('searchQuery', '');
    },
    key: item.id,
    delegator: props.delegator
  }, `${item.name} (${item.code || 'N/A'})`)
))
```

### ❌ Common Mistakes

**❌ WRONG - getOpenState returning snapshot instead of reading dynamically:**
```javascript
const showDropdown = formState.showDropdown;  // Snapshot at render time

DropdownSearch({
  getOpenState: () => showDropdown,  // ❌ WRONG! Uses stale snapshot
  // ...
})
```

**✅ CORRECT - getOpenState reads from ViewModel:**
```javascript
const showDropdown = formState.showDropdown;  // Snapshot for `open` prop

DropdownSearch({
  getOpenState: () => {
    const form = props.viewModel.getState('form-name');
    return form ? (form.showDropdown || false) : false;  // ✅ Reads dynamically
  },
  // ...
})
```

**❌ WRONG - Missing delegator:**
```javascript
DropdownSearch({
  // ... props
  // ❌ Missing delegator - events won't work in modals/drawers!
}, items.map(item => 
  DropdownSearchItem({
    // ❌ Missing delegator - clicks won't work!
  }, item.name)
))
```

**❌ WRONG - Conditional children array:**
```javascript
DropdownSearch({
  // ...
}, filteredItems.length > 0 ? filteredItems.map(...) : [])  // ❌ Can cause issues
```

**✅ CORRECT - Always pass children:**
```javascript
DropdownSearch({
  // ...
}, filteredItems.map(...))  // ✅ Always pass mapped array
```

### State Management with ViewModel

**⚠️ CRITICAL:** When using ViewModel state, you MUST trigger re-renders for dropdown visibility changes.

**In ViewModel (InventoryVM.js pattern):**

```javascript
updateForm(key, value) {
  const form = this.getState('form-name');
  const needsRerender = 
    key === 'showDropdown' ||      // Dropdown visibility
    key === 'adjustmentType' ||    // Filtered options change
    key === 'reason';               // Filtered options change
  
  if (needsRerender) {
    this.updateState('loading', true);  // Trigger re-render
  }
  
  this.updateState('form-name', {
    ...form,
    [key]: value
  });
  
  if (needsRerender) {
    setTimeout(() => {
      this.updateState('loading', false);  // Complete re-render
    }, 0);
  }
}
```

**Why?** Components wrapped in `StatefulRow` only re-render when watched `stateKeys` change. If `showDropdown` changes but `loading` doesn't, the component won't re-render, and the dropdown won't open/close.

---

## 🎯 Quick Reference Checklist

### Select Components
- [ ] Control props (`name`, `value`, `onChange`, `containerClass`, `delegator`) are on the **wrapper** (SelectFluid/SelectRelative)
- [ ] Options props (`options`, `selectedOption`) are on **SelectOptions** (NOT `name`)
- [ ] `delegator` is included when used in modals/drawers
- [ ] `name` is only on wrapper (not needed in SelectOptions, but harmless if included)

### DropdownSearch Components
- [ ] `delegator` is passed to both `DropdownSearch` and all `DropdownSearchItem`s
- [ ] `getOpenState` is a **function** that reads current state dynamically (not a snapshot)
- [ ] `setOpenState` is a **function** that updates state
- [ ] Children are always passed (even if empty array)
- [ ] When using ViewModel, dropdown visibility changes trigger `loading` updates for re-renders
- [ ] `open` prop matches what `getOpenState()` would return

---

## 📚 Reference Implementations

- **Select with Local State**: See `BorrowFromModal.js` (product/partner selects)
- **Select with ViewModel**: See `Products.js` (category/unit selects in drawer)
- **DropdownSearch with Local State**: See `BorrowFromModal.js` (product/partner search)
- **DropdownSearch with ViewModel**: See `Stock.js` (AdjustStockDrawer - partner search)

---

## 🐛 Debugging Tips

**Dropdown not opening on focus:**
1. Check if `getOpenState` reads state dynamically (not snapshot)
2. Check if ViewModel updates `loading` when `showDropdown` changes
3. Check if `delegator` is passed to `DropdownSearch` and `Input` inside it

**Select onChange not working:**
1. Check if `onChange` is on wrapper (not SelectOptions)
2. Check if `delegator` is passed when used in modals
3. Check if `name` is only on wrapper (not in SelectOptions)

**Items not displaying in DropdownSearch:**
1. Check if children array is always passed (not conditionally)
2. Check if `filteredItems` is correctly computed
3. Check if `open` prop is `true` when items should be visible
