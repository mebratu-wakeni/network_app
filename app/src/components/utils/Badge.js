const { Row } = Liteframe;

export default function Badge({
  label,
  tone = 'default',
  className = '',
}) {
  const toneClasses = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    default: 'bg-gray-200 text-gray-700',
  };

  const selectedClasses = toneClasses[tone] || toneClasses.default;

  return Row({
    class: `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selectedClasses} ${className}`.trim(),
  }, label || 'Badge');
}
