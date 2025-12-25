const { Row } = Liteframe;

export default function Badge({
  label,
  tone = 'default',
  class: className = '',
}) {
  const toneClasses = {
    success: 'bg-green-200 text-green-800',
    warning: 'bg-yellow-200 text-yellow-800',
    danger: 'bg-red-200 text-red-800',
    info: 'bg-blue-200 text-blue-800',
    default: 'bg-gray-200 text-gray-800',
  };

  const selectedClasses = toneClasses[tone] || toneClasses.default;

  return Row({
    class: `inline-flex items-center px-4 py-1 rounded-full text-xs font-medium ${selectedClasses} ${className}`.trim(),
  }, label || 'Badge');
}
