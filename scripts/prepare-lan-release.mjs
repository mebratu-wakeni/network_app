#!/usr/bin/env node
/**
 * Prepare lan release staging for upload to
 * https://server.masatechplc.com/downloads/lan/
 *
 * Usage:
 *   node scripts/prepare-lan-release.mjs \
 *     --version 1.0.0 \
 *     --artifacts-dir ./staging/artifacts \
 *     --out-dir ./staging/publish \
 *     [--notes "Release notes"]
 *
 * Expects installer files (and optional electron-updater yml/blockmap) under artifacts-dir
 * (any depth). Writes:
 *   out-dir/index.html
 *   out-dir/latest.json
 *   out-dir/latest.yml | latest-mac.yml | latest-linux.yml  (paths → {version}/…)
 *   out-dir/{version}/*installers*
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const out = {
    version: '',
    artifactsDir: '',
    outDir: '',
    notes: '',
    baseUrl: 'https://server.masatechplc.com/downloads/lan',
    mandatory: false,
    minSupportedVersion: ''
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--version') out.version = String(argv[++i] || '').trim()
    else if (a === '--artifacts-dir') out.artifactsDir = path.resolve(argv[++i] || '')
    else if (a === '--out-dir') out.outDir = path.resolve(argv[++i] || '')
    else if (a === '--notes') out.notes = String(argv[++i] || '').trim()
    else if (a === '--base-url') out.baseUrl = String(argv[++i] || '').replace(/\/+$/, '')
    else if (a === '--mandatory') out.mandatory = true
    else if (a === '--min-supported-version') out.minSupportedVersion = String(argv[++i] || '').trim()
  }
  return out
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walkFiles(full, acc)
    else acc.push(full)
  }
  return acc
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
}

function rewriteUpdaterYml(content, version) {
  // electron-builder writes basename URLs; prefix with version folder for our layout.
  return content.replace(
    /^(\s*(?:-\s*)?(?:url|path):\s*)([^\s#'"]+)/gm,
    (_m, prefix, filePath) => {
      const cleaned = String(filePath).replace(/^['"]|['"]$/g, '')
      if (cleaned.startsWith('http') || cleaned.startsWith(`${version}/`)) {
        return `${prefix}${filePath}`
      }
      if (!/\.(dmg|exe|AppImage|zip|blockmap)$/i.test(cleaned)) {
        return `${prefix}${filePath}`
      }
      return `${prefix}${version}/${cleaned}`
    }
  )
}

function detectPlatformArtifact(fileName) {
  const n = fileName.toLowerCase()
  if (n.endsWith('.dmg') || (n.includes('-mac-') && n.endsWith('.zip'))) return 'mac'
  if (n.endsWith('.exe') || n.includes('-windows-')) {
    // Prefer explicit arch markers from artifactName (...-${arch}-Setup.exe)
    if (n.includes('-ia32-') || n.includes('_ia32') || n.includes('-ia32.')) return 'win32'
    if (n.includes('-x64-') || n.includes('_x64') || n.includes('-x64.')) return 'win'
    // Legacy / unmarked Windows installer → treat as 64-bit
    return 'win'
  }
  if (n.endsWith('.appimage') || n.includes('-linux-')) return 'linux'
  return null
}

function updaterYmlName(fileName) {
  const n = fileName.toLowerCase()
  if (n === 'latest-mac.yml' || n === 'latest-mac.yaml') return 'latest-mac.yml'
  if (n === 'latest-linux.yml' || n === 'latest-linux.yaml') return 'latest-linux.yml'
  if (n === 'latest.yml' || n === 'latest.yaml') return 'latest.yml'
  return null
}

function main() {
  const args = parseArgs(process.argv)
  if (!args.version) {
    console.error('Missing --version')
    process.exit(1)
  }
  if (!args.artifactsDir || !fs.existsSync(args.artifactsDir)) {
    console.error('Missing or invalid --artifacts-dir:', args.artifactsDir)
    process.exit(1)
  }
  if (!args.outDir) {
    console.error('Missing --out-dir')
    process.exit(1)
  }

  const versionDir = path.join(args.outDir, args.version)
  ensureDir(versionDir)
  ensureDir(args.outDir)

  const files = walkFiles(args.artifactsDir)
  const artifacts = { mac: null, win: null, win32: null, linux: null }
  const copiedInstallers = []

  for (const file of files) {
    const base = path.basename(file)
    const ymlTarget = updaterYmlName(base)
    if (ymlTarget) {
      const raw = fs.readFileSync(file, 'utf8')
      fs.writeFileSync(path.join(args.outDir, ymlTarget), rewriteUpdaterYml(raw, args.version), 'utf8')
      console.log('Wrote', ymlTarget)
      continue
    }

    // Skip builder debug noise
    if (base === 'builder-debug.yml' || base.endsWith('.yaml') && base.startsWith('builder')) continue

    const platform = detectPlatformArtifact(base)
    const isBlockmap = base.endsWith('.blockmap')
    if (platform || isBlockmap || /\.(dmg|exe|appimage|zip)$/i.test(base)) {
      const dest = path.join(versionDir, base)
      copyFile(file, dest)
      copiedInstallers.push(base)
      if (platform && !isBlockmap && !artifacts[platform]) {
        artifacts[platform] = base
      }
      console.log('Copied', base, '→', `${args.version}/`)
    }
  }

  // Infer missing platforms from copied names if needed
  for (const name of copiedInstallers) {
    const p = detectPlatformArtifact(name)
    if (p && !artifacts[p] && !name.endsWith('.blockmap')) artifacts[p] = name
  }

  const publishedAt = new Date().toISOString()
  const latest = {
    product: 'PharmaSuit (single-tenant cloud)',
    channel: 'lan',
    version: args.version,
    releaseNotes: args.notes || `PharmaSuit ${args.version}`,
    publishedAt,
    // In-app updater policy (electron-updater reads yml; app UI reads these fields)
    mandatory: args.mandatory === true,
    minSupportedVersion: args.minSupportedVersion || null,
    artifacts: {}
  }

  for (const [key, file] of Object.entries(artifacts)) {
    if (!file) continue
    latest.artifacts[key] = {
      file,
      url: `${args.baseUrl}/${args.version}/${file}`
    }
  }

  fs.writeFileSync(path.join(args.outDir, 'latest.json'), JSON.stringify(latest, null, 2) + '\n', 'utf8')
  console.log('Wrote latest.json')

  const templatePath = path.join(REPO_ROOT, 'downloads/lan/index.html')
  if (fs.existsSync(templatePath)) {
    copyFile(templatePath, path.join(args.outDir, 'index.html'))
    console.log('Copied index.html')
  } else {
    console.warn('No downloads/lan/index.html template found')
  }

  // Placeholder updater yml if a platform build failed — avoids 404 for other platforms
  const requiredYml = [
    ['mac', 'latest-mac.yml'],
    ['win', 'latest.yml'],
    ['linux', 'latest-linux.yml']
  ]
  for (const [key, yml] of requiredYml) {
    const dest = path.join(args.outDir, yml)
    if (fs.existsSync(dest)) continue
    if (!artifacts[key]) {
      console.warn(`No ${key} installer or ${yml}; skipping stub`)
      continue
    }
    const stub = [
      `version: ${args.version}`,
      `files:`,
      `  - url: ${args.version}/${artifacts[key]}`,
      `path: ${args.version}/${artifacts[key]}`,
      `releaseDate: ${publishedAt}`
    ].join('\n') + '\n'
    fs.writeFileSync(dest, stub, 'utf8')
    console.warn('Wrote stub', yml, '(prefer real electron-builder yml when available)')
  }

  console.log('Publish staging ready at', args.outDir)
  console.log(JSON.stringify(latest.artifacts, null, 2))
}

main()
