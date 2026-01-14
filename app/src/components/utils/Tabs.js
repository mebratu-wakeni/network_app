const { Row } = Liteframe;
import { twMerge } from "tailwind-merge";

/**
 * Tabs Component
 *
 * props:
 * - tabs: [{ key, label }]
 * - activeKey: string
 * - onChange: (key) => void
 */
export function Tabs(props) {
  const { tabs, activeKey, onChange, class: className = '' } = props;

  const baseTabClasses = (tab) =>  `h-10 relative py-3 text-sm transition-colors hover:text-gray-800 ${tab.key === activeKey
    ? 'text-indigo-600 font-medium bg-white'
    : 'text-gray-600'}`;

  // const fullTabClasses = twMerge(baseTabClasses, className);/


  return Row(
    {
      class: `
        flex items-center gap-1
        border-b border-gray-200 bg-gray-100
      `
    },
    tabs.map(tab =>
      Row(
        {
          tagType: 'button',
          class: twMerge(baseTabClasses(tab), className),
          events: {
            'click': () => onChange(tab.key)
          }
        },
        [
          tab.label,
          tab.key === activeKey
            ? Row({
              class: `
                  absolute left-0 right-0 -bottom-px
                  h-2 bg-white
                `
            })
            : false,
          tab.key === activeKey
            ? Row({
              class: `
                  absolute left-0 right-0 -top-px
                  h-1 bg-indigo-600
                `
            })
            : false,
        ]
      )
    )
  );
}
