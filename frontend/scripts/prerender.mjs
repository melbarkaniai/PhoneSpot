// Post-build step: renders every public route to static HTML so search
// engines and social-media crawlers see real content instead of the empty
// SPA shell, then generates sitemap.xml / robots.txt from the same route
// list. Runs after `vite build` (client) and `vite build --ssr` (server
// bundle) — see the `build` script in package.json.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const SSR_DIST = path.join(ROOT, 'dist-ssr')
const SITE_URL = 'https://www.phonespot.fr'
const API_BASE = process.env.VITE_API_URL || 'https://phonespot-production.up.railway.app'

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchModels() {
  const data = await fetchWithTimeout(`${API_BASE}/api/models`, 8000)
  if (!data?.models) {
    console.warn('[prerender] Could not fetch /api/models — pages will render without model/storage data.')
    return null
  }
  return data
}

function computePriceRange(pricesPayload) {
  if (!pricesPayload?.comparison) return null
  const prices = []
  for (const storageData of Object.values(pricesPayload.comparison)) {
    for (const condData of Object.values(storageData)) {
      for (const price of Object.values(condData)) {
        if (typeof price === 'number') prices.push(price)
      }
    }
  }
  if (prices.length === 0) return null
  return { min: Math.min(...prices), max: Math.max(...prices), count: prices.length }
}

// Sequential with a short delay — polite to the shared scraper cache/rate
// limiter (30 req/min) rather than firing ~27 requests at once.
async function fetchPriceRanges(models) {
  const ranges = {}
  for (const model of models) {
    const data = await fetchWithTimeout(`${API_BASE}/api/prices/${encodeURIComponent(model)}`, 8000)
    ranges[model] = computePriceRange(data)
    await new Promise((r) => setTimeout(r, 150))
  }
  return ranges
}

function stripDuplicateHeadTags(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/, '')
}

// React 19 hoists every <title>/<meta>/<link> rendered anywhere in the tree
// to a contiguous prefix at the start of the renderToString() output. Split
// that prefix off so it can be merged into the real <head>; everything after
// it (including inline JSON-LD <script> tags, which React does NOT hoist) is
// the actual body markup.
function splitHoistedHead(appHtml) {
  const match = appHtml.match(/^((?:<title[^>]*>[\s\S]*?<\/title>|<meta[^>]*\/?>|<link[^>]*\/?>)*)([\s\S]*)$/)
  if (!match) return { head: '', body: appHtml }
  return { head: match[1], body: match[2] }
}

function injectRoute(template, { appHtml, prerenderData }) {
  let html = stripDuplicateHeadTags(template)
  const { head: headExtra, body } = splitHoistedHead(appHtml)

  html = html.replace('</head>', `    ${headExtra}\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`)

  const dataJson = JSON.stringify(prerenderData ?? null).replace(/</g, '\\u003c')
  const dataScript = `<script>window.__PRERENDER_DATA__=${dataJson}</script>\n    `
  html = html.replace(/<script type="module"/, `${dataScript}<script type="module"`)

  return html
}

async function writeRoute(routePath, html) {
  const outPath = routePath === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, routePath.replace(/^\//, ''), 'index.html')
  await mkdir(path.dirname(outPath), { recursive: true })
  await writeFile(outPath, html, 'utf-8')
  return { routePath, outPath, bytes: Buffer.byteLength(html, 'utf-8') }
}

function buildSitemap(routes) {
  const lastmod = new Date().toISOString().slice(0, 10)
  const entries = routes.map(({ path: p, priority, changefreq }) => `  <url>
    <loc>${SITE_URL}${p === '/' ? '/' : p}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

function buildRobots() {
  return `User-agent: *\nAllow: /\nDisallow: /ps-backoffice\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
}

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf-8')

  const ssrEntryPath = path.join(SSR_DIST, 'entry-server.js')
  if (!existsSync(ssrEntryPath)) {
    throw new Error(`SSR bundle not found at ${ssrEntryPath}. Run "vite build --ssr src/entry-server.tsx --outDir dist-ssr" first.`)
  }
  const { render, SLUG_TO_MODEL } = await import(`file://${ssrEntryPath.replace(/\\/g, '/')}`)

  const models = await fetchModels()

  console.log(`[prerender] Building ${4 + Object.keys(SLUG_TO_MODEL).length} routes...`)

  const priceRanges = await fetchPriceRanges(Object.values(SLUG_TO_MODEL))

  const staticRoutes = [
    { path: '/', payload: { models, priceRange: null } },
    { path: '/revendre', payload: null },
    { path: '/mentions-legales', payload: null },
    { path: '/no-track', payload: null },
  ]

  const modelRoutes = Object.entries(SLUG_TO_MODEL).map(([slug, model]) => ({
    path: `/estimer/${slug}`,
    payload: { models, priceRange: priceRanges[model] ?? null },
  }))

  const results = []
  for (const route of [...staticRoutes, ...modelRoutes]) {
    const { html: appHtml } = render(route.path, route.payload)
    const fullHtml = injectRoute(template, { appHtml, prerenderData: route.payload })
    results.push(await writeRoute(route.path, fullHtml))
  }

  const sitemapRoutes = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    ...modelRoutes.map((r) => ({ path: r.path, priority: '0.9', changefreq: 'weekly' })),
  ]
  await writeFile(path.join(DIST, 'sitemap.xml'), buildSitemap(sitemapRoutes), 'utf-8')
  await writeFile(path.join(DIST, 'robots.txt'), buildRobots(), 'utf-8')

  await rm(SSR_DIST, { recursive: true, force: true })

  console.log('\n[prerender] Done:')
  for (const r of results) {
    console.log(`  ${r.routePath.padEnd(28)} ${(r.bytes / 1024).toFixed(1)} KB  -> ${path.relative(ROOT, r.outPath)}`)
  }
  console.log(`  sitemap.xml (${sitemapRoutes.length} urls), robots.txt`)
}

main().catch((err) => {
  console.error('[prerender] Failed:', err)
  process.exit(1)
})
