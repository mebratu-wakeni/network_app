import { createApp } from './app.js'
import knex from './db/knex.js'
import { serverIP } from './detectIp.js'

const PORT = process.env.PORT || 4000
const app = createApp()

// const serverIP = '172.20.10.2';  // Your actual LAN IP

// const server = app.listen(PORT, () => {
//   // eslint-disable-next-line no-console
//   console.log(`Server listening on port ${PORT}`)
// });


const server = app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`\n✅ Server running on all network interfaces`)
  // eslint-disable-next-line no-console
  console.log(`📡 Listening on: 0.0.0.0:${PORT}`)
  if (serverIP && serverIP !== '127.0.0.1') {
    // eslint-disable-next-line no-console
    console.log(`🌐 LAN access: http://${serverIP}:${PORT}`)
  }
  // eslint-disable-next-line no-console
  console.log(`💻 Local access: http://localhost:${PORT}`)
  // eslint-disable-next-line no-console
  console.log(`\n🔒 CORS: ${process.env.NODE_ENV === 'production' ? 'Restricted to allowed origins' : 'LAN access enabled'}\n`)
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

