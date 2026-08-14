/**
 * Parse CSV text into header list and row objects (keys lowercased).
 * Mirrors front-end import logic; used for server-side bulk uploads.
 */
export function parseCSVText (text) {
  if (text == null || String(text).trim() === '') {
    return { headers: [], rows: [] }
  }

  const lines = String(text).split(/\r?\n/).filter(line => line.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  function parseCSVLine (line) {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim())
    const row = {}
    headers.forEach((header, index) => {
      row[header.toLowerCase()] = values[index] ?? ''
    })
    rows.push(row)
  }

  return { headers, rows }
}
