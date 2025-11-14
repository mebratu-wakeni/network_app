import { IonIcon } from "./Icon";

const { Row }  = Liteframe;

{/* <div class="grid shrink-0 grid-cols-1 focus-within:relative">
  <select id="currency" name="currency" aria-label="Currency" class="col-start-1 row-start-1 w-full appearance-none rounded-md bg-gray-800 py-1.5 pr-7 pl-3 text-base text-gray-400 *:bg-gray-800 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6">
    <option>USD</option>
    <option>CAD</option>
    <option>EUR</option>
  </select>
  <svg viewBox="0 0 16 16" fill="currentColor" data-slot="icon" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-400 sm:size-4">
    <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" fill-rule="evenodd" />
  </svg>
</div> */}

const SelectRelative = (props, children) => {

  const { name, id, value, onChange = () => {}, class: className = '' } = props;

  const outerClass = `rounded-md bg-white/5 pl-3 outline-1 -outline-offset-1 outline-gray-600 has-[input:focus-within]:outline-2 has-[input:focus-within]:-outline-offset-2 has-[input:focus-within]:outline-indigo-500`

  const baseClass = `${outerClass} col-start-1 row-start-1 w-full appearance-none rounded-md bg-gray-800 py-1.5 pr-7 pl-3 text-base text-gray-400 *:bg-gray-800 
  placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 ${className}`;

  return Row({class: 'grid shrink-0 grid-cols-1 focus-within:relative'}, [
    Row({tagType: 'select', id, attributes: {name, 'aria-label': name, value}, class: baseClass, events: {'change': onChange}}, children),
    IonIcon({ name: 'chevron-expand-outline', size: 'small', class: "pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-400 sm:size-4" })
  ])
} 

const SelectOptions = (props) => {
  const { options = [], selectedOption = '' } =  props;
  return options && options.map(option => Row({ tagType: 'option', attributes: { selected: selectedOption === option , value: option } }, option))
}

export { SelectRelative, SelectOptions };