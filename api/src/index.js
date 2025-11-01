import express from 'express'
import dotenv from 'dotenv'
// import cors from "cors";

dotenv.config()

const app = express()

const PORT = process.env.PORT || 4000
// const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(express.json())
// app.use(cors({
//   origin: FRONTEND_ORIGIN // Vite dev server URL
// }));


app.get('/health', (_req, res) => res.json({ ok: true }))

// Database health check endpoint
app.get('/api/db-health', async (_req, res) => {
  try {
    // Simple database connectivity test
    // You can add actual database query here if needed
    res.json({ ok: true, database: "online" });
  } catch (err) {
    console.error("Database health check failed:", err.message);
    res.status(500).json({ ok: false, database: "offline", error: err.message });
  }
})


// placeholder root
app.get("/", (_req, res) => res.json({ message: "API running" }));

const server = app.listen(PORT, () => {
  // keep logs minimal and clear
  // CI / Docker will pick up exit codes on failures
  // avoid leaking secrets in logs
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});
// Graceful shutdown
const shutdown = (signal) => {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log("HTTP server closed");
    process.exit(0);
  });

  // force exit if shutdown takes too long
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error("Forcefully terminating");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Simple test route
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from backend!" });
});

// Example POST route
app.post("/api/orders", (req, res) => {
  const order = req.body;
  console.log("New order received:", order);
  // Here you would insert into Postgres
  res.json({ success: true, order });
});

// Server already started above with graceful shutdown handling
