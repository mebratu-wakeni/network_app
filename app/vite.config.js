import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import electron from 'vite-plugin-electron/simple';
import tailwindcss from '@tailwindcss/vite'

/**
 * Icons referenced via variables / hard-to-scan patterns — always keep these.
 * Prefer string literals in source so the scanner picks them up automatically.
 */
const EXTRA_ICONS = [
  'cube',
  'flash',
  'server',
  'toggle',
  'logo-apple',
  'medical-outline',
  'rocket-outline',
  'caret-forward-circle-outline',
]

/** Solid (non-*-outline) ionicon names we actually use. */
const SOLID_ICONS = new Set([
  'checkbox',
  'checkmark',
  'cube',
  'flash',
  'logo-apple',
  'server',
  'shield-checkmark',
  'toggle',
])

const ICON_NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

function isLikelyIconName(name) {
  if (!ICON_NAME_RE.test(name)) return false
  if (name.endsWith('-outline')) return true
  if (SOLID_ICONS.has(name)) return true
  return false
}

function walkSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkSourceFiles(full, files)
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

/**
 * Scan app/src for ion-icon names so production builds keep every icon in use
 * (manual allowlists drift — e.g. add-circle-outline was missing from deployed builds).
 */
function collectUsedIcons(srcDir) {
  const icons = new Set(EXTRA_ICONS)
  const files = walkSourceFiles(srcDir)

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')

    // IonIcon({ name: 'xxx' }) — including multiline props
    for (const match of text.matchAll(/IonIcon\(\s*\{([\s\S]*?)\}\s*\)/g)) {
      const body = match[1]
      const lit = body.match(/\bname:\s*['"`]([a-z0-9-]+)['"`]/)
      if (lit && isLikelyIconName(lit[1])) icons.add(lit[1])
      const tpl = body.match(/\bname:\s*`([^`]*)`/)
      if (tpl) {
        for (const quoted of tpl[1].matchAll(/['"]([a-z0-9-]+)['"]/g)) {
          if (isLikelyIconName(quoted[1])) icons.add(quoted[1])
        }
      }
    }

    // <ion-icon> via Row tagType
    for (const match of text.matchAll(
      /tagType:\s*['"]ion-icon['"][\s\S]{0,200}?\bname:\s*['"`]([a-z0-9-]+)['"`]/g
    )) {
      if (isLikelyIconName(match[1])) icons.add(match[1])
    }

    // ActionItem / nav / tabs: icon: 'xxx-outline'
    for (const match of text.matchAll(/\bicon:\s*['"`]([a-z0-9-]+)['"`]/g)) {
      if (isLikelyIconName(match[1])) icons.add(match[1])
    }
  }

  return icons
}

const USED_ICONS = collectUsedIcons(path.resolve(__dirname, 'src'))

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
        const missingAssets = []
        for (const file of files) {
          if (!file.endsWith('.svg')) continue
          const iconName = file.slice(0, -4) // strip .svg
          if (!USED_ICONS.has(iconName)) {
            fs.unlinkSync(path.join(componentSvgDir, file))
            removed++
          }
        }
        for (const iconName of USED_ICONS) {
          const svgPath = path.join(componentSvgDir, `${iconName}.svg`)
          if (!fs.existsSync(svgPath)) missingAssets.push(iconName)
        }
        console.log(
          `[ionicons-optimizer] SVGs: kept ${USED_ICONS.size} (scanned from src/), removed ${removed} unused from dist/ionicons/ionicons/svg/`
        )
        if (missingAssets.length) {
          console.warn(
            `[ionicons-optimizer] WARNING: ${missingAssets.length} used icon(s) have no SVG asset: ${missingAssets.join(', ')}`
          )
        }
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
  // Dedicated Cloud feed (cloud-backend). Managed Cloud builds override via CI env.
  const cloudUpdatesUrl =
    env.VITE_CLOUD_UPDATES_URL ||
    'https://server.masatechplc.com/downloads/lan'

  return {
    plugins: [
      tailwindcss(),
      ioniconsOptimizer(),
      electron({
        main: {
          entry: 'electron/main.js',
          vite: {
            build: {},
            define: {
              // Injected as a Node.js process.env so main.js can read it at runtime.
              'process.env.IS_CLOUD_BUILD': JSON.stringify(isCloudBuild ? 'true' : 'false'),
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
