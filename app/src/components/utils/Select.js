import { IonIcon } from "./Icon";
import { twMerge } from 'tailwind-merge';

const { Row }  = Liteframe;




const BaseSelect = (props, children) => {
  const {
    name,
    id,
    value,
    onChange = () => { },
    selectClass = '',
    containerClass = '',
    delegator,
  } = props;

  const baseSelectClass = twMerge(
    `
    col-start-1 row-start-1 w-full appearance-none rounded-md
    bg-white py-1.5 pr-7 pl-3
    text-sm text-gray-900
    border border-gray-300
    placeholder:text-gray-500
    focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500
    `,
    selectClass
  );

  const containerBase = twMerge(
    `
    grid grid-cols-1 focus-within:relative
    `,
    containerClass
  );

  return Row({ class: containerBase }, [
    Row(
      {
        tagType: 'select',
        id,
        attributes: { name, 'aria-label': name, value },
        class: baseSelectClass,
        events: { change: onChange },
        delegator,
      },
      children
    ),
    IonIcon({
      name: 'chevron-expand-outline',
      size: 'small',
      class:
        'pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-600 sm:size-4',
    }),
  ]);
};

const SelectCompact = (props, children) => {
  return BaseSelect(
    {
      ...props,
      containerClass: twMerge(
        'w-auto shrink-0',
        props.containerClass
      ),
    },
    children
  );
};

const SelectFluid = (props, children) => {
  return BaseSelect(
    {
      ...props,
      containerClass: twMerge(
        'w-full',
        props.containerClass
      ),
    },
    children
  );
};



const SelectRelative = (props, children) => {

  const { name, id, value, onChange = () => {}, class: className = '' } = props;

  const outerClass = `rounded-md bg-white pl-3 outline-1 -outline-offset-1 outline-gray-300 border border-gray-300
   has-[input:focus-within]:outline-2 has-[input:focus-within]:-outline-offset-2 has-[input:focus-within]:outline-indigo-500`

  const baseClass = `${outerClass} col-start-1 row-start-1 w-full appearance-none rounded-md bg-white 
    py-1.5 pr-7 pl-3 text-small text-gray-900 
    placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 
    focus:outline-indigo-500 sm:text-sm/6 ${className}`;

  return Row({class: 'grid shrink-0 grid-cols-1 focus-within:relative'}, [
    Row({tagType: 'select', id, attributes: {name, 'aria-label': name, value}, class: baseClass, events: {'change': onChange}}, children),
    IonIcon({ name: 'chevron-expand-outline', size: 'small', class: "pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-600 sm:size-4" })
  ])
} 

const SelectOptions = (props) => {
  const { options = [], selectedOption = '' } =  props;
  return options && options.map(option => Row({ tagType: 'option', attributes: { selected: selectedOption === option , value: option } }, option))
}

export { SelectRelative, SelectOptions, SelectCompact, SelectFluid };