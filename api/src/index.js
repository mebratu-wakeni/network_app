import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Writes to api/startup-error.log -- deployment troubleshooting (503s, crashed
// startup) is otherwise a guessing game on hosts with no easy log access.
const logFile = path.resolve(__dirname, '../startup-error.log')

function writeLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(logFile, line) } catch (_) {}
  console.error(msg)
}

process.on('uncaughtException', (err) => {
  writeLog(`uncaughtException: ${err.stack || err}`)
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  writeLog(`unhandledRejection: ${reason?.stack || reason}`)
  process.exit(1)
})

let app
try {
  const serverModule = await import('./server.js')
  const appModule = await import('./app.js')
  // 1. Re-initialize the app instance
  app = appModule.createApp()
  writeLog(`Started successfully (env: ${process.env.NODE_ENV || 'development'})`)
  void serverModule // side-effect import above already called app.listen()
} catch (err) {
  writeLog(`Startup crash: ${err.stack || err}`)
  throw err
}

// 2. Crucial for cPanel/Passenger: Explicitly export the Express instance as default
export default app