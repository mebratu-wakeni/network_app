function formatUTCDate(isoString) {
  const date = new Date(isoString);

  if(!isoString) {
    return '-'
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // const month = months[date.getUTCMonth()];
  // const day = String(date.getUTCDate()).padStart(2, '0');
  // const year = date.getUTCFullYear();

  // const hours = String(date.getUTCHours()).padStart(2, '0');
  // const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  // const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds}`;
}

export { formatUTCDate };
