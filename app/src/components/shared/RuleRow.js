const { Row } = Liteframe;

export default function RuleRow({
  rules,
  userRules,
  mode = 'any',
  fallback = false,
  ...rowProps
}, children) {
  const allowed = hasRequiredRules(userRules, rules, mode);

  if (!allowed) {
    return fallback;
  }

  return Row({
    ...rowProps,
  }, children);
}

function hasRequiredRules(userRules, requiredRules, mode = 'any') {
  if (!requiredRules || requiredRules.length === 0) return true;
  if (!userRules || userRules.length === 0) return false;

  const required = Array.isArray(requiredRules)
    ? requiredRules
    : [requiredRules];

  return mode === 'all'
    ? required.every(r => userRules.includes(r))
    : required.some(r => userRules.includes(r));
}
