import { createContext, useContext } from 'react'

export interface ModelsData {
  models: string[]
  storages: Record<string, string[]>
  conditions: string[]
}

export interface PriceRangeData {
  min: number
  max: number
  count: number
}

export interface PrerenderPayload {
  models: ModelsData | null
  priceRange: PriceRangeData | null
}

declare global {
  interface Window {
    __PRERENDER_DATA__?: PrerenderPayload
  }
}

// Populated by entry-server.tsx during SSR. Not provided in the real client
// tree, so on the client this always falls through to window.__PRERENDER_DATA__
// (injected as inline JSON in the prerendered HTML) — same data, same shape,
// read at the same point in the render, so server and client markup match.
export const PrerenderDataContext = createContext<PrerenderPayload | null>(null)

export function usePrerenderData(): PrerenderPayload | null {
  const ctx = useContext(PrerenderDataContext)
  if (ctx) return ctx
  if (typeof window !== 'undefined') return window.__PRERENDER_DATA__ ?? null
  return null
}
