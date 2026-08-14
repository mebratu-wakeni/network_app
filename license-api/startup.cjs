// CommonJS wrapper required by LiteSpeed/cPanel's Node.js launcher (lsnode.js),
// which uses require() to load the startup file. ES Modules cannot be require()'d,
// so we use a dynamic import() here instead.
import('./src/index.js').catch((err) => {
  console.error('[license-api] Startup error:', err)
  process.exit(1)
})
