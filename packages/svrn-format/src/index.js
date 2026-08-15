import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

export const FORMAT_VERSION = '1.0.0'
export const MANIFEST_PATH = 'manifest.json'
export const CONTENT_PATH = 'content/zine.json'

const encoder = new TextEncoder()
const isDataUrl = value => typeof value === 'string' && value.startsWith('data:')
const isFetchableUrl = value => typeof value === 'string' && (/^https?:\/\//.test(value) || value.startsWith('/'))
// Legacy projects used Transparent Textures directly. The editor already
// renders these through local equivalents; package the local files instead so
// browser CORS can never make a zine non-portable.
const LOCAL_ASSET_ALIASES = {
  'https://www.transparenttextures.com/patterns/old-mathematics.png': '/assets/textures/old-paper.svg',
  'https://www.transparenttextures.com/patterns/dark-matter.png': '/assets/textures/dark-matter.svg'
}
const extensionFor = (mime = '', fallback = 'bin') => ({
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/svg+xml': 'svg', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
  'video/mp4': 'mp4', 'font/woff2': 'woff2'
}[mime.split(';')[0]] || fallback)

export async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function normalizeProject(input) {
  const source = input || {}
  const pages = Array.isArray(source.pages) ? source.pages : (Array.isArray(source.data) ? source.data : [])
  return {
    id: String(source.id || source.serverId || crypto.randomUUID()),
    title: source.title || 'Untitled Zine',
    theme: source.theme || 'classic',
    author: source.author || source.author_name || '',
    description: source.description || '',
    tags: Array.isArray(source.tags) ? source.tags : String(source.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
    pages: pages.map((page, pageIndex) => ({
      id: String(page.id || `page-${pageIndex + 1}`), background: page.background || '#ffffff', texture: page.texture || null,
      orientation: page.orientation || 'portrait', bgm: page.bgm || null, isLocked: Boolean(page.isLocked),
      password: page.password || null, elements: Array.isArray(page.elements) ? page.elements : []
    }))
  }
}

export function capabilitiesFor(project) {
  const elements = project.pages.flatMap(page => page.elements || [])
  return [...new Set(elements.map(element => element.type).filter(Boolean).concat(
    project.pages.some(page => page.bgm) ? ['audio'] : [],
    elements.some(element => element.action) ? ['interactions'] : []
  ))]
}

function dataUrlBytes(url) {
  const [header, data] = url.split(',', 2)
  const mime = header.match(/^data:([^;,]+)/)?.[1] || 'application/octet-stream'
  if (header.includes(';base64')) return { mime, bytes: Uint8Array.from(atob(data), char => char.charCodeAt(0)) }
  return { mime, bytes: encoder.encode(decodeURIComponent(data)) }
}

function visitAssetFields(project, visitor) {
  project.pages.forEach(page => {
    for (const key of ['texture', 'bgm']) if (page[key]) visitor(page, key)
    page.elements.forEach(element => {
      for (const key of ['src', 'poster', 'audioSrc', 'fontSrc']) if (element[key]) visitor(element, key)
      if (element.type === 'sfx' && element.actionVal) visitor(element, 'actionVal')
    })
  })
}

async function embeddedAssets(project, baseUrl) {
  const files = {}
  const assets = []
  const failures = []
  const cache = new Map()
  const resolve = value => isFetchableUrl(value) && baseUrl ? new URL(value, baseUrl).href : value
  await Promise.all([]) // preserve async execution shape for browser and node callers
  const jobs = []
  visitAssetFields(project, (owner, key) => jobs.push((async () => {
    const original = owner[key]
    if (!isDataUrl(original) && !isFetchableUrl(original)) return
    try {
      const assetSource = LOCAL_ASSET_ALIASES[original] || original
      const absolute = resolve(assetSource)
      let payloadPromise = cache.get(absolute)
      if (!payloadPromise) {
        payloadPromise = isDataUrl(assetSource)
          ? Promise.resolve(dataUrlBytes(assetSource))
          : fetch(absolute).then(async response => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`)
              return { mime: response.headers.get('content-type') || 'application/octet-stream', bytes: new Uint8Array(await response.arrayBuffer()) }
            })
        cache.set(absolute, payloadPromise)
      }
      const payload = await payloadPromise
      const hash = await sha256(payload.bytes)
      const path = `assets/${hash}.${extensionFor(payload.mime, original.split('.').pop()?.split('?')[0] || 'bin')}`
      files[path] ||= payload.bytes
      owner[key] = path
      assets.push({ source: original, path, mediaType: payload.mime, sha256: hash, size: payload.bytes.byteLength })
    } catch (error) {
      failures.push({ source: original, field: key, reason: error.message })
    }
  })()))
  await Promise.all(jobs)
  const uniqueFailures = [...new Map(failures.map(failure => [failure.source, failure])).values()]
  return { files, assets, failures: uniqueFailures }
}

export async function packSvrn(projectInput, { baseUrl } = {}) {
  const project = normalizeProject(structuredClone(projectInput))
  const { files, assets, failures } = await embeddedAssets(project, baseUrl)
  if (failures.length) {
    const error = new Error('SVRN package requires all referenced assets to be embedded')
    error.failures = failures
    throw error
  }
  const content = encoder.encode(JSON.stringify(project))
  const contentHash = await sha256(content)
  const manifest = {
    formatVersion: FORMAT_VERSION, issue: { id: project.id, title: project.title, author: project.author, description: project.description, tags: project.tags },
    entry: CONTENT_PATH, assets, hashes: { [CONTENT_PATH]: contentHash, ...Object.fromEntries(assets.map(asset => [asset.path, asset.sha256])) },
    capabilities: capabilitiesFor(project), signature: null
  }
  const archive = zipSync({ [MANIFEST_PATH]: strToU8(JSON.stringify(manifest, null, 2)), [CONTENT_PATH]: content, ...files }, { level: 6 })
  return { archive, manifest, project }
}

export async function unpackSvrn(input) {
  let bytes
  if (input instanceof Blob) bytes = new Uint8Array(await input.arrayBuffer())
  else bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let entries
  try { entries = unzipSync(bytes) } catch { throw new Error('Invalid .svrn archive') }
  if (!entries[MANIFEST_PATH] || !entries[CONTENT_PATH]) throw new Error('Invalid .svrn archive: manifest.json and content/zine.json are required')
  const manifest = JSON.parse(strFromU8(entries[MANIFEST_PATH]))
  if (manifest.formatVersion !== FORMAT_VERSION) throw new Error(`Unsupported SVRN format ${manifest.formatVersion}`)
  for (const [file, expected] of Object.entries(manifest.hashes || {})) {
    if (!entries[file]) throw new Error(`Missing package file: ${file}`)
    if (await sha256(entries[file]) !== expected) throw new Error(`Integrity check failed: ${file}`)
  }
  return { manifest, project: normalizeProject(JSON.parse(strFromU8(entries[CONTENT_PATH]))), entries }
}
