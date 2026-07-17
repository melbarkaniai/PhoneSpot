import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { usePrerenderData, type ModelsData } from '../lib/prerenderData'

let modelsCache: ModelsData | null = null

export function useModels() {
  const prerenderData = usePrerenderData()
  if (modelsCache === null && prerenderData?.models) {
    modelsCache = prerenderData.models
  }

  const [data, setData] = useState<ModelsData | null>(modelsCache)
  const [isLoading, setIsLoading] = useState(modelsCache === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (modelsCache) return
    apiFetch('/api/models')
      .then((r) => r.json())
      .then((d) => { modelsCache = d; setData(d) })
      .catch(() => setError('Impossible de charger les modèles'))
      .finally(() => setIsLoading(false))
  }, [])

  return { data, isLoading, error }
}
