import { twMerge } from 'tailwind-merge';
import { registerDropdownOutsideClickByTag } from './OutsideClick';
import { Input } from './Input';

const { Row } = Liteframe;

/** Current open dropdown ref; updated by each DropdownSearch when it is open. One listener uses this. */
const currentOpenRef = { current: null };

// One document listener: if click is not inside [data-dropdown-search], close current open.
// ES modules run once per app, so this runs once; guard ensures we never attach twice (e.g. if bundler re-evaluates).
// Callback returns currentOpenRef.current at *call time* (we close over the ref object, not .current).
let dropdownOutsideClickRegistered = false;
if (!dropdownOutsideClickRegistered) {
  registerDropdownOutsideClickByTag(() => currentOpenRef.current);
  dropdownOutsideClickRegistered = true;
}

function DropdownSearch(props, children) {
  const {
    open = false,
    value = '',
    placeholder = 'Search..',
    onInput = () => { },
    onFocus = () => { },
    class: className = '',
    inputClass = '',
    menuClass = '',
    getOpenState = () => {},
    setOpenState = () => {},
    delegator,
  } = props;

  const rootClass = twMerge(
    'relative w-full',
    className
  );

  const inputBaseClass = twMerge(
    `
      w-full rounded-md bg-gray-100 px-3 py-2
      text-sm text-gray-600
      placeholder:text-gray-500
      outline-1 -outline-offset-1 outline-gray-500/10
      focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500
    `,
    inputClass
  );

  const menuBaseClass = twMerge(
    `
      absolute left-0 right-0 mt-1 max-h-64
      overflow-auto rounded-md bg-gray-100
      border border-gray-400 shadow-lg z-50
    `,
    menuClass
  );

  const container = Row({
    class: rootClass,
    attributes: { 'data-dropdown-search': '' }
  }, [
    Input({
      delegator,
      class: inputClass, value, placeholder, 
      onInput: (e) => onInput(e.target.value),
      focusIn: (e) => {
        e.stopPropagation();
        onFocus();
      } 
    }),

    open && Row({ class: menuBaseClass }, children)
  ]);

  // Tell the global listener which dropdown is open (no per-component registration). Only set when open; don't clear when closed (another may be open).
  if (getOpenState && setOpenState && getOpenState()) {
    currentOpenRef.current = { getOpenState, setOpenState };
  }

  return container;
}


function DropdownSearchItem(props, children) {
  const {
    onSelect = () => { },
    class: className = '',
    delegator,
  } = props;

  const itemClass = twMerge(
    `
      cursor-pointer px-3 py-2 text-sm
      text-gray-800 hover:bg-gray-300
    `,
    className
  );

  return Row({
    tagType: 'div',
    class: itemClass,
    events: {
      click: (e) => {
        e.stopPropagation();
        onSelect();
      }
    },
    delegator,
  }, children);
}


export { DropdownSearch, DropdownSearchItem };
