import dotenv from 'dotenv'
dotenv.config()

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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

try {
  const { createApp } = await import('./app.js')
  const PORT = Number(process.env.PORT) || 4001
  const app = createApp()
  app.listen(PORT, () => {
    writeLog(`Running on port ${PORT}  (env: ${process.env.NODE_ENV || 'development'})`)
  })
} catch (err) {
  writeLog(`Startup crash: ${err.stack || err}`)
  process.exit(1)
}
