import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useModels } from '../hooks/useModels'
import { CONDITIONS } from '../components/PhoneConditionPicker'

const SLUG_TO_MODEL: Record<string, string> = {
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
}

function formatStorage(raw: string): string {
  if (raw === '1024GB') return '1 To'
  return raw.replace('GB', ' Go')
}

export default function EstimerModel() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { data: modelsData } = useModels()

  const model = (slug && SLUG_TO_MODEL[slug]) || ''

  const [storage, setStorage] = useState('')
  const [condition, setCondition] = useState('Parfait')
  const [battery, setBattery] = useState(90)
  const [batteryUnknown, setBatteryUnknown] = useState(false)
  const [displayStep, setDisplayStep] = useState(2)
  const [animating, setAnimating] = useState(false)
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  useEffect(() => {
    if (!model) return
    fetch(`/api/prices/${encodeURIComponent(model)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.comparison) return
        const prices: number[] = []
        for (const storageData of Object.values(data.comparison as Record<string, Record<string, Record<string, number>>>)) {
          for (const condData of Object.values(storageData)) {
            for (const price of Object.values(condData)) {
              if (typeof price === 'number') prices.push(price)
            }
          }
        }
        if (prices.length > 0) setPriceRange({ min: Math.min(...prices), max: Math.max(...prices) })
      })
      .catch(() => {})
  }, [model])

  const storages = (model && modelsData?.storages[model]) || []

  const goToStep = useCallback((n: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setAnimating(true)
    timeoutRef.current = setTimeout(() => {
      setDisplayStep(n)
      setAnimating(false)
    }, 200)
  }, [])

  function submitForm() {
    const batteryValue = batteryUnknown ? 85 : battery
    const params = new URLSearchParams({ model, storage, condition, battery: String(batteryValue) })
    navigate(`/revendre?${params.toString()}`)
  }

  if (slug && !SLUG_TO_MODEL[slug]) return <Navigate to="/" replace />

  const metaTitle = `Prix reprise ${model} — Comparez 10+ offres de rachat | PhoneSpot`
  const metaDescription = `Combien vaut votre ${model} ? Comparez les offres de Swappie, BackMarket, EasyCash et 7 autres repreneurs. Estimation gratuite et immédiate.`

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={`https://phonespot.fr/estimer/${slug}`} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://phonespot.fr/estimer/${slug}`} />
        <meta property="og:locale" content="fr_FR" />
      </Helmet>

      {/* SEO intro */}
      <section className="bg-white pt-16 pb-8 px-6">
        <div className="max-w-[680px] mx-auto">
          <span className="inline-block bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] text-sm rounded-pill px-4 py-1.5 mb-5">
            Comparateur · {model}
          </span>
          <h1 className="font-bold text-[28px] md:text-[40px] text-[#1D1D1F] leading-[1.1] tracking-[-0.5px]">
            Combien vaut votre {model}&nbsp;?
          </h1>
          <p className="text-[16px] text-[#6E6E73] mt-3 leading-relaxed">
            Comparez les offres de rachat de 10+ repreneurs professionnels pour votre {model}. Swappie,
            BackMarket, EasyCash, eRecycle, MagicRecycle et d'autres, tous comparés en temps réel. Vendez
            au meilleur prix ou laissez notre IA rédiger votre annonce pour Leboncoin ou Facebook Marketplace.
          </p>
          {priceRange && (
            <p className="inline-flex items-center gap-2 font-medium text-[15px] text-[#1D1D1F] mt-4 bg-[#F5F5F7] rounded-[10px] px-4 py-2.5">
              Prix de reprise constatés : entre{' '}
              <span className="font-bold">{priceRange.min}€</span>
              {' '}et{' '}
              <span className="font-bold">{priceRange.max}€</span>
              {' '}selon le repreneur
            </p>
          )}
        </div>
      </section>

      {/* Estimator wizard */}
      <section className="bg-white pb-20 px-6">
        <div className="max-w-[720px] mx-auto">

          {/* Progress bar */}
          <div className="flex items-start mb-8">
            {[
              { n: 1, label: 'Modèle' },
              { n: 2, label: 'Capacité' },
              { n: 3, label: 'État' },
              { n: 4, label: 'Batterie' },
            ].map((s, i) => (
              <Fragment key={s.n}>
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                    displayStep > s.n
                      ? 'bg-[#1D1D1F] text-white'
                      : displayStep === s.n
                      ? 'bg-[#1D1D1F] text-white ring-4 ring-[#1D1D1F]/10'
                      : 'bg-white border border-[#D2D2D7] text-[#6E6E73]'
                  }`}>
                    {displayStep > s.n ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : s.n}
                  </div>
                  <span className="text-xs text-[#6E6E73] mt-1 text-center">{s.label}</span>
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-px mt-4 mx-2 transition-colors duration-[400ms] ${
                    displayStep > s.n ? 'bg-[#1D1D1F]' : 'bg-[#D2D2D7]'
                  }`} />
                )}
              </Fragment>
            ))}
          </div>

          {/* Summary pills */}
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            <span className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-3 py-1.5 text-sm text-[#1D1D1F]">
              {model}
            </span>
            {displayStep >= 3 && storage && (
              <button
                type="button"
                onClick={() => { setStorage(''); goToStep(2) }}
                className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-3 py-1.5 text-sm text-[#1D1D1F] flex items-center gap-1.5 hover:border-[#6E6E73] transition-colors cursor-pointer"
              >
                {formatStorage(storage)} <span className="text-xs text-[#6E6E73]">✕</span>
              </button>
            )}
            {displayStep >= 4 && (
              <button
                type="button"
                onClick={() => { setCondition('Parfait'); goToStep(3) }}
                className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-3 py-1.5 text-sm text-[#1D1D1F] flex items-center gap-1.5 hover:border-[#6E6E73] transition-colors cursor-pointer"
              >
                {condition} <span className="text-xs text-[#6E6E73]">✕</span>
              </button>
            )}
          </div>

          {/* Step content */}
          <div key={displayStep} className={animating ? 'opacity-0' : 'step-enter-active'}>

            {/* STEP 2 — CAPACITÉ */}
            {displayStep === 2 && (
              <div>
                <h2 className="font-bold text-[24px] sm:text-[32px] text-[#1D1D1F] text-center mb-2 tracking-[-0.3px]">
                  Quelle capacité ?
                </h2>
                <p className="text-[15px] text-[#6E6E73] text-center mb-10">
                  {model} — choisissez le stockage
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {storages.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setStorage(s); goToStep(3) }}
                      className={`px-8 py-4 rounded-[14px] border cursor-pointer transition-all duration-200 ${
                        storage === s
                          ? 'bg-[#1D1D1F] border-[#1D1D1F] text-white scale-[1.04]'
                          : 'bg-white border-[#D2D2D7] text-[#1D1D1F] hover:border-[#6E6E73] hover:scale-[1.02]'
                      }`}
                    >
                      <span className="font-semibold text-[18px]">{formatStorage(s)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3 — ÉTAT */}
            {displayStep === 3 && (
              <div>
                <button
                  type="button"
                  onClick={() => { setStorage(''); goToStep(2) }}
                  className="flex items-center gap-1 text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors mb-8 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Capacité
                </button>
                <h2 className="font-bold text-[24px] sm:text-[32px] text-[#1D1D1F] text-center mb-2 tracking-[-0.3px]">
                  Dans quel état est votre iPhone ?
                </h2>
                <p className="text-[15px] text-[#6E6E73] text-center mb-10">
                  {model} · {formatStorage(storage)}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {CONDITIONS.map(cond => {
                    const selected = condition === cond.value
                    return (
                      <button
                        key={cond.value}
                        type="button"
                        onClick={() => { setCondition(cond.value); goToStep(4) }}
                        className={`flex flex-col items-center text-center p-6 rounded-[20px] cursor-pointer transition-all duration-200 ${
                          selected
                            ? 'bg-white border-2 border-[#1D1D1F] -translate-y-1 shadow-md'
                            : 'bg-white border border-[#D2D2D7] hover:border-[#6E6E73] hover:-translate-y-0.5'
                        }`}
                      >
                        {cond.svg}
                        <p className="font-bold text-[15px] text-[#1D1D1F] mt-4">{cond.label}</p>
                        <p className="text-[13px] text-[#6E6E73] mt-1 leading-snug">{cond.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 4 — BATTERIE */}
            {displayStep === 4 && (
              <div>
                <button
                  type="button"
                  onClick={() => { setCondition('Parfait'); goToStep(3) }}
                  className="flex items-center gap-1 text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors mb-8 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  État
                </button>
                <h2 className="font-bold text-[24px] sm:text-[32px] text-[#1D1D1F] text-center mb-2 tracking-[-0.3px]">
                  Quelle est la santé de votre batterie ?
                </h2>

                {!batteryUnknown ? (
                  <>
                    <p className="text-[15px] text-[#6E6E73] text-center mb-10">
                      Trouvez-la dans Réglages → Batterie → État de la batterie
                    </p>
                    <div className="text-center mb-8">
                      <p className="leading-none">
                        <span className="font-bold text-[80px] text-[#1D1D1F]">{battery}</span>
                        <span className="font-light text-[40px] text-[#6E6E73]">%</span>
                      </p>
                      <p className={`font-medium text-[16px] mt-2 ${
                        battery >= 90 ? 'text-[#34C759]' : battery >= 80 ? 'text-[#FF9500]' : 'text-[#FF3B30]'
                      }`}>
                        {battery >= 90 ? 'Excellente' : battery >= 80 ? 'Bonne' : 'Correcte'}
                      </p>
                      <p className="text-[13px] text-[#6E6E73] mt-1">
                        La santé batterie influence directement le prix de revente.
                      </p>
                    </div>
                    <div className="max-w-[400px] mx-auto">
                      <input
                        type="range"
                        min={70}
                        max={100}
                        step={1}
                        value={battery}
                        onChange={(e) => setBattery(Number(e.target.value))}
                        className="slider-custom w-full"
                        style={{
                          background: `linear-gradient(to right, #1D1D1F 0%, #1D1D1F ${((battery - 70) / 30) * 100}%, #E5E5EA ${((battery - 70) / 30) * 100}%, #E5E5EA 100%)`
                        }}
                      />
                      <div className="flex justify-between mt-2">
                        <span className="text-xs text-[#6E6E73]">70%</span>
                        <span className="text-xs text-[#6E6E73]">100%</span>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 mt-6">
                        {[
                          { label: '70–79%', mid: 75, active: battery <= 79 },
                          { label: '80–89%', mid: 85, active: battery >= 80 && battery <= 89 },
                          { label: '90–100%', mid: 95, active: battery >= 90 },
                        ].map(btn => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() => setBattery(btn.mid)}
                            className={`rounded-pill px-4 py-2 text-sm transition-colors duration-200 cursor-pointer border ${
                              btn.active
                                ? 'border-[#1D1D1F] text-[#1D1D1F] bg-white'
                                : 'border-[#D2D2D7] text-[#6E6E73] bg-white hover:border-[#6E6E73]'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                      <div className="text-center mt-5">
                        <button
                          type="button"
                          onClick={() => setBatteryUnknown(true)}
                          className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer hover:underline underline-offset-2"
                        >
                          Je ne connais pas la santé de ma batterie
                        </button>
                      </div>
                    </div>
                    <div className="max-w-[400px] mx-auto mt-10">
                      <button
                        type="button"
                        onClick={submitForm}
                        className="w-full bg-[#1D1D1F] text-white rounded-pill py-4 text-[15px] font-semibold hover:opacity-85 transition-opacity duration-200 cursor-pointer"
                      >
                        Voir les prix →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[15px] text-[#6E6E73] text-center mb-10">
                      Pas de souci, on estimera avec une valeur standard.
                    </p>
                    <div className="text-center mb-10">
                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-6">
                        <circle cx="24" cy="24" r="22" stroke="#D2D2D7" strokeWidth="2"/>
                        <path d="M19 18.5c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.25-1.49 4.16-3.54 4.79L24 29" stroke="#D2D2D7" strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="24" cy="33" r="1.5" fill="#D2D2D7"/>
                      </svg>
                      <p className="font-semibold text-[18px] text-[#1D1D1F] mb-2">Pas de problème</p>
                      <p className="text-[14px] text-[#6E6E73] max-w-[280px] mx-auto leading-relaxed">
                        On utilisera 85% comme valeur par défaut — la moyenne constatée sur les iPhones d'occasion.
                      </p>
                    </div>
                    <div className="max-w-[400px] mx-auto">
                      <button
                        type="button"
                        onClick={submitForm}
                        className="w-full bg-[#1D1D1F] text-white rounded-pill py-4 text-[15px] font-semibold hover:opacity-85 transition-opacity duration-200 cursor-pointer"
                      >
                        Voir les prix →
                      </button>
                      <div className="text-center mt-4">
                        <button
                          type="button"
                          onClick={() => setBatteryUnknown(false)}
                          className="text-[13px] text-[#0071E3] hover:underline cursor-pointer"
                        >
                          Finalement, je la connais
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </section>
    </>
  )
}
