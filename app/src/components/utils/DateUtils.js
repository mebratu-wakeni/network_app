/**
 * Date utility functions
 */

/** Today in YYYY-MM-DD (local timezone). */
export const today = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

/** Start of current week (Sunday) and end (Saturday) in YYYY-MM-DD. */
export const weekBounds = () => {
  const d = new Date();
  const day = d.getDay();
  const diffToSunday = d.getDate() - day;
  const start = new Date(d);
  start.setDate(diffToSunday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
};

/**
 * Normalize a date value to YYYY-MM-DD for use in <input type="date">.
 * @param {string|Date|null|undefined} date - Date string (any format), Date object, null, or undefined
 * @returns {string} YYYY-MM-DD or '' if invalid/null/undefined
 */
export const toDateInputValue = (date) => {
  if (date === null || date === undefined || date === '') return '';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';
    return dateObj.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

const ISO_YYYY_MM_DD = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Formats a date string or Date object into dd/mm/yyyy format
 * @param {string|Date|null|undefined} date - Date string (YYYY-MM-DD), Date object, null, or undefined
 * @returns {string} Formatted date string in dd/mm/yyyy format, or '-' if date is invalid/null/undefined
 */
export const formatDateDDMMYYYY = (date) => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

/**
 * Shifts a value from &lt;input type="date"&gt; (YYYY-MM-DD) to API-expected dd/mm/yyyy.
 * If the value is already free text, returns it unchanged (caller may send dd/mm from CSV-only flows).
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export const toApiDdMmYyyyFromUiDate = (value) => {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()
  if (!s) return null
  const m = ISO_YYYY_MM_DD.exec(s)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return s
}
