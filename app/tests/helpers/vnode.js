export function flattenText(node) {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenText).join(' ')
  return flattenText(node.children || [])
}

export function findButtonsByText(node, matcher) {
  const out = []
  const visit = (n) => {
    if (n == null) return
    if (Array.isArray(n)) {
      n.forEach(visit)
      return
    }
    if (typeof n !== 'object') return
    if (n.tagType === 'button') {
      const text = flattenText(n.children || [])
      if (typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text)) {
        out.push(n)
      }
    }
    visit(n.children || [])
  }
  visit(node)
  return out
}
