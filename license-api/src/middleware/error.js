export function notFound(req, res) {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found.` })
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500
  if (status >= 500) {
    console.error('[API_ERR]', err.message, err.stack)
  }
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error.',
    ...(err.details ? { details: err.details } : {})
  })
}
