import { twMerge } from 'tailwind-merge';
import { IonIcon } from './Icon';
import { registerActionDropdownOutsideClickByTag } from './OutsideClick';

const { Row } = Liteframe;

/** Registry of open ActionDropdown controllers keyed by actionId. */
const openDropdownControllers = new Map();

function closeAllOpenDropdowns(exceptActionId = null) {
  openDropdownControllers.forEach((controller, key) => {
    if (exceptActionId != null && key === exceptActionId) return;
    if (controller && controller.getOpenState && controller.getOpenState()) {
      controller.setOpenState();
    }
  });
}

let actionDropdownOutsideClickRegistered = false;
if (!actionDropdownOutsideClickRegistered) {
  registerActionDropdownOutsideClickByTag(() => ({
    getOpenState: () => openDropdownControllers.size > 0,
    setOpenState: () => closeAllOpenDropdowns()
  }));
  actionDropdownOutsideClickRegistered = true;
}

function ActionDropdown(props, children) {
  const {
    actionId,
    open = false,
    onToggle = () => { },
    class: className = '',
    buttonClass = '',
    menuClass = '',
    trigger = null
  } = props;

  const rootClass = twMerge(
    'relative inline-flex',
    className
  );

  const triggerClass = twMerge(
    `
      inline-flex items-center gap-1
      rounded-md px-2 py-1
      text-gray-100 hover:bg-gray-200
      focus:outline-none
    `,
    buttonClass
  );

  const menuBaseClass = twMerge(
    `
      
      rounded-md bg-gray-200
      border border-gray-300
      shadow-lg cursor-pointer
    `,
    menuClass
  );

  const container = Row({
    class: rootClass,
    attributes: { 'data-action-id': actionId, 'data-action-dropdown': '' }
  }, [
    Row({
      tagType: 'button',
      class: triggerClass,
      events: {
        click: (e) => {
          e.stopPropagation(); // critical
          if (!open) {
            closeAllOpenDropdowns(actionId);
          }
          onToggle();
        }
      }
    }, [
      trigger || IonIcon({ name: 'ellipsis-vertical-outline', size: 'small' })
    ]),

    open && Row({
      class: `z-50 absolute right-0 mt-2 min-w-40` }, [
      Row({ class: menuBaseClass }, children),
      Row({ class: 'h-8' })
    ])
  ]);

  if (open) {
    openDropdownControllers.set(actionId, {
      getOpenState: () => true,
      setOpenState: () => onToggle()
    });
  } else {
    openDropdownControllers.delete(actionId);
  }

  return container;
}


function ActionItem(props) {
  const {
    label,
    icon,
    onClick = () => { },
    danger = false,
    disabled = false,
    class: className = ''
  } = props;

  const baseClass = twMerge(
    `
      w-full text-left px-3 py-2 text-sm flex items-center justify-start gap-2
      transition-colors font-semibold
      ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
      ${danger
      ? 'text-red-400 hover:bg-red-500/10'
      : 'text-indigo-600 hover:bg-indigo-500/10'
    }
    `,
    className
  );

  return Row({
    tagType: 'button',
    class: baseClass,
    disabled,
    events: {
      click: (e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }
    }
  }, [
    IonIcon({ name: icon, class: 'text-xl font-semibold'}),
    label
  ]);
}


export { ActionDropdown, ActionItem };
