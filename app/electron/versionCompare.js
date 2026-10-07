/** @returns {number[]} */
function parseVersionParts(v) {
  return String(v || '0')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((p) => {
      const n = parseInt(p, 10)
      return Number.isFinite(n) ? n : 0
    })
}

/** @returns {number} negative if a < b, 0 if equal, positive if a > b */
export function compareVersions(a, b) {
  const pa = parseVersionParts(a)
  const pb = parseVersionParts(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0
    const db = pb[i] || 0
    if (da !== db) return da - db
  }
  return 0
}
