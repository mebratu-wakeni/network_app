import dotenv from 'dotenv'
dotenv.config()

import { createApp } from './app.js'

const PORT = Number(process.env.PORT) || 4001
const app = createApp()

app.listen(PORT, () => {
  console.log(`[license-api] Running on http://localhost:${PORT}  (env: ${process.env.NODE_ENV || 'development'})`)
})
