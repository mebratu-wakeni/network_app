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
  console.log(`✅ Server running on all interfaces`);
  console.log(`🌐 LAN access: http://${serverIP}:${PORT}`);
  console.log(`💻 Local access: http://localhost:${PORT}`);
});

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

