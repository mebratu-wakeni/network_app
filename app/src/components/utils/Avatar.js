const { Row } = Liteframe;

export function getInitials(source = '') {
  const trimmed = (source || '').trim();
  if (!trimmed) return 'NA';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || (first || 'N').toUpperCase();
}

export default function Avatar({
  src,
  alt,
  fallback,
  size = 'w-9 h-9',
  class: className = '',
}) {
  if (src) {
    return Row({
      tagType: 'img',
      class: `${size} rounded-full object-cover ${className}`.trim(),
      attributes: {
        src,
        alt: alt || 'Avatar',
      },
    });
  }

  return Row({
    class: `${size} rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center select-none ${className}`.trim(),
  }, getInitials(fallback || alt || ''));
}
