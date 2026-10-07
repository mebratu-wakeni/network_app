/**
 * Strict calendar date: dd/mm/yyyy (two-digit day and month).
 * Returns ISO date string YYYY-MM-DD for DB/API internal use, or null if invalid.
 */
export function ddMmYyyyToIso (raw) {
  if (raw == null || raw === '') return null
  const s = String(raw).trim()
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1000 || yyyy > 9999) return null
  const d = new Date(yyyy, mm - 1, dd)
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}
