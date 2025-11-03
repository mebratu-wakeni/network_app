import { createApp } from './app.js'
import knex from './db/knex.js'

const PORT = process.env.PORT || 4000
const app = createApp()

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`)
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

