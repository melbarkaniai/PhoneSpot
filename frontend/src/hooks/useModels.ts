import { useState, useEffect } from 'react'

interface ModelsData {
  models: string[]
  storages: Record<string, string[]>
  conditions: string[]
}

let modelsCache: ModelsData | null = null

export function useModels() {
  const [data, setData] = useState<ModelsData | null>(modelsCache)
  const [isLoading, setIsLoading] = useState(modelsCache === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (modelsCache) return
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => { modelsCache = d; setData(d) })
      .catch(() => setError('Impossible de charger les modèles'))
      .finally(() => setIsLoading(false))
  }, [])

  return { data, isLoading, error }
}
