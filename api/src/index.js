import server from './server.js'
import { createApp } from './app.js'

// 1. Re-initialize the app instance
const app = createApp()

// 2. Crucial for cPanel/Passenger: Explicitly export the Express instance as default
export default app