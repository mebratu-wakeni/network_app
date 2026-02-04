import { twMerge } from 'tailwind-merge';
import { IonIcon } from './Icon';

const { Row } = Liteframe;

function ActionDropdown(props, children) {
  const {
    actionId,
    open = false,
    onToggle = () => { },
    class: className = '',
    buttonClass = '',
    menuClass = ''
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
      absolute right-0 mt-2 min-w-40
      rounded-md bg-gray-200
      border border-gray-300
      shadow-lg z-50 cursor-pointer
    `,
    menuClass
  );

  return Row({
    class: rootClass,
    attributes: { 'data-action-id': actionId }
  }, [
    Row({
      tagType: 'button',
      class: triggerClass,
      events: {
        click: (e) => {
          e.stopPropagation(); // critical
          onToggle();
        }
      }
    }, [
      IonIcon({ name: 'ellipsis-vertical-outline', size: 'small' })
    ]),

    open && Row({ class: menuBaseClass }, children)
  ]);
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
