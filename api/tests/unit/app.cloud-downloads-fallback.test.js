import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createApp, resolveCloudWindowsRelease } from '../../src/app.js'

describe('cloud-multi Windows download fallbacks', () => {
  let downloadsRoot
  let prevTag
  let prevBase
  let prevDownloadsDir

  beforeEach(() => {
    prevTag = process.env.CLOUD_MULTI_WINDOWS_RELEASE_TAG
    prevBase = process.env.CLOUD_MULTI_WINDOWS_RELEASE_BASE
    prevDownloadsDir = process.env.DOWNLOADS_STATIC_DIR
    downloadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-dl-'))
    fs.mkdirSync(path.join(downloadsRoot, 'cloud-multi', '1.0.6'), { recursive: true })
    process.env.DOWNLOADS_STATIC_DIR = downloadsRoot
    process.env.CLOUD_MULTI_WINDOWS_RELEASE_TAG = 'desktop-cloud-v1.0.7'
    process.env.CLOUD_MULTI_WINDOWS_RELEASE_BASE =
      'https://github.com/mebratu-wakeni/network_app/releases/download/desktop-cloud-v1.0.7'
  })

  afterEach(() => {
    if (prevTag === undefined) delete process.env.CLOUD_MULTI_WINDOWS_RELEASE_TAG
    else process.env.CLOUD_MULTI_WINDOWS_RELEASE_TAG = prevTag
    if (prevBase === undefined) delete process.env.CLOUD_MULTI_WINDOWS_RELEASE_BASE
    else process.env.CLOUD_MULTI_WINDOWS_RELEASE_BASE = prevBase
    if (prevDownloadsDir === undefined) delete process.env.DOWNLOADS_STATIC_DIR
    else process.env.DOWNLOADS_STATIC_DIR = prevDownloadsDir
    fs.rmSync(downloadsRoot, { recursive: true, force: true })
  })

  it('resolveCloudWindowsRelease derives versioned asset names from the tag', () => {
    const r = resolveCloudWindowsRelease()
    expect(r.version).toBe('1.0.7')
    expect(r.x64).toBe('PharmaSuit-Cloud-Windows-1.0.7-x64-Setup.exe')
    expect(r.ia32).toBe('PharmaSuit-Cloud-Windows-1.0.7-ia32-Setup.exe')
  })

  it('redirects website 1.0.6 Windows Setup.exe URLs to the GitHub Release', async () => {
    const app = createApp()
    const res = await request(app).get(
      '/downloads/cloud-multi/1.0.6/PharmaSuit-Cloud-Windows-1.0.6-x64-Setup.exe'
    )
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(
      'https://github.com/mebratu-wakeni/network_app/releases/download/desktop-cloud-v1.0.7/PharmaSuit-Cloud-Windows-1.0.7-x64-Setup.exe'
    )
  })

  it('redirects ia32 Windows Setup.exe URLs to the ia32 Release asset', async () => {
    const app = createApp()
    const res = await request(app).get(
      '/downloads/cloud-multi/1.0.6/PharmaSuit-Cloud-Windows-1.0.6-ia32-Setup.exe'
    )
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('PharmaSuit-Cloud-Windows-1.0.7-ia32-Setup.exe')
  })

  it('serves a GitHub-backed latest.json when on-disk Windows installers are missing', async () => {
    fs.writeFileSync(
      path.join(downloadsRoot, 'cloud-multi', 'latest.json'),
      JSON.stringify({
        version: '1.0.6',
        artifacts: {
          win: {
            url: 'https://server.masatechplc.com/downloads/cloud-multi/1.0.6/PharmaSuit-Cloud-Windows-1.0.6-x64-Setup.exe'
          }
        }
      })
    )
    const app = createApp()
    const res = await request(app).get('/downloads/cloud-multi/latest.json')
    expect(res.status).toBe(200)
    expect(res.body.version).toBe('1.0.7')
    expect(res.body.artifacts.win.url).toContain(
      'releases/download/desktop-cloud-v1.0.7/PharmaSuit-Cloud-Windows-1.0.7-Setup.exe'
    )
  })
})
