import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import electron from 'vite-plugin-electron/simple';
import tailwindcss from '@tailwindcss/vite'

/**
 * All ion-icon names actually referenced in src/.
 * Update this list whenever a new icon is introduced.
 */
const USED_ICONS = new Set([
  'add-outline',
  'alert-circle-outline',
  'arrow-back-outline',
  'arrow-down-circle-outline',
  'arrow-down-outline',
  'arrow-forward-outline',
  'arrow-undo-outline',
  'arrow-up-circle-outline',
  'arrow-up-outline',
  'ban-outline',
  'business-outline',
  'calendar-outline',
  'card-outline',
  'caret-back-outline',
  'caret-forward-circle-outline',
  'caret-forward-outline',
  'cart-outline',
  'checkbox',
  'cash-outline',
  'checkmark-circle-outline',
  'checkmark-done-outline',
  'chevron-back-outline',
  'chevron-down-outline',
  'chevron-forward-outline',
  'chevron-up-outline',
  'close-circle-outline',
  'close-outline',
  'cloud-offline-outline',
  'cloud-upload-outline',
  'create-outline',
  'cube',
  'cube-outline',
  'diamond-outline',
  'document-attach-outline',
  'document-outline',
  'document-text-outline',
  'download-outline',
  'ellipsis-vertical-outline',
  'eye-outline',
  'filter-outline',
  'flash',
  'grid-outline',
  'hourglass-outline',
  'key-outline',
  'layers-outline',
  'lock-closed-outline',
  'lock-open-outline',
  'log-out-outline',
  'logo-apple',
  'mail-outline',
  'medical-outline',
  'pencil-outline',
  'people-outline',
  'person-add-outline',
  'person-circle-outline',
  'person-outline',
  'pie-chart-outline',
  'pricetag-outline',
  'print-outline',
  'reader-outline',
  'receipt-outline',
  'return-down-back-outline',
  'return-up-forward-outline',
  'rocket-outline',
  'search-outline',
  'server',
  'server-outline',
  'settings-outline',
  'shield-checkmark',
  'shield-checkmark-outline',
  'square-outline',
  'stats-chart-outline',
  'swap-horizontal-outline',
  'swap-vertical-outline',
  'time-outline',
  'toggle',
  'trash-outline',
  'trending-up-outline',
  'wallet-outline',
  'warning-outline',
])

/**
 * Vite plugin that strips unused Ionicons assets from dist/ after the
 * production build, before electron-builder packages the app.
 *
 * At runtime only dist/ionicons/ionicons/ is needed:
 *   - ionicons.esm.js  : self-registering Stencil bundle (loaded via dynamic import)
 *   - p-*.js files     : Stencil lazy-loaded component chunks
 *   - svg/             : individual SVGs fetched on demand — only used icons kept
 *
 * Everything else Vite copied from the ionicons npm package is dead weight:
 *   collection/ (5.4 MB), cheatsheet.html (864 KB), ionicons.symbols.svg (720 KB),
 *   ionicons.json (168 KB), ionicons.web-types.json (144 KB), types/ (112 KB),
 *   esm/ (84 KB), cjs/ (84 KB), loader/ (20 KB), svg/ (raw, 1357 SVGs), etc.
 */
function ioniconsOptimizer() {
  let didRun = false
  return {
    name: 'vite-plugin-ionicons-optimizer',
    apply: 'build',
    closeBundle() {
      if (didRun) return
      didRun = true

      const ioniconsDir = path.resolve(__dirname, 'dist', 'ionicons')
      if (!fs.existsSync(ioniconsDir)) return

      // Directories and files to remove entirely from dist/ionicons/
      const REMOVE_ENTRIES = [
        'collection',
        'cheatsheet.html',
        'ionicons.symbols.svg',
        'ionicons.json',
        'ionicons.web-types.json',
        'types',
        'esm',
        'cjs',
        'loader',
        'svg',        // root-level raw SVGs (not the ionicons/ionicons/svg/ one)
        'index.js',
        'index.cjs.js',
      ]

      let totalRemoved = 0
      for (const entry of REMOVE_ENTRIES) {
        const target = path.join(ioniconsDir, entry)
        if (fs.existsSync(target)) {
          const stat = fs.statSync(target)
          fs.rmSync(target, { recursive: true, force: true })
          totalRemoved++
          const label = stat.isDirectory() ? `${entry}/` : entry
          console.log(`[ionicons-optimizer] Removed dist/ionicons/${label}`)
        }
      }

      // Filter Stencil component SVGs to only the icons actually used
      const componentSvgDir = path.join(ioniconsDir, 'ionicons', 'svg')
      if (fs.existsSync(componentSvgDir)) {
        const files = fs.readdirSync(componentSvgDir)
        let removed = 0
        for (const file of files) {
          if (!file.endsWith('.svg')) continue
          const iconName = file.slice(0, -4) // strip .svg
          if (!USED_ICONS.has(iconName)) {
            fs.unlinkSync(path.join(componentSvgDir, file))
            removed++
          }
        }
        console.log(
          `[ionicons-optimizer] SVGs: kept ${USED_ICONS.size}, removed ${removed} unused from dist/ionicons/ionicons/svg/`
        )
      }

      const finalSize = getFolderSize(ioniconsDir)
      console.log(`[ionicons-optimizer] dist/ionicons/ final size: ${(finalSize / 1024).toFixed(0)} KB\n`)
    },
  }
}

function getFolderSize(dir) {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) total += getFolderSize(full)
    else total += fs.statSync(full).size
  }
  return total
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env / .env.cloud etc. so IS_CLOUD_BUILD can be injected into both
  // the renderer bundle AND the Electron main-process bundle at build time.
  const env = loadEnv(mode, process.cwd(), '')
  const isCloudBuild = env.VITE_CLOUD_MODE === 'true'
  const cloudDefaultServer =
    env.VITE_DEFAULT_SERVER_URL ||
    (mode === 'development' ? 'http://localhost:4000' : 'https://mltplc.com')
  const cloudUpdatesUrl =
    env.VITE_CLOUD_UPDATES_URL ||
    'https://server.masatechplc.com/downloads/cloud-multi'

  return {
    define: {
      'import.meta.env.VITE_CLOUD_MODE': JSON.stringify(isCloudBuild ? 'true' : ''),
      'import.meta.env.VITE_DEFAULT_SERVER_URL': JSON.stringify(isCloudBuild ? cloudDefaultServer : ''),
    },
    plugins: [
      tailwindcss(),
      ioniconsOptimizer(),
      electron({
        main: {
          entry: 'electron/main.js',
          vite: {
            build: {},
            define: {
              // Injected as Node process.env so main.js can read them at runtime.
              'process.env.IS_CLOUD_BUILD': JSON.stringify(isCloudBuild ? 'true' : 'false'),
              'process.env.CLOUD_DEFAULT_SERVER_URL': JSON.stringify(isCloudBuild ? cloudDefaultServer : ''),
              'process.env.CLOUD_UPDATES_URL': JSON.stringify(isCloudBuild ? cloudUpdatesUrl : ''),
            },
          },
        },
        preload: {
          input: path.join(__dirname, 'electron/preload.js'),
        },
        renderer: process.env.NODE_ENV === 'test'
          ? undefined
          : {},
      }),
    ],
    publicDir: 'public',
  }
})
