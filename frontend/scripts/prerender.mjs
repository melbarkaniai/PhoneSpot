// Post-build step: renders every public route to static HTML so search
// engines and social-media crawlers see real content instead of the empty
// SPA shell, then generates sitemap.xml / robots.txt from the same route
// list. Runs after `vite build` (client) and `vite build --ssr` (server
// bundle) — see the `build` script in package.json.
//
// Prices come from the Railway API. Every build also publishes the data it
// used as /prerender-snapshot.json; when the API fails, the snapshot of the
// currently deployed site is reused instead, so a Railway outage never ships
// pages without prices. If neither is reachable the build fails, which keeps
// the previous Vercel deployment live.
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
const SNAPSHOT_FILE = 'prerender-snapshot.json'
const SNAPSHOT_URL = process.env.PRERENDER_SNAPSHOT_URL || `${SITE_URL}/${SNAPSHOT_FILE}`
const API_TIMEOUT_MS = Number(process.env.PRERENDER_API_TIMEOUT_MS) || 20000
// Safety nets: abort (and keep the current deployment live) rather than ship
// a site where many model pages lost their prices.
const MAX_MODELS_WITHOUT_PRICES = 3
const MIN_SITEMAP_URLS = 25

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return { data: null, status: res.status }
    return { data: await res.json(), status: res.status }
  } catch {
    return { data: null, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}

// One retry: /api/prices is rate-limited to 30 req/min per IP.
async function fetchApi(apiPath) {
  const first = await fetchJson(`${API_BASE}${apiPath}`, API_TIMEOUT_MS)
  if (first.data) return first.data
  await sleep(first.status === 429 ? 30000 : 3000)
  return (await fetchJson(`${API_BASE}${apiPath}`, API_TIMEOUT_MS)).data
}

async function fetchPreviousSnapshot() {
  const { data } = await fetchJson(SNAPSHOT_URL, 10000)
  if (data?.prices) return data
  console.warn(`[prerender] No previous snapshot at ${SNAPSHOT_URL}.`)
  return null
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

// Per model: 'ok' (prices), 'empty' (API answered 200 without any price) or
// 'error' (timeout, HTTP error, unreadable body). An error never means
// "no prices" — treating it so turned 27 pages noindex on 2026-10-01.
// Sequential with a short delay — polite to the shared scraper cache/rate
// limiter (30 req/min) rather than firing ~28 requests at once.
async function fetchPrices(models) {
  const results = {}
  for (const model of models) {
    const data = await fetchApi(`/api/prices/${encodeURIComponent(model)}`)
    const priceRange = computePriceRange(data)
    if (priceRange) {
      results[model] = { status: 'ok', priceRange, scrapedAt: typeof data.scraped_at === 'string' ? data.scraped_at : null }
    } else if (data && typeof data === 'object' && 'comparison' in data) {
      results[model] = { status: 'empty' }
    } else {
      results[model] = { status: 'error' }
    }
    await sleep(150)
  }
  return results
}

// API data wins; errors and empty answers fall back to the previous snapshot.
// A model is only flagged noPrices (→ noindex, out of the sitemap) when the
// API answered 200 with no price AND the previous snapshot had none either.
async function loadData(modelNames) {
  const apiModels = await fetchApi('/api/models')
  const api = await fetchPrices(modelNames)

  const notOk = modelNames.filter((m) => api[m].status !== 'ok')
  let previous = null
  if (!apiModels?.models || notOk.length > 0) {
    const errors = notOk.filter((m) => api[m].status === 'error')
    const empty = notOk.filter((m) => api[m].status === 'empty')
    console.warn(`[prerender] API incomplete (models: ${apiModels?.models ? 'ok' : 'FAILED'}, errors: ${errors.join(', ') || 'none'}, empty: ${empty.join(', ') || 'none'}) — loading previous snapshot.`)
    previous = await fetchPreviousSnapshot()
  }

  const models = apiModels?.models ? apiModels : previous?.models ?? null
  if (!models) {
    throw new Error('Railway API unreachable and no previous snapshot available — aborting so the current deployment stays live.')
  }

  const prices = {}
  const noPrices = new Set()
  const unresolvedErrors = []
  let fromSnapshot = 0
  for (const model of modelNames) {
    const { status, priceRange, scrapedAt } = api[model]
    const snap = previous?.prices?.[model]
    if (status === 'ok') {
      prices[model] = { priceRange, scrapedAt }
    } else if (snap?.priceRange) {
      prices[model] = snap
      fromSnapshot++
    } else {
      prices[model] = null
      if (status === 'empty') noPrices.add(model)
      else unresolvedErrors.push(model)
    }
  }
  if (fromSnapshot) console.warn(`[prerender] ${fromSnapshot} model(s) use prices from the previous snapshot.`)
  if (noPrices.size) console.warn(`[prerender] Confirmed without prices (noindex): ${[...noPrices].join(', ')}`)
  if (unresolvedErrors.length) console.warn(`[prerender] API error and no snapshot (rendered without prices, still indexable): ${unresolvedErrors.join(', ')}`)

  const withoutPrices = modelNames.filter((m) => !prices[m])
  if (withoutPrices.length > MAX_MODELS_WITHOUT_PRICES) {
    throw new Error(`${withoutPrices.length} models have no price (max ${MAX_MODELS_WITHOUT_PRICES}): ${withoutPrices.join(', ')} — aborting so the current deployment stays live.`)
  }

  return { models, prices, noPrices }
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
    : routePath === '/404'
      ? path.join(DIST, '404.html')
      : path.join(DIST, routePath.replace(/^\//, ''), 'index.html')
  await mkdir(path.dirname(outPath), { recursive: true })
  await writeFile(outPath, html, 'utf-8')
  return { routePath, outPath, bytes: Buffer.byteLength(html, 'utf-8') }
}

function buildSitemap(routes) {
  const entries = routes.map(({ path: p, priority, changefreq, lastmod }) => `  <url>
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

function isoDay(iso) {
  const d = iso ? new Date(iso) : null
  return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null
}

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf-8')
  // Client-rendered shell for the routes that are not prerendered — see
  // vercel.json. /revendre is driven entirely by its query string, so a
  // query-less prerender could only cause hydration mismatches.
  await writeFile(path.join(DIST, '_spa.html'), template, 'utf-8')

  const ssrEntryPath = path.join(SSR_DIST, 'entry-server.js')
  if (!existsSync(ssrEntryPath)) {
    throw new Error(`SSR bundle not found at ${ssrEntryPath}. Run "vite build --ssr src/entry-server.tsx --outDir dist-ssr" first.`)
  }
  const { render, SLUG_TO_MODEL } = await import(`file://${ssrEntryPath.replace(/\\/g, '/')}`)

  const buildDate = new Date().toISOString()
  const today = isoDay(buildDate)
  const modelNames = Object.values(SLUG_TO_MODEL)

  console.log(`[prerender] Building ${6 + modelNames.length} routes...`)

  const { models, prices, noPrices } = await loadData(modelNames)

  const staticRoutes = [
    { path: '/', payload: { models, priceRange: null } },
    { path: '/estimer', payload: { models, priceRange: null } },
    { path: '/rachat-iphone-bordeaux', payload: null },
    { path: '/mentions-legales', payload: null },
    { path: '/no-track', payload: null },
    { path: '/404', payload: { models, priceRange: null } },
  ]

  const modelRoutes = Object.entries(SLUG_TO_MODEL).map(([slug, model]) => ({
    path: `/estimer/${slug}`,
    model,
    payload: {
      models,
      model,
      priceRange: prices[model]?.priceRange ?? null,
      pricesUpdatedAt: prices[model]?.scrapedAt ?? null,
      noPrices: noPrices.has(model),
    },
  }))

  const results = []
  for (const route of [...staticRoutes, ...modelRoutes]) {
    const { html: appHtml } = render(route.path, route.payload)
    const fullHtml = injectRoute(template, { appHtml, prerenderData: route.payload })
    results.push(await writeRoute(route.path, fullHtml))
  }

  // Model pages confirmed without any price are noindex (see EstimerModel) and left out.
  // lastmod: date of the model's price snapshot, else the build date.
  const sitemapRoutes = [
    { path: '/', priority: '1.0', changefreq: 'daily', lastmod: today },
    { path: '/estimer', priority: '0.8', changefreq: 'daily', lastmod: today },
    { path: '/rachat-iphone-bordeaux', priority: '0.8', changefreq: 'weekly', lastmod: today },
    ...modelRoutes.filter((r) => !r.payload.noPrices).map((r) => ({
      path: r.path,
      priority: '0.9',
      changefreq: 'daily',
      lastmod: isoDay(prices[r.model]?.scrapedAt) ?? today,
    })),
  ]
  if (sitemapRoutes.length < MIN_SITEMAP_URLS) {
    throw new Error(`Sitemap would only list ${sitemapRoutes.length} URLs (min ${MIN_SITEMAP_URLS}) — aborting so the current deployment stays live.`)
  }
  await writeFile(path.join(DIST, 'sitemap.xml'), buildSitemap(sitemapRoutes), 'utf-8')
  await writeFile(path.join(DIST, 'robots.txt'), buildRobots(), 'utf-8')
  await writeFile(
    path.join(DIST, SNAPSHOT_FILE),
    JSON.stringify({ generatedAt: buildDate, models, prices }),
    'utf-8',
  )

  await rm(SSR_DIST, { recursive: true, force: true })

  console.log('\n[prerender] Done:')
  for (const r of results) {
    console.log(`  ${r.routePath.padEnd(28)} ${(r.bytes / 1024).toFixed(1)} KB  -> ${path.relative(ROOT, r.outPath)}`)
  }
  console.log(`  sitemap.xml (${sitemapRoutes.length} urls), robots.txt, ${SNAPSHOT_FILE}`)
}

main().catch((err) => {
  console.error('[prerender] Failed:', err)
  process.exit(1)
})
