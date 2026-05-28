import { useState, useEffect, useRef } from 'react'
import { useModels } from '../hooks/useModels'
import Button from '../components/Button'

function formatStorage(raw: string): string {
  if (raw === '1024GB') return '1 To'
  return raw.replace('GB', ' Go')
}

function ageText(minutes: number): { text: string; color: string } {
  const text = minutes < 1
    ? 'à l\'instant'
    : minutes < 60
      ? `il y a ${minutes} min`
      : (() => {
          const h = Math.floor(minutes / 60)
          const m = minutes % 60
          return m === 0 ? `il y a ${h}h` : `il y a ${h}h ${m}min`
        })()
  const color = minutes > 13 * 60 ? '#FF9500' : '#6E6E73'
  return { text, color }
}

function modelYear(model: string): string {
  const match = model.match(/iPhone\s+(\d+)/)
  if (!match) return ''
  const years: Record<number, string> = {
    16: '2024', 15: '2023', 14: '2022', 13: '2021', 12: '2020', 11: '2019',
  }
  return years[Number(match[1])] ?? ''
}

const CONDITIONS = ['Parfait', 'Très bon état', 'Bon état', 'Cassé']

interface CacheModel {
  model: string
  scraped_at: string
  age_minutes: number
  fresh: boolean
  sources: string[]
  file: string
  error?: string
}

interface RefreshState {
  running: boolean
  current_model: string | null
  progress: number
  total: number
  success: number
  errors: number
  started_at: string | null
  finished_at: string | null
}

export default function Admin() {
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') || '')
  const [authError, setAuthError] = useState('')
  const [prices, setPrices] = useState<Record<string, number | string>>({})
  const [savedMsg, setSavedMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [openModel, setOpenModel] = useState<string | null>(null)
  const { data: modelsData } = useModels()

  // Resale prices tab state
  const [resalePrices, setResalePrices] = useState<Record<string, number>>({})
  const [resaleDirty, setResaleDirty] = useState<Record<string, number>>({})
  const [resaleSavedMsg, setResaleSavedMsg] = useState('')
  const [resaleSaveError, setResaleSaveError] = useState('')
  const [openResaleModel, setOpenResaleModel] = useState<string | null>('iPhone 12')

  // Cache tab state
  const [activeTab, setActiveTab] = useState<'prix' | 'revente' | 'cache'>('prix')
  const [cacheStatus, setCacheStatus] = useState<CacheModel[]>([])
  const [cacheLoading, setCacheLoading] = useState(false)
  const [refreshRunning, setRefreshRunning] = useState(false)
  const [refreshState, setRefreshState] = useState<RefreshState | null>(null)
  const [refreshingModels, setRefreshingModels] = useState<Set<string>>(new Set())
  const [successMsg, setSuccessMsg] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [])

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/prices', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) { setToken(''); sessionStorage.removeItem('admin_token'); return null }
        return r.json()
      })
      .then((d) => { if (d) setPrices(d) })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (activeTab === 'cache' && token) fetchCacheStatus()
  }, [activeTab, token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'revente' && token && Object.keys(resalePrices).length === 0) {
      fetch('/api/admin/resale-prices', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setResalePrices(d))
        .catch(() => {})
    }
  }, [activeTab, token]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchCacheStatus() {
    setCacheLoading(true)
    try {
      const res = await fetch('/api/admin/cache-status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setCacheStatus(data.models || [])
      setLastCheckedAt(new Date())
    } catch {} finally {
      setCacheLoading(false)
    }
  }

  async function startFullRefresh() {
    if (refreshRunning) return
    setRefreshRunning(true)
    setSuccessMsg('')
    setRefreshState(null)

    try {
      await fetch('/api/admin/cache-refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      setRefreshRunning(false)
      return
    }

    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/cache-refresh-status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const state: RefreshState = await res.json()
        setRefreshState(state)
        if (!state.running && state.finished_at) {
          clearInterval(id)
          pollingRef.current = null
          setRefreshRunning(false)
          setSuccessMsg(
            `✓ Actualisation terminée — ${state.success} modèle(s) mis à jour` +
            (state.errors > 0 ? `, ${state.errors} erreur(s)` : '')
          )
          fetchCacheStatus()
          setTimeout(() => setSuccessMsg(''), 5000)
        }
      } catch {}
    }, 2000)

    pollingRef.current = id
  }

  async function refreshModel(model: string) {
    const originalTs = cacheStatus.find((m) => m.model === model)?.scraped_at ?? null
    setRefreshingModels((prev) => new Set([...prev, model]))

    try {
      await fetch(`/api/admin/cache-refresh?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      setRefreshingModels((prev) => { const s = new Set(prev); s.delete(model); return s })
      return
    }

    const deadline = Date.now() + 45000
    const id = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(id)
        setRefreshingModels((prev) => { const s = new Set(prev); s.delete(model); return s })
        return
      }
      try {
        const res = await fetch('/api/admin/cache-status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        const models: CacheModel[] = data.models || []
        const updated = models.find((m) => m.model === model)
        if (updated && updated.scraped_at !== originalTs) {
          clearInterval(id)
          setCacheStatus(models)
          setLastCheckedAt(new Date())
          setRefreshingModels((prev) => { const s = new Set(prev); s.delete(model); return s })
        }
      } catch {}
    }, 3000)
  }

  async function login(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/prices', {
      headers: { Authorization: `Bearer ${password}` },
    })
    if (res.status === 401) {
      setAuthError('Mot de passe incorrect')
      return
    }
    const d = await res.json()
    setPrices(d)
    setToken(password)
    sessionStorage.setItem('admin_token', password)
    setAuthError('')
  }

  async function saveResale() {
    setResaleSavedMsg('')
    setResaleSaveError('')
    const merged = { ...resalePrices, ...resaleDirty }
    const res = await fetch('/api/admin/resale-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(merged),
    })
    if (res.ok) {
      setResalePrices(merged)
      setResaleDirty({})
      setResaleSavedMsg('Prix enregistrés ✓')
      setTimeout(() => setResaleSavedMsg(''), 3000)
    } else {
      setResaleSaveError('Erreur lors de la sauvegarde')
    }
  }

  async function resetResale() {
    if (!window.confirm('Réinitialiser tous les prix aux valeurs par défaut ?')) return
    const res = await fetch('/api/admin/resale-prices/reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const reloaded = await fetch('/api/admin/resale-prices', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json())
      setResalePrices(reloaded)
      setResaleDirty({})
      setResaleSavedMsg('Prix réinitialisés ✓')
      setTimeout(() => setResaleSavedMsg(''), 3000)
    }
  }

  async function save() {
    setSavedMsg('')
    setSaveError('')
    const cleaned: Record<string, number> = {}
    for (const [k, v] of Object.entries(prices)) {
      const n = Number(v)
      if (!isNaN(n) && n > 0) cleaned[k] = n
    }
    const res = await fetch('/api/admin/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(cleaned),
    })
    if (res.ok) setSavedMsg('Prix mis à jour ✓')
    else setSaveError('Erreur lors de la sauvegarde')
  }

  if (!token) {
    return (
      <div className="max-w-sm mx-auto px-6 py-24">
        <h1 className="font-bold text-[28px] text-[#1D1D1F] mb-8">Admin PhoneSpot</h1>
        <form onSubmit={login} className="flex flex-col gap-4">
          <div>
            <label className="block text-[14px] text-[#6E6E73] mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-apple-border rounded-input px-4 py-3 text-[17px] w-full focus:border-[#0071E3] focus:outline-none transition-colors"
              required
            />
          </div>
          {authError && <p className="text-[14px] text-[#FF3B30]">{authError}</p>}
          <Button type="submit" fullWidth>Se connecter</Button>
        </form>
      </div>
    )
  }

  // Build full model list with cache status, including missing entries
  const allModels = modelsData?.models || []
  const cacheRows = allModels.map((model) => {
    const entry = cacheStatus.find((c) => c.model === model)
    return entry ?? { model, missing: true } as CacheModel & { missing?: boolean }
  })

  const isMissingRow = (r: typeof cacheRows[0]) =>
    !('scraped_at' in r) || !!(r as { missing?: boolean }).missing

  const freshCount = cacheRows.filter((r) => !isMissingRow(r) && (r as CacheModel).fresh).length
  const staleCount = cacheRows.filter((r) => !isMissingRow(r) && !(r as CacheModel).fresh).length
  const missingCount = cacheRows.filter((r) => isMissingRow(r)).length

  const filteredRows = filterQuery.trim()
    ? cacheRows.filter((r) => r.model.toLowerCase().includes(filterQuery.toLowerCase()))
    : cacheRows

  const lastCheckedStr = lastCheckedAt
    ? (() => {
        const mins = Math.floor((Date.now() - lastCheckedAt.getTime()) / 60000)
        return mins < 1 ? 'à l\'instant' : `il y a ${mins} min`
      })()
    : null

  const pct = refreshState && refreshState.total > 0
    ? Math.round((refreshState.progress / refreshState.total) * 100)
    : 0

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-bold text-[28px] text-[#1D1D1F]">Admin PhoneSpot</h1>
        <button
          onClick={() => { setToken(''); sessionStorage.removeItem('admin_token') }}
          className="text-[14px] text-[#6E6E73] hover:text-[#FF3B30] transition-colors"
        >
          Déconnexion
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D2D2D7] mb-8 overflow-x-auto no-scrollbar">
        {(['prix', 'revente', 'cache'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-[15px] font-medium transition-colors -mb-px flex-shrink-0 ${
              activeTab === tab
                ? 'text-[#1D1D1F] border-b-2 border-[#1D1D1F]'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            {tab === 'prix' ? 'Prix PhoneSpot' : tab === 'revente' ? 'Prix de revente' : 'Cache & Scraping'}
          </button>
        ))}
      </div>

      {/* ── PRIX TAB ── */}
      {activeTab === 'prix' && (
        <>
          <p className="text-[14px] text-[#6E6E73] mb-8">
            Définissez les prix de rachat PhoneSpot. Laissez vide pour ne pas afficher la card.
          </p>

          <div className="flex flex-col gap-4 mb-8">
            {modelsData?.models.map((model) => {
              const storages = modelsData.storages[model] || []
              const isOpen = openModel === model
              return (
                <div key={model} className="border border-apple-border rounded-card overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-[#F5F5F7] transition-colors text-left"
                    onClick={() => setOpenModel(isOpen ? null : model)}
                  >
                    <span className="font-semibold text-[17px] text-[#1D1D1F]">{model}</span>
                    <svg
                      width="16" height="16" viewBox="0 0 16 16" fill="none"
                      className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    >
                      <path d="M4 6l4 4 4-4" stroke="#6E6E73" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="border-t border-apple-border p-5 bg-[#F5F5F7]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[14px]">
                          <thead>
                            <tr>
                              <th className="text-left text-[#6E6E73] font-medium pb-3 pr-4">Capacité</th>
                              {CONDITIONS.map((c) => (
                                <th key={c} className="text-left text-[#6E6E73] font-medium pb-3 pr-4">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {storages.map((storage) => (
                              <tr key={storage} className="border-t border-apple-border">
                                <td className="py-2 pr-4 text-[#1D1D1F] font-medium">{formatStorage(storage)}</td>
                                {CONDITIONS.map((cond) => {
                                  const key = `${model}_${storage}_${cond}`
                                  return (
                                    <td key={cond} className="py-2 pr-4">
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="—"
                                        value={prices[key] ?? ''}
                                        onChange={(e) => setPrices({ ...prices, [key]: e.target.value })}
                                        className="w-20 border border-apple-border rounded-[8px] px-2 py-1.5 text-[14px] bg-white focus:border-[#0071E3] focus:outline-none transition-colors"
                                      />
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={save}>Enregistrer</Button>
            {savedMsg && <p className="text-[14px] text-[#34C759]">{savedMsg}</p>}
            {saveError && <p className="text-[14px] text-[#FF3B30]">{saveError}</p>}
          </div>
        </>
      )}

      {/* ── REVENTE TAB ── */}
      {activeTab === 'revente' && (() => {
        const mergedPrices = { ...resalePrices, ...resaleDirty }
        return (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
              <div>
                <h2 className="font-bold text-[20px] text-[#1D1D1F]">Prix de revente conseillés</h2>
                <p className="text-[13px] text-[#6E6E73] mt-0.5">
                  Prix affichés dans la section "Vendre vous-même" de la page résultats.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={resetResale}
                  className="border border-[#D2D2D7] text-[#6E6E73] rounded-pill px-4 py-2 text-sm hover:bg-[#F5F5F7] transition-colors"
                >
                  Réinitialiser les défauts
                </button>
                <button
                  onClick={saveResale}
                  className="bg-[#1D1D1F] text-white rounded-pill px-4 py-2 text-sm font-semibold hover:opacity-85 transition-opacity"
                >
                  Enregistrer tout
                </button>
              </div>
            </div>

            {resaleSavedMsg && <p className="text-[14px] text-[#34C759] mb-4">{resaleSavedMsg}</p>}
            {resaleSaveError && <p className="text-[14px] text-[#FF3B30] mb-4">{resaleSaveError}</p>}

            <div className="flex flex-col gap-3 mb-8">
              {modelsData?.models.map((model) => {
                const storages = modelsData.storages[model] || []
                const isOpen = openResaleModel === model
                return (
                  <div key={model} className="border border-apple-border rounded-card overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-[#F5F5F7] transition-colors text-left"
                      onClick={() => setOpenResaleModel(isOpen ? null : model)}
                    >
                      <span className="font-semibold text-[17px] text-[#1D1D1F]">{model}</span>
                      <svg
                        width="16" height="16" viewBox="0 0 16 16" fill="none"
                        className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      >
                        <path d="M4 6l4 4 4-4" stroke="#6E6E73" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="border-t border-apple-border p-5 bg-[#F5F5F7]">
                        <div className="overflow-x-auto">
                          <table className="w-full text-[14px]">
                            <thead>
                              <tr>
                                <th className="text-left text-[#6E6E73] font-medium pb-3 pr-4">Capacité</th>
                                {CONDITIONS.map((c) => (
                                  <th key={c} className="text-left text-[#6E6E73] font-medium pb-3 pr-4">{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {storages.map((storage) => (
                                <tr key={storage} className="border-t border-apple-border">
                                  <td className="py-2 pr-4 text-[#1D1D1F] font-medium">{formatStorage(storage)}</td>
                                  {CONDITIONS.map((cond) => {
                                    const key = `${model}_${storage}_${cond}`
                                    const isDirty = key in resaleDirty
                                    return (
                                      <td key={cond} className="py-2 pr-4">
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min={0}
                                            step={5}
                                            value={mergedPrices[key] ?? ''}
                                            onChange={(e) =>
                                              setResaleDirty((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                                            }
                                            className="w-20 border rounded-[8px] px-2 py-1.5 text-[14px] bg-white focus:outline-none transition-colors"
                                            style={{ borderColor: isDirty ? '#1D1D1F' : '#D2D2D7' }}
                                          />
                                          <span className="text-[13px] text-[#6E6E73]">€</span>
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}

      {/* ── CACHE TAB ── */}
      {activeTab === 'cache' && (
        <>
          {/* Full refresh button */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={startFullRefresh}
                disabled={refreshRunning}
                className="bg-[#1D1D1F] text-white rounded-pill px-6 py-3 text-[15px] font-semibold hover:opacity-85 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {refreshRunning && (
                  <svg className="animate-spin flex-shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeDasharray="20 18" strokeLinecap="round"/>
                  </svg>
                )}
                Actualiser tous les prix
              </button>
            </div>

            <p className="text-[13px] text-[#6E6E73]">
              Lance le scraping complet de tous les modèles iPhone auprès de tous les repreneurs
              (Swappie, BackMarket, EasyCash, eRecycle, MagicRecycle et autres).
              Durée estimée : 3 à 8 minutes.
            </p>

            {/* Progress bar */}
            {refreshRunning && refreshState && refreshState.total > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-[#E5E5EA] rounded-full w-full overflow-hidden">
                  <div
                    className="h-2 bg-[#1D1D1F] rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[14px] text-[#6E6E73] mt-2">
                  {refreshState.progress} / {refreshState.total} modèles actualisés
                </p>
                {refreshState.current_model && (
                  <p className="text-[13px] text-[#6E6E73] mt-1">
                    En cours : {refreshState.current_model}...
                  </p>
                )}
              </div>
            )}

            {/* Success message */}
            {successMsg && (
              <p className="text-[14px] font-medium text-[#34C759] mt-3">{successMsg}</p>
            )}
          </div>

          {/* Cache status section */}
          <div>
            {/* Section header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="font-bold text-[20px] text-[#1D1D1F]">État du cache</h2>
                <p className="text-[13px] text-[#6E6E73] mt-0.5">
                  {cacheRows.length} modèle{cacheRows.length !== 1 ? 's' : ''} en cache
                  {lastCheckedStr ? ` · Dernière vérification ${lastCheckedStr}` : ''}
                </p>
              </div>
              <button
                onClick={fetchCacheStatus}
                disabled={cacheLoading}
                className="border border-[#D2D2D7] text-[#1D1D1F] rounded-pill px-4 py-2 text-sm hover:bg-[#F5F5F7] transition-colors disabled:opacity-40"
              >
                ↻ Actualiser la liste
              </button>
            </div>

            {/* Global stats pills */}
            {!cacheLoading && cacheRows.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-4 py-2 text-sm font-medium text-[#34C759]">
                  ✓ {freshCount} frais
                </span>
                {staleCount > 0 && (
                  <span className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-4 py-2 text-sm font-medium text-[#FF9500]">
                    ⚠ {staleCount} ancien{staleCount !== 1 ? 's' : ''}
                  </span>
                )}
                {missingCount > 0 && (
                  <span className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-4 py-2 text-sm font-medium text-[#FF3B30]">
                    ✕ {missingCount} manquant{missingCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Search / filter */}
            {cacheRows.length > 0 && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Filtrer par modèle..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="border border-[#D2D2D7] rounded-[10px] px-4 py-2.5 w-full max-w-xs text-sm text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none transition-colors"
                />
              </div>
            )}

            {/* Loading */}
            {cacheLoading && (
              <div className="flex items-center justify-center py-16 text-[#6E6E73] text-[15px]">
                Chargement...
              </div>
            )}

            {/* Empty state */}
            {!cacheLoading && cacheRows.length === 0 && (
              <div className="flex flex-col items-center py-16">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="6" y="10" width="28" height="22" rx="4" stroke="#D2D2D7" strokeWidth="2"/>
                  <path d="M6 16h28" stroke="#D2D2D7" strokeWidth="2"/>
                  <circle cx="12" cy="13" r="1.5" fill="#D2D2D7"/>
                  <circle cx="17" cy="13" r="1.5" fill="#D2D2D7"/>
                  <path d="M14 24h12M14 28h8" stroke="#D2D2D7" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p className="font-semibold text-[17px] text-[#1D1D1F] mt-4">Aucun cache disponible</p>
                <p className="text-[14px] text-[#6E6E73] mt-1 text-center">
                  Cliquez sur 'Actualiser tous les prix' pour lancer le premier scraping.
                </p>
              </div>
            )}

            {/* Row cards */}
            {!cacheLoading && filteredRows.length > 0 && (
              <div>
                {filteredRows.map((row) => {
                  const isMissing = isMissingRow(row)
                  const isRefreshing = refreshingModels.has(row.model)
                  const cm = row as CacheModel
                  const year = modelYear(row.model)
                  const age = !isMissing ? ageText(cm.age_minutes) : null

                  let badge: React.ReactNode
                  if (isMissing || cm.error) {
                    badge = (
                      <span className="inline-block rounded-pill px-3 py-1 text-xs font-medium bg-[#FF3B30]/10 text-[#FF3B30]">
                        ✕ Manquant
                      </span>
                    )
                  } else if (cm.fresh) {
                    badge = (
                      <span className="inline-block rounded-pill px-3 py-1 text-xs font-medium bg-[#34C759]/10 text-[#34C759]">
                        ✓ Frais
                      </span>
                    )
                  } else {
                    badge = (
                      <span className="inline-block rounded-pill px-3 py-1 text-xs font-medium bg-[#FF9500]/10 text-[#FF9500]">
                        ⚠ Ancien
                      </span>
                    )
                  }

                  return (
                    <div
                      key={row.model}
                      className="bg-white border border-[#D2D2D7] rounded-[14px] px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 mb-2 hover:bg-[#F5F5F7] transition-colors duration-150"
                    >
                      {/* Col 1 — Model name */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px] sm:text-[15px] text-[#1D1D1F] truncate">{row.model}</p>
                        {year && <p className="text-[12px] text-[#6E6E73] mt-0.5">{year}</p>}
                      </div>

                      {/* Col 2 — Last update (hidden on mobile) */}
                      <div className="hidden sm:block flex-none w-36">
                        {isMissing ? (
                          <span className="text-[14px] text-[#D2D2D7]">—</span>
                        ) : (
                          <span className="text-[14px]" style={{ color: age!.color }}>
                            {age!.text}
                          </span>
                        )}
                      </div>

                      {/* Col 3 — Status badge */}
                      <div className="flex-none">{badge}</div>

                      {/* Col 4 — Action */}
                      <div className="flex-none flex justify-end">
                        {isRefreshing ? (
                          <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6" stroke="#6E6E73" strokeWidth="2" strokeDasharray="20 18" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <button
                            onClick={() => refreshModel(row.model)}
                            disabled={refreshRunning}
                            className="border border-[#D2D2D7] text-[#1D1D1F] rounded-pill px-3 py-1.5 text-sm hover:bg-[#1D1D1F] hover:text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Actualiser
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Filter no-results */}
            {!cacheLoading && cacheRows.length > 0 && filteredRows.length === 0 && (
              <p className="text-[14px] text-[#6E6E73] text-center py-8">
                Aucun modèle ne correspond à "{filterQuery}".
              </p>
            )}
          </div>

          <p className="text-[13px] text-[#6E6E73] mt-6">
            Actualisation automatique tous les jours à 07h00 et 19h00 (heure de Paris).
          </p>
        </>
      )}
    </div>
  )
}
