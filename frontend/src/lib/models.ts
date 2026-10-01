export const SLUG_TO_MODEL: Record<string, string> = {
  'iphone-11': 'iPhone 11',
  'iphone-11-pro': 'iPhone 11 Pro',
  'iphone-11-pro-max': 'iPhone 11 Pro Max',
  'iphone-12': 'iPhone 12',
  'iphone-12-mini': 'iPhone 12 mini',
  'iphone-12-pro': 'iPhone 12 Pro',
  'iphone-12-pro-max': 'iPhone 12 Pro Max',
  'iphone-13': 'iPhone 13',
  'iphone-13-mini': 'iPhone 13 mini',
  'iphone-13-pro': 'iPhone 13 Pro',
  'iphone-13-pro-max': 'iPhone 13 Pro Max',
  'iphone-14': 'iPhone 14',
  'iphone-14-plus': 'iPhone 14 Plus',
  'iphone-14-pro': 'iPhone 14 Pro',
  'iphone-14-pro-max': 'iPhone 14 Pro Max',
  'iphone-15': 'iPhone 15',
  'iphone-15-plus': 'iPhone 15 Plus',
  'iphone-15-pro': 'iPhone 15 Pro',
  'iphone-15-pro-max': 'iPhone 15 Pro Max',
  'iphone-16': 'iPhone 16',
  'iphone-16-plus': 'iPhone 16 Plus',
  'iphone-16-pro': 'iPhone 16 Pro',
  'iphone-16-pro-max': 'iPhone 16 Pro Max',
  'iphone-17': 'iPhone 17',
  'iphone-17-pro': 'iPhone 17 Pro',
  'iphone-17-pro-max': 'iPhone 17 Pro Max',
}

export interface ModelLink {
  slug: string
  model: string
}

export interface Generation {
  number: number
  label: string
  year: number
  models: ModelLink[]
}

// iPhone 11 → 2019, +1 per generation.
const FIRST_GENERATION = 11
const FIRST_YEAR = 2019

const MODEL_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_MODEL).map(([slug, model]) => [model, slug])
)

export function modelPath(model: string): string | null {
  const slug = MODEL_TO_SLUG[model]
  return slug ? `/estimer/${slug}` : null
}

function generationOf(model: string): number {
  return Number(model.match(/iPhone (\d+)/)?.[1] ?? 0)
}

// "iPhone 15 Pro Max" → "Pro Max", "iPhone 15" → "".
function variantOf(model: string): string {
  return model.replace(/^iPhone \d+\s*/, '')
}

// Newest first; models keep their SLUG_TO_MODEL order (base, then variants).
export const GENERATIONS: Generation[] = (() => {
  const byNumber = new Map<number, ModelLink[]>()
  for (const [slug, model] of Object.entries(SLUG_TO_MODEL)) {
    const n = generationOf(model)
    if (!byNumber.has(n)) byNumber.set(n, [])
    byNumber.get(n)!.push({ slug, model })
  }
  return [...byNumber.entries()]
    .sort(([a], [b]) => b - a)
    .map(([number, models]) => ({
      number,
      label: `iPhone ${number}`,
      year: FIRST_YEAR + number - FIRST_GENERATION,
      models,
    }))
})()

// Most searched models, shown in the global footer and on the 404 page.
const POPULAR_SLUGS = [
  'iphone-17-pro', 'iphone-17', 'iphone-16-pro', 'iphone-16',
  'iphone-15-pro', 'iphone-15', 'iphone-14', 'iphone-13',
]

export const POPULAR_MODELS: ModelLink[] = POPULAR_SLUGS
  .filter((slug) => SLUG_TO_MODEL[slug])
  .map((slug) => ({ slug, model: SLUG_TO_MODEL[slug] }))

// Same-generation variants, then the equivalent model one generation down and
// one up (same variant if it exists, otherwise the base model). Padded with
// the nearest generations' models so every page gets at least 4 links.
export function getRelatedModels(slug: string, min = 4, max = 6): ModelLink[] {
  const model = SLUG_TO_MODEL[slug]
  if (!model) return []
  const n = generationOf(model)
  const variant = variantOf(model)
  const genModels = (k: number) => GENERATIONS.find((g) => g.number === k)?.models ?? []

  const equivalentIn = (k: number): ModelLink | undefined => {
    const models = genModels(k)
    return models.find((m) => variantOf(m.model) === variant) ?? models[0]
  }

  const related: ModelLink[] = []
  const add = (m: ModelLink | undefined) => {
    if (m && m.slug !== slug && !related.some((r) => r.slug === m.slug)) related.push(m)
  }

  genModels(n).forEach(add)
  add(equivalentIn(n - 1))
  add(equivalentIn(n + 1))

  for (let d = 1; related.length < min && d <= GENERATIONS.length; d++) {
    for (const m of [...genModels(n + d), ...genModels(n - d)]) {
      if (related.length >= min) break
      add(m)
    }
  }

  return related.slice(0, max)
}
