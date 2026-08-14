// CommonJS wrapper required by LiteSpeed/cPanel's Node.js launcher (lsnode.js),
// which uses require() to load the startup file. ES Modules cannot be require()'d,
// so we use a dynamic import() here instead. (Point cPanel's "Application startup
// file" at this file, not src/index.js, if the host's Node app support errors with
// ERR_REQUIRE_ESM. Harmless to use even under Passenger.)
import('./src/index.js').catch((err) => {
  console.error('[api] Startup error:', err)
  process.exit(1)
})
