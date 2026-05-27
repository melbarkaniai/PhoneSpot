import { useSearchParams, Link } from 'react-router-dom'
import { usePrices } from '../hooks/usePrices'
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import FadeSection from '../components/FadeSection'
import ListingGenerator from '../components/ListingGenerator'
import PhotoGuide from '../components/PhotoGuide'
import PublishStrategy from '../components/PublishStrategy'

const SOURCES = ['Swappie', 'BackMarket', 'EasyCash', 'eRecycle', 'MagicRecycle']
const LOADER_DURATION = 2500
const ITEM_INTERVAL = 400
const FADE_DURATION = 300

function formatStorage(raw: string): string {
  if (raw === '1024GB') return '1 To'
  return raw.replace('GB', ' Go')
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000)
  if (diff < 1) return 'à l\'instant'
  if (diff === 1) return 'il y a 1 min'
  return `il y a ${diff} min`
}

function formatScrapedAt(isoString: string): string {
  const date = new Date(isoString)
  const months = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']
  const day = date.getDate()
  const month = months[date.getMonth()]
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day} ${month} à ${hours}h${minutes}`
}

function SkeletonCard() {
  return (
    <div className="bg-[#F5F5F7] rounded-card h-24 animate-pulse" />
  )
}

interface LoadingScreenProps {
  model: string
  storage: string
  condition: string
  fading: boolean
}

function LoadingScreen({ model, storage, condition, fading }: LoadingScreenProps) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [checkedCount, setCheckedCount] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < SOURCES.length; i++) {
      timers.push(setTimeout(() => setVisibleCount(i + 1), i * ITEM_INTERVAL))
      timers.push(setTimeout(() => setCheckedCount(i + 1), i * ITEM_INTERVAL + 300))
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  const progress = Math.min(100, (visibleCount / SOURCES.length) * 100)

  return (
    <div
      className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center px-6"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? `opacity ${FADE_DURATION}ms ease` : undefined,
      }}
    >
      <div className="w-full max-w-sm">
        {/* Pill tag */}
        <div className="flex justify-center mb-6">
          <span className="bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] text-[13px] rounded-pill px-4 py-1.5">
            Analyse en cours — {model} {formatStorage(storage)} {condition}
          </span>
        </div>

        {/* Title */}
        <h2 className="font-bold text-[22px] text-[#1D1D1F] text-center tracking-[-0.2px] mb-8">
          Nous interrogeons les repreneurs...
        </h2>

        {/* Source list */}
        <div className="flex flex-col gap-3 mb-8">
          {SOURCES.map((source, i) => {
            const visible = i < visibleCount
            const checked = i < checkedCount
            return (
              <div
                key={source}
                className="flex items-center gap-3"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'opacity 0.25s ease, transform 0.25s ease',
                }}
              >
                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                  {checked ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="10" fill="#34C759" />
                      <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="animate-spin">
                      <circle cx="10" cy="10" r="8" stroke="#D2D2D7" strokeWidth="2"/>
                      <path d="M10 2a8 8 0 0 1 8 8" stroke="#0071E3" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-[15px] text-[#1D1D1F] font-medium">{source}</span>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-[#F5F5F7] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[#0071E3] rounded-full"
            style={{
              width: `${progress}%`,
              transition: `width ${ITEM_INTERVAL}ms ease`,
            }}
          />
        </div>

        {/* Counter */}
        <p className="text-center text-[13px] text-[#6E6E73]">
          Comparaison de {visibleCount} repreneur{visibleCount > 1 ? 's' : ''} en cours
        </p>
      </div>
    </div>
  )
}

interface SourceResult {
  source: string
  price: number
  url: string
}

function safeUrl(url: string): string {
  if (!url) return '#'
  if (url.startsWith('https://') || url.startsWith('http://')) return url
  return '#'
}

export default function Results() {
  useLayoutEffect(() => {
    const el = document.documentElement
    el.style.scrollBehavior = 'auto'
    el.scrollTop = 0
    document.body.scrollTop = 0
    el.style.scrollBehavior = ''
  }, [])

  const [showLoader, setShowLoader] = useState(true)
  const [fading, setFading] = useState(false)
  const loaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loaderTimerRef.current = setTimeout(() => {
      setFading(true)
      fadeTimerRef.current = setTimeout(() => setShowLoader(false), FADE_DURATION)
    }, LOADER_DURATION)
    return () => {
      if (loaderTimerRef.current) clearTimeout(loaderTimerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  const [params] = useSearchParams()
  const model = params.get('model') || ''
  const storage = params.get('storage') || ''
  const condition = params.get('condition') || ''
  const battery = Number(params.get('battery') || 90)

  const { data, isLoading, error, retry } = usePrices(model)
  const [phonespotPrice, setPhonespotPrice] = useState<number | null>(null)
  const [resalePrice, setResalePrice] = useState<number | null>(null)

  useEffect(() => {
    if (!model || !storage || !condition) return
    fetch(`/api/phonespot-price?model=${encodeURIComponent(model)}&storage=${encodeURIComponent(storage)}&condition=${encodeURIComponent(condition)}`)
      .then((r) => r.json())
      .then((d) => setPhonespotPrice(d.prix))
      .catch(() => {})
  }, [model, storage, condition])

  useEffect(() => {
    if (!model || !storage || !condition) return
    fetch(`/api/resale-prices?model=${encodeURIComponent(model)}&storage=${encodeURIComponent(storage)}&condition=${encodeURIComponent(condition)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.prix) setResalePrice(d.prix)
      })
      .catch(() => {
        setResalePrice(Math.round(prixMaxPro * 1.45))
      })
  }, [model, storage, condition])

  const results: SourceResult[] = (() => {
    if (!data) return []
    const comp = data.comparison?.[storage]?.[condition]
    if (!comp) return []

    // Build URL map from raw entries — keyed by source+storage+condition
    const urlMap: Record<string, string> = {}
    data.raw.forEach((r) => {
      const key = r.source + r.storage + r.condition
      if (!urlMap[key]) urlMap[key] = r.url
    })

    return Object.entries(comp)
      .map(([source, price]) => ({
        source,
        price: Number(price),
        url: urlMap[source + storage + condition] || '#',
      }))
      .sort((a, b) => b.price - a.price)
  })()

  const prixMaxPro = results[0]?.price ?? 0
  const waNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '33600000000'
  const waText = encodeURIComponent(`Bonjour, je veux vendre mon ${model} ${storage} état ${condition} batterie ${battery}%`)
  const waUrl = `https://wa.me/${waNumber}?text=${waText}`

  const storageLabel = formatStorage(storage)
  const metaTitle = model && storage
    ? `Prix reprise ${model} ${storageLabel} — Comparez 10+ offres | PhoneSpot`
    : 'Résultats de reprise iPhone | PhoneSpot'
  const metaDescription = model && storage && condition
    ? `Comparez les meilleures offres de rachat pour votre ${model} ${storageLabel} en ${condition}. Swappie, BackMarket, EasyCash et 7 autres repreneurs comparés en temps réel.`
    : 'Comparez les offres de rachat iPhone de 10+ repreneurs en temps réel.'
  const canonicalUrl = model && storage && condition
    ? `https://phonespot.fr/revendre?model=${encodeURIComponent(model)}&storage=${encodeURIComponent(storage)}&condition=${encodeURIComponent(condition)}`
    : 'https://phonespot.fr/revendre'

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:locale" content="fr_FR" />
      </Helmet>

      {showLoader && (
        <LoadingScreen model={model} storage={storage} condition={condition} fading={fading} />
      )}

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <Link to="/" className="inline-flex items-center gap-1 text-[14px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors mb-8">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Nouvelle estimation
        </Link>

        <h1 className="font-bold text-[26px] sm:text-[32px] text-[#1D1D1F] tracking-[-0.3px] mb-2">
          {model} · {formatStorage(storage)}
        </h1>
        <p className="text-[15px] text-[#6E6E73] mb-1">
          État : {condition} · Batterie : {battery}%
        </p>
        {/** 
        {data?.scraped_at && (
          <p className="text-[14px] text-[#6E6E73] mb-10">
            Données mises à jour {timeAgo(data.scraped_at)}
          </p>
        )}
        */}

        {/* Stale data banner */}
        {!isLoading && (data as any)?.stale && (data as any)?.scraped_at && (
          <div className="flex items-center gap-3 bg-[#FFF8EE] border border-[#FFCC00] rounded-card px-4 py-3 mb-6">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 text-[#FF9500]">
              <path d="M9 1.5L16.5 15H1.5L9 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="9" cy="13" r="0.75" fill="currentColor"/>
            </svg>
            <p className="text-[13px] text-[#6E6E73]">
              Données du {formatScrapedAt((data as any).scraped_at)} — mise à jour en cours
            </p>
          </div>
        )}

        {/* BLOC 1 — Reprise professionnelle */}
        <section className="mb-4">
          <h2 className="font-bold text-[18px] text-[#1D1D1F] mb-1">Reprise professionnelle</h2>
          <p className="text-[14px] text-[#6E6E73] mb-5">Envoi postal · Paiement sous 5 à 10 jours selon le repreneur</p>

          {error ? (
            <div className="text-center py-12 px-4">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto mb-4 text-[#6E6E73]">
                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M20 11v9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3 className="font-semibold text-[17px] text-[#1D1D1F] mb-2">Prix temporairement indisponibles</h3>
              <p className="text-[14px] text-[#6E6E73] mb-6">Une mise à jour est en cours. Réessayez dans quelques minutes.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-[#0071E3] text-white rounded-pill px-5 py-2.5 text-[15px] font-medium hover:bg-[#0077ED] transition-colors"
                >
                  Réessayer
                </button>
                <Link
                  to="/"
                  className="border border-[#D2D2D7] text-[#1D1D1F] rounded-pill px-5 py-2.5 text-[15px] font-medium hover:border-[#1D1D1F] transition-colors text-center"
                >
                  Nouvelle estimation
                </Link>
              </div>
              <p className="text-[13px] text-[#6E6E73] mt-6">
                Besoin d'une estimation rapide ?{' '}
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-[#0071E3] hover:underline">
                  Contactez-nous sur WhatsApp
                </a>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* PhoneSpot card */}
              {!isLoading && phonespotPrice !== null && (
                <div className="bg-[#1D1D1F] rounded-card p-4 sm:p-6 text-white">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="bg-white text-[#1D1D1F] text-[12px] font-medium rounded-pill px-3 py-1">
                      ⚡ Cash immédiat · Bordeaux
                    </span>
                    <span className="text-white font-semibold text-[15px]">PhoneSpot</span>
                  </div>
                  <p className="font-bold text-[28px] leading-none mb-2">{phonespotPrice}€</p>
                  <p className="text-[14px] text-white/70 mb-4">
                    Paiement cash le jour même. Déplacement possible sur Bordeaux.
                  </p>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { if (window.umami) window.umami.track('clic_whatsapp') }}
                    className="inline-block bg-white text-[#1D1D1F] rounded-pill px-5 py-2.5 text-[15px] font-medium hover:bg-white/90 transition-colors"
                  >
                    Nous contacter →
                  </a>
                </div>
              )}

              {/* Skeleton */}
              {isLoading && (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              )}

              {/* Repreneurs pros */}
              {!isLoading && results.map((r, i) => (
                <div key={r.source} className="bg-white border border-apple-border rounded-card p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <span className="text-[13px] text-[#6E6E73] w-7 flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] sm:text-[15px] text-[#1D1D1F] truncate">{r.source}</p>
                    <span className="inline-block mt-1 bg-[#F5F5F7] text-[#6E6E73] text-[12px] rounded-pill px-2.5 py-0.5">5–7 jours</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <span className="font-bold text-[22px] sm:text-[28px] text-[#1D1D1F]">{r.price}€</span>
                    <a
                      href={safeUrl(r.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => { if (window.umami) window.umami.track('clic_repreneur', { source: r.source }) }}
                      className="border border-[#0071E3] text-[#0071E3] rounded-pill px-3 sm:px-4 py-2 text-[13px] sm:text-[14px] font-medium hover:bg-[#0071E3] hover:text-white transition-all duration-200 whitespace-nowrap"
                    >
                      Voir l'offre →
                    </a>
                  </div>
                </div>
              ))}

              {!isLoading && !error && results.length === 0 && (
                <div className="bg-white border border-[#D2D2D7] rounded-card p-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-4 text-[#6E6E73]">
                    <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M21.5 21.5L28 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M10 14h8M14 10v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <h3 className="font-semibold text-[15px] text-[#1D1D1F] mb-1">Aucune offre disponible</h3>
                  <p className="text-[13px] text-[#6E6E73] mb-5">Aucun repreneur ne propose cette combinaison pour le moment.</p>
                  <Link
                    to="/"
                    className="inline-block bg-[#0071E3] text-white rounded-pill px-5 py-2.5 text-[15px] font-medium hover:bg-[#0077ED] transition-colors"
                  >
                    Modifier ma recherche
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Séparateur */}
        {!isLoading && prixMaxPro > 0 && (
          <>
            <div className="flex items-center gap-4 my-12">
              <div className="flex-1 h-px bg-[#D2D2D7]" />
              <span className="text-[14px] text-[#6E6E73] font-medium whitespace-nowrap">Ou vendez vous-même pour plus</span>
              <div className="flex-1 h-px bg-[#D2D2D7]" />
            </div>

            {/* BLOC 2 — Vendre soi-même */}
            <FadeSection>
              <section>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-8">
                  <div className="flex-1">
                    <h2 className="font-bold text-[24px] text-[#1D1D1F] tracking-[-0.2px] mb-2">
                      Vendez vous-même, on s'occupe du reste.
                    </h2>
                    <p className="text-[15px] text-[#6E6E73] mb-3">
                      En quelques secondes, obtenez une annonce prête à poster.{' '}
                      Prix conseillé :{' '}
                      <span className="text-[#1D1D1F] font-semibold">
                        {resalePrice ?? Math.round(prixMaxPro * 1.45)}€
                      </span>{' '}
                      sur Leboncoin, Facebook Marketplace ou Vinted.
                    </p>
                    <span className="inline-block bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] text-[13px] rounded-pill px-3 py-1">
                      {resalePrice ?? Math.round(prixMaxPro * 1.45)}€ sur le marché
                    </span>
                  </div>
                  <div className="hidden sm:flex flex-col gap-2 flex-shrink-0 pt-1">
                    {['Leboncoin', 'Facebook', 'Vinted'].map((p) => (
                      <span key={p} className="flex items-center justify-between gap-6 bg-white border border-[#D2D2D7] rounded-pill px-4 py-2 text-[13px]">
                        <span className="text-[#1D1D1F] font-medium">{p}</span>
                        <span className="text-[#34C759] font-medium">Optimisé ✓</span>
                      </span>
                    ))}
                  </div>
                </div>

                <ListingGenerator
                  model={model}
                  storage={storage}
                  condition={condition}
                  battery={battery}
                  prixMaxPro={resalePrice ?? prixMaxPro}
                />

                <div className="mt-10">
                  <PhotoGuide />
                </div>

                <div className="mt-10">
                  <PublishStrategy prixMax={resalePrice ?? Math.round(prixMaxPro * 1.6)} />
                </div>
              </section>
            </FadeSection>
          </>
        )}
      </div>
    </>
  )
}
