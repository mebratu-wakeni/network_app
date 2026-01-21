/**
 * Date utility functions
 */

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
