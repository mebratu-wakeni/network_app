const { Row } = Liteframe;

/**
 * Tabs Component
 *
 * props:
 * - tabs: [{ key, label }]
 * - activeKey: string
 * - onChange: (key) => void
 */
export function Tabs(props) {
  const { tabs, activeKey, onChange } = props;


  return Row(
    {
      class: `
        flex items-center gap-6
        border-b border-gray-200
      `
    },
    tabs.map(tab =>
      Row(
        {
          tagType: 'button',
          class: `
            relative
            pb-3
            text-sm
            transition-colors
            ${tab.key === activeKey
              ? 'text-indigo-600 font-medium'
              : 'text-gray-600 hover:text-gray-800'
            }
          `,
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
                  h-0.5 bg-indigo-600 rounded
                `
            })
            : false
        ]
      )
    )
  );
}
