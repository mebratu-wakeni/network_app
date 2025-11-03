export const notFound = (_req, res, _next) => {
  res.status(404).json({ ok: false, error: 'Not Found' })
}

export const errorHandler = (err, _req, res, _next) => {
  // Avoid leaking internal details in production
  const message = err?.message || 'Internal Server Error'
  const status = err?.status || 500
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err)
  res.status(status).json({ ok: false, error: message })
}

export default { notFound, errorHandler }

