export default function Badge({ status }) {
  const styles = {
    active:   'bg-emerald-100 text-emerald-700 ring-emerald-200',
    revoked:  'bg-red-100 text-red-700 ring-red-200',
    default:  'bg-slate-100 text-slate-600 ring-slate-200'
  }
  const cls = styles[status] || styles.default
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${cls}`}>
      {status}
    </span>
  )
}
