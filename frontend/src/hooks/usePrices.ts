import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

interface PriceEntry {
  [source: string]: number
}

interface ConditionPrices {
  [condition: string]: PriceEntry
}

interface StoragePrices {
  [storage: string]: ConditionPrices
}

interface RawEntry {
  source: string
  model: string
  storage: string
  condition: string
  raw_condition: string
  price: number
  currency: string
  url: string
}

export interface PricesData {
  scraped_at: string
  model: string
  sources: string[]
  conditions: string[]
  storages: string[]
  comparison: StoragePrices
  raw: RawEntry[]
}

export function usePrices(model: string) {
  const [data, setData] = useState<PricesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrices = () => {
    setIsLoading(true)
    setError(null)
    apiFetch(`/api/prices/${encodeURIComponent(model)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur réseau')
        return r.json()
      })
      .then((d) => setData(d))
      .catch(() => setError('Impossible de charger les offres. Réessayez.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (model) fetchPrices()
  }, [model])

  return { data, isLoading, error, retry: fetchPrices }
}
