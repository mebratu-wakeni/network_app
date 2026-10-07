import { createApp } from './app.js'
import knex from './db/knex.js'

const PORT = process.env.PORT || 4000
const app = createApp()

// Clean cloud binding: Phusion Passenger will dynamically handle the socket injection via process.env.PORT
const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`\n✅ Cloud Server running cleanly on port ${PORT}`)
  // eslint-disable-next-line no-console
  console.log(`🔒 CORS configuration locked down for cloud deployment\n`)
})

const shutdown = (signal) => {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down gracefully...`)
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed')
    knex.destroy().finally(() => process.exit(0))
  })
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('Forcefully terminating')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export default server