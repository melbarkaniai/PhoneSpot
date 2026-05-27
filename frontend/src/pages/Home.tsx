import { useState, useEffect, useRef, Fragment, memo, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { gsap } from 'gsap'
import { useModels } from '../hooks/useModels'
import { CONDITIONS as PHONE_CONDITIONS } from '../components/PhoneConditionPicker'
import Slider from '../components/Slider'
import FadeSection from '../components/FadeSection'

/* ─── Utilities ─────────────────────────────────────────────────────────── */

function formatStorage(raw: string): string {
  if (raw === '1024GB') return '1 To'
  return raw.replace('GB', ' Go')
}

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '33600000000'

/* ─── Custom Select ──────────────────────────────────────────────────────── */

interface SelectOption { value: string; label: string }
interface SelectGroup { label?: string; options: SelectOption[] }

interface CustomSelectProps {
  value: string
  onChange: (v: string) => void
  placeholder: string
  groups: SelectGroup[]
  disabled?: boolean
}

function CustomSelect({ value, onChange, placeholder, groups, disabled }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const selectedLabel = groups.flatMap(g => g.options).find(o => o.value === value)?.label

  return (
    <div ref={ref} className={`relative ${disabled ? 'opacity-35 pointer-events-none' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full border rounded-[14px] px-5 py-4 bg-white flex justify-between items-center cursor-pointer transition-colors duration-200 ${
          open ? 'border-[#1D1D1F]' : 'border-[#D2D2D7] hover:border-[#6E6E73]'
        }`}
      >
        <span className={selectedLabel ? 'font-medium text-[16px] text-[#1D1D1F]' : 'text-[16px] text-[#6E6E73]'}>
          {selectedLabel ?? placeholder}
        </span>
        <svg
          width="18" height="18" viewBox="0 0 18 18" fill="none"
          className={`flex-shrink-0 text-[#6E6E73] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4.5 6.75l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 w-full bg-white border border-[#D2D2D7] rounded-[14px] mt-1 shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden z-50 max-h-[320px] overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="px-4 py-2 text-xs text-[#6E6E73] uppercase tracking-wider bg-[#F5F5F7] sticky top-0">
                  {group.label}
                </div>
              )}
              {group.options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`w-full px-5 py-3.5 text-[16px] text-left cursor-pointer transition-colors duration-150 flex justify-between items-center border-b border-[#F5F5F7] last:border-b-0 ${
                    opt.value === value
                      ? 'bg-[#F5F5F7] font-medium text-[#1D1D1F]'
                      : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                      <path d="M3 8l4 4 6-6" stroke="#1D1D1F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Model grouping ─────────────────────────────────────────────────────── */

const GROUP_RULES: { label: string; test: (m: string) => boolean }[] = [
  { label: 'iPhone 17', test: m => m.startsWith('iPhone 17') },
  { label: 'iPhone 16', test: m => m.startsWith('iPhone 16') },
  { label: 'iPhone 15', test: m => m.startsWith('iPhone 15') },
  { label: 'iPhone 14', test: m => m.startsWith('iPhone 14') },
  { label: 'iPhone 13', test: m => m.startsWith('iPhone 13') },
  { label: 'iPhone 12', test: m => m.startsWith('iPhone 12') },
  //{ label: 'iPhone 11 et avant', test: m => m.startsWith('iPhone 11') },
]

function groupModels(models: string[]): SelectGroup[] {
  const assigned = new Set<string>()
  const result: SelectGroup[] = []
  for (const rule of GROUP_RULES) {
    const matching = models.filter(m => !assigned.has(m) && rule.test(m))
    if (matching.length > 0) {
      result.push({ label: rule.label, options: matching.map(m => ({ value: m, label: m })) })
      matching.forEach(m => assigned.add(m))
    }
  }
  return result
}

const DEFAULT_MODELS = [
  'iPhone 16 Pro Max',
  'iPhone 16 Pro',
  'iPhone 15 Pro Max',
  'iPhone 15 Pro',
  'iPhone 14 Pro',
  'iPhone 13 Pro',
]

function getModelYear(m: string): string {
  if (m.includes('17')) return '2025'
  if (m.includes('16')) return '2024'
  if (m.includes('15')) return '2023'
  if (m.includes('14')) return '2022'
  if (m.includes('13')) return '2021'
  if (m.includes('12')) return '2020'
  if (m.includes('11')) return '2019'
  return ''
}

/* ─── FAQ data ───────────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: 'Comment sont calculés les prix ?',
    a: "Nous interrogeons en temps réel les APIs de Swappie, BackMarket, Recommerce et plusieurs autres repreneurs. Les résultats sont actualisés régulièrement.",
  },
  {
    q: "Qu'est-ce que l'offre PhoneSpot Bordeaux ?",
    a: "C'est notre propre offre de rachat direct. Vous nous contactez sur WhatsApp, on fixe un rendez-vous sur Bordeaux ou alentours. Paiement cash ou virement immédiat le jour même. Aucun envoi postal requis.",
  },
  {
    q: "Pourquoi les repreneurs paient-ils moins que Leboncoin ?",
    a: "Les reconditionneurs prennent une marge pour réparer, remettre en état et revendre l'appareil. En vendant vous-même à un particulier, vous supprimez cet intermédiaire et pouvez récupérer 30 à 60% de plus.",
  },
  {
    q: "Mon iPhone est cassé, ça vaut quelque chose ?",
    a: "Oui. Sélectionnez 'Cassé' dans le formulaire. Certains repreneurs comme BackMarket rachètent les appareils endommagés pour les pièces détachées. Le prix sera inférieur mais non nul.",
  },
  {
    q: 'Est-ce que PhoneSpot stocke mes données ?',
    a: "Non. Aucun compte requis, aucun email demandé, aucune donnée personnelle collectée. Votre recherche est entièrement anonyme.",
  },
]

/* ─── Model grid (memoized to avoid re-renders on battery/condition changes) */

interface ModelGridProps {
  visibleModels: string[]
  selectedModel: string
  allModelsCount: number
  showAllModels: boolean
  onSelect: (m: string) => void
  onToggleAll: () => void
}

const ModelGrid = memo(function ModelGrid({
  visibleModels, selectedModel, allModelsCount, showAllModels, onSelect, onToggleAll,
}: ModelGridProps) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visibleModels.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onSelect(m)}
            className={`relative border rounded-[16px] px-4 py-5 cursor-pointer transition-all duration-200 text-center ${
              selectedModel === m
                ? 'border-2 border-[#1D1D1F] bg-[#F5F5F7]'
                : 'border border-[#D2D2D7] bg-white hover:border-[#6E6E73] hover:-translate-y-px'
            }`}
          >
            {selectedModel === m && (
              <span className="absolute top-3 right-3 w-5 h-5 bg-[#1D1D1F] rounded-full flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
            <p className="font-semibold text-[15px] text-[#1D1D1F]">{m}</p>
            <p className="text-[12px] text-[#6E6E73] mt-1">{getModelYear(m)}</p>
          </button>
        ))}
      </div>
      {allModelsCount > 6 && (
        <button
          type="button"
          onClick={onToggleAll}
          className="block mx-auto mt-4 text-sm text-[#0071E3] cursor-pointer hover:underline"
        >
          {showAllModels ? 'Voir moins ↑' : 'Voir tous les modèles ↓'}
        </button>
      )}
    </>
  )
})

/* ─── Stats Banner ───────────────────────────────────────────────────────── */

const CONSEILS = [
  "Un iPhone vendu avec sa boîte d'origine se vend en moyenne 15% plus cher entre particuliers.",
  "La santé batterie est le premier critère regardé par un acheteur. En dessous de 80%, le prix chute significativement.",
  "Mercredi et jeudi soir entre 19h et 21h sont les meilleurs créneaux pour poster une annonce sur Leboncoin.",
  "Désactiver iCloud avant la vente rassure immédiatement l'acheteur et accélère la transaction.",
  "Un iPhone vendu avec son câble et chargeur d'origine se vend plus vite, même si l'appareil est usagé.",
  "Les photos en lumière naturelle font vendre deux fois plus vite qu'en intérieur avec flash.",
  "Un écran sans rayure visible augmente la valeur perçue de 20% aux yeux d'un acheteur particulier.",
  "Préciser 'Face ID fonctionnel' dans le titre de votre annonce rassure et attire plus de contacts.",
  "Un iPhone reconditionné perd moins de valeur qu'un neuf — mais un iPhone jamais ouvert vaut encore plus.",
  "Répondre aux messages dans l'heure double vos chances de conclure la vente le jour même.",
]

const conseil = CONSEILS[Math.floor(Math.random() * CONSEILS.length)]

function StatsBanner() {
  return (
    <div className="bg-[#F5F5F7] border-t border-b border-[#D2D2D7] py-4 px-6">
      <div className="max-w-[900px] mx-auto flex items-center justify-center gap-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-none text-[#6E6E73]">
          <path d="M8 1a5 5 0 0 1 2 9.584V12H6v-1.416A5 5 0 0 1 8 1Z" stroke="#6E6E73" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M6 13.5h4M6.5 15h3" stroke="#6E6E73" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <p className="text-[13px] text-[#6E6E73] text-center">
          <span className="font-medium text-[#1D1D1F]">Le saviez-vous ? </span>{conseil}
        </p>
      </div>
    </div>
  )
}

/* ─── Home page ──────────────────────────────────────────────────────────── */

export default function Home() {
  const navigate = useNavigate()
  const { data: modelsData } = useModels()

  const [model, setModel] = useState('')
  const [storage, setStorage] = useState('')
  const [condition, setCondition] = useState('Parfait')
  const [battery, setBattery] = useState(90)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [displayStep, setDisplayStep] = useState(1)
  const [animating, setAnimating] = useState(false)
  const [showAllModels, setShowAllModels] = useState(false)
  const [batteryUnknown, setBatteryUnknown] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const defaultZ: Record<number, number> = { 1: 1, 2: 10, 3: 5 }

  const [activeStep, setActiveStep] = useState(1)
  const [userClickedStep, setUserClickedStep] = useState(false)
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (userClickedStep) {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current)
      return
    }
    stepIntervalRef.current = setInterval(() => {
      setActiveStep(prev => (prev === 3 ? 1 : prev + 1))
    }, 3000)
    return () => { if (stepIntervalRef.current) clearInterval(stepIntervalRef.current) }
  }, [userClickedStep])

  const heroLeftRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const left = heroLeftRef.current
    const form = formRef.current
    if (!left) return
    gsap.fromTo(
      left.querySelectorAll('.hero-eyebrow, h1, .hero-subtitle, .hero-buttons, .hero-stats'),
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power2.out' }
    )
    if (form) {
      gsap.fromTo(
        form,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8, delay: 0.4, ease: 'power2.out' }
      )
    }
  }, [])

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  const storagesForModel = model && modelsData?.storages[model] ? modelsData.storages[model] : []

  useEffect(() => { setStorage('') }, [model])

  const allModels = modelsData?.models ?? []
  const visibleModels = useMemo(() => {
    const defaultVisible = DEFAULT_MODELS.filter(m => allModels.includes(m))
    const extra = allModels.filter(m => !DEFAULT_MODELS.includes(m))
    return showAllModels
      ? [...defaultVisible, ...extra]
      : (defaultVisible.length ? defaultVisible : allModels.slice(0, 6))
  }, [allModels, showAllModels])

  const goToStep = useCallback((n: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setAnimating(true)
    timeoutRef.current = setTimeout(() => {
      setDisplayStep(n)
      setAnimating(false)
    }, 250)
  }, [])

  const handleModelSelect = useCallback((m: string) => {
    setModel(m)
    goToStep(2)
  }, [goToStep])

  const handleToggleAll = useCallback(() => {
    setShowAllModels(v => !v)
  }, [])

  function submitForm() {
    const batteryValue = batteryUnknown ? 85 : battery
    const params = new URLSearchParams({ model, storage, condition, battery: String(batteryValue) })
    navigate(`/revendre?${params.toString()}`)
    if (window.umami) window.umami.track('estimation', { model, storage, condition })
  }

  return (
    <>
      <Helmet>
        <title>PhoneSpot — Comparez le prix de reprise de votre iPhone</title>
        <meta name="description" content="Comparez les offres de rachat de 10+ repreneurs (Swappie, BackMarket, EasyCash...) et vendez votre iPhone au meilleur prix. Offre cash immédiate sur Bordeaux." />
        <meta name="keywords" content="reprise iPhone, rachat iPhone, comparateur reprise iPhone, vendre iPhone, meilleur prix iPhone" />
        <link rel="canonical" href="https://phonespot.fr" />
        <meta property="og:title" content="PhoneSpot — Comparez le prix de reprise de votre iPhone" />
        <meta property="og:description" content="Comparez 10+ repreneurs en temps réel. Vendez votre iPhone au meilleur prix." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://phonespot.fr" />
        <meta property="og:image" content="https://phonespot.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="PhoneSpot — Comparez le prix de reprise de votre iPhone" />
        <meta name="twitter:description" content="Comparez 10+ repreneurs en temps réel." />
      </Helmet>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-white pt-20 pb-16 px-6">
        <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row items-center gap-16">

          {/* Left column */}
          <div ref={heroLeftRef} className="flex-1 min-w-0">
            <span className="hero-eyebrow inline-block bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] text-sm rounded-pill px-4 py-1.5 mb-6">
              Comparateur n°1 sur iPhone · Bordeaux
            </span>
            <h1 className="font-bold text-[32px] md:text-[48px] text-[#1D1D1F] leading-[1.05] tracking-[-1px]">
              Le vrai prix de votre iPhone.&nbsp;
            </h1>
            <p className="hero-subtitle text-[16px] text-[#6E6E73] mt-4 max-w-[460px] leading-relaxed">
              Comparez les offres de rachat en temps réel.{' '}
              Ou vendez vous-même — on génère votre annonce.
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[13px] text-[#6E6E73]">Bientôt :</span>
              <span className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-3 py-1 text-xs text-[#6E6E73]">◷ Estimation par commune</span>
              <span className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-3 py-1 text-xs text-[#6E6E73]">◷ Simuler un échange</span>
            </div>
            <div className="hero-buttons flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8">
              <a
                href="#estimator"
                className="block text-center bg-[#0071E3] text-white rounded-pill px-6 py-3.5 text-[15px] font-medium hover:bg-[#0077ED] transition-colors duration-200"
              >
                Estimer mon iPhone →
              </a>
              <a
                href="#how-it-works"
                className="block text-center border border-[#D2D2D7] text-[#1D1D1F] rounded-pill px-6 py-3.5 text-[15px] font-medium hover:bg-[#F5F5F7] transition-colors duration-200"
              >
                Voir comment ça marche
              </a>
            </div>

            <div className="hero-stats flex flex-wrap items-center gap-4 sm:gap-6 mt-10">
              <div>
                <p className="font-bold text-[20px] sm:text-[26px] text-[#1D1D1F] leading-none">10+</p>
                <p className="text-[13px] sm:text-[14px] text-[#6E6E73] mt-1">repreneurs comparés</p>
              </div>
              <div className="hidden sm:block w-px h-8 bg-[#D2D2D7]" />
              <div>
                <p className="font-bold text-[20px] sm:text-[26px] text-[#1D1D1F] leading-none">Annonce IA</p>
                <p className="text-[13px] sm:text-[14px] text-[#6E6E73] mt-1">pour vendre vous-même</p>
              </div>
              <div className="hidden sm:block w-px h-8 bg-[#D2D2D7]" />
              <div>
                <p className="font-bold text-[20px] sm:text-[26px] text-[#1D1D1F] leading-none">100%</p>
                <p className="text-[13px] sm:text-[14px] text-[#6E6E73] mt-1">spécialisé iPhone</p>
              </div>
            </div>
          </div>

          {/* Right column — fan/deck of overlapping cards (desktop only) */}
          <div className="hidden md:block flex-shrink-0">
            <div className="relative w-[420px] h-[280px] animate-float">

              {/* Card 1 — back, result preview, rotate -4deg */}
              <div
                className="absolute left-0 top-[20px] rotate-[-4deg] transition-all duration-[250ms] ease-in-out hover:-translate-y-2 cursor-default"
                style={{ zIndex: hoveredCard === 1 ? 20 : defaultZ[1] }}
                onMouseEnter={() => setHoveredCard(1)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="w-[240px] bg-white border border-[#D2D2D7] rounded-[16px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                  <p className="text-xs text-[#6E6E73] mb-3">iPhone 14 Pro · 128 Go · Parfait</p>
                  <div className="bg-[#1D1D1F] rounded-lg px-3 py-2.5 mb-2 flex justify-between items-center">
                    <div>
                      <p className="text-white text-xs font-medium">PhoneSpot</p>
                      <p className="text-white/50 text-xs">⚡ Cash</p>
                    </div>
                    <p className="text-white font-bold text-[16px]">385 €</p>
                  </div>
                  <div className="bg-[#F5F5F7] rounded-lg px-3 py-2.5 mb-2 flex justify-between items-center">
                    <p className="text-[#1D1D1F] text-xs">Swappie</p>
                    <p className="text-[#1D1D1F] font-semibold text-[15px]">340 €</p>
                  </div>
                  <div className="bg-[#F5F5F7] rounded-lg px-3 py-2.5 flex justify-between items-center">
                    <p className="text-[#1D1D1F] text-xs">BackMarket</p>
                    <p className="text-[#1D1D1F] font-semibold text-[15px]">320 €</p>
                  </div>
                </div>
              </div>

              {/* Card 2 — middle, AI listing, rotate 1deg */}
              <div
                className="absolute left-[80px] top-[10px] rotate-[1deg] transition-all duration-[250ms] ease-in-out hover:-translate-y-2 cursor-default"
                style={{ zIndex: hoveredCard === 2 ? 20 : defaultZ[2] }}
                onMouseEnter={() => setHoveredCard(2)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="w-[240px] bg-white border border-[#D2D2D7] rounded-[16px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.10)]">
                  <span className="inline-block bg-[#F5F5F7] border border-[#D2D2D7] text-xs text-[#6E6E73] px-3 py-1 rounded-pill mb-3">
                    ✦ Annonce IA
                  </span>
                  <p className="text-xs text-[#6E6E73] uppercase tracking-wider mb-1">Titre</p>
                  <p className="font-semibold text-[12px] text-[#1D1D1F]">
                    iPhone 14 Pro 128Go – Parfait état
                  </p>
                  <p className="text-xs text-[#6E6E73] uppercase tracking-wider mt-2 mb-1">Description</p>
                  <p className="text-[11px] text-[#6E6E73] leading-[1.5]">
                    Aucune rayure, batterie 91%, vendu avec boîte d'origine...
                  </p>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs text-[#6E6E73]">Prix conseillé</span>
                    <span className="font-bold text-[14px] text-[#1D1D1F]">490 €</span>
                  </div>
                </div>
              </div>

              {/* Card 3 — front, sell yourself, rotate 3deg */}
              <div
                className="absolute left-[165px] top-0 rotate-[3deg] transition-all duration-[250ms] ease-in-out hover:-translate-y-2 cursor-default"
                style={{ zIndex: hoveredCard === 3 ? 20 : defaultZ[3] }}
                onMouseEnter={() => setHoveredCard(3)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="w-[240px] bg-[#F5F5F7] border border-[#D2D2D7] rounded-[16px] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold text-[12px] text-[#1D1D1F]">Vendre vous-même</p>
                    <span className="inline-block bg-white border border-[#D2D2D7] text-xs text-[#6E6E73] px-2 py-0.5 rounded-pill">
                      LBC · FB
                    </span>
                  </div>
                  <p className="font-bold text-[18px] text-[#1D1D1F] mt-1">Entre 420 € et 530 €</p>
                  <p className="text-[11px] text-[#6E6E73] mt-0.5">vs 385 € en reprise pro</p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-[#6E6E73] mb-1">
                      <span>Reprise pro</span>
                      <span>Vente directe</span>
                    </div>
                    <div className="h-1.5 bg-[#D2D2D7] rounded-full">
                      <div className="h-1.5 bg-[#1D1D1F] rounded-full w-[65%]" />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Banner ──────────────────────────────────────────────────── */}
      <StatsBanner />

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section id="how-it-works">
        <FadeSection className="bg-white py-20 px-6">
          <div className="max-w-[900px] mx-auto">
            <h2 className="font-bold text-[32px] text-[#1D1D1F] tracking-[-0.3px] text-center">
              En 3 étapes, trouvez le meilleur prix
            </h2>
            <p className="text-[#6E6E73] text-[15px] text-center mt-2 mb-12">Simple, rapide, sans inscription.</p>

            {/* Step selector */}
            <div className="flex items-start justify-center max-w-[480px] mx-auto">
              {[
                { id: 1, label: 'Décrivez' },
                { id: 2, label: 'Comparez' },
                { id: 3, label: 'Choisissez' },
              ].map((step, i) => (
                <Fragment key={step.id}>
                  <button
                    type="button"
                    onClick={() => { setActiveStep(step.id); setUserClickedStep(true) }}
                    className="flex flex-col items-center flex-shrink-0 cursor-pointer"
                  >
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center font-semibold text-[14px] transition-colors duration-200 ${
                      activeStep === step.id
                        ? 'bg-[#1D1D1F] border-[#1D1D1F] text-white'
                        : 'bg-white border-[#D2D2D7] text-[#6E6E73] hover:border-[#6E6E73] hover:text-[#1D1D1F]'
                    }`}>
                      {step.id}
                    </div>
                    <span className={`mt-2 text-xs sm:text-[14px] font-medium transition-colors duration-200 ${activeStep === step.id ? 'text-[#1D1D1F]' : 'text-[#6E6E73]'}`}>
                      {step.label}
                    </span>
                  </button>
                  {i < 2 && (
                    <div className={`flex-1 min-w-[20px] h-px mt-4 md:mt-5 mx-2 sm:mx-3 transition-colors duration-300 ${activeStep > step.id ? 'bg-[#1D1D1F]' : 'bg-[#D2D2D7]'}`} />
                  )}
                </Fragment>
              ))}
            </div>

            {/* Preview panel */}
            <div className="relative mt-10 md:h-[280px]">

              {/* Step 1 — Décrivez */}
              <div className={`md:absolute md:inset-0 transition-opacity duration-200 ${
                activeStep === 1 ? 'block opacity-100' : 'hidden md:block md:opacity-0 md:pointer-events-none'
              }`}>
                <div className="flex flex-col md:flex-row gap-8 h-full">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[22px] text-[#1D1D1F]">Décrivez votre iPhone</h3>
                    <p className="text-[15px] text-[#6E6E73] mt-2 leading-relaxed">
                      Modèle, capacité, état, santé batterie. Le formulaire s'adapte automatiquement à votre modèle.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {['24 modèles supportés', '4 états de condition', 'Santé batterie incluse'].map(t => (
                        <span key={t} className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-3 py-1 text-sm text-[#6E6E73]">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="hidden md:block flex-shrink-0">
                    <div className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-[16px] p-5 w-[260px]">
                      <p className="text-xs text-[#6E6E73] uppercase tracking-wider mb-2">Modèle</p>
                      <div className="bg-white border border-[#1D1D1F] rounded-[10px] px-4 py-3 flex justify-between items-center mb-3">
                        <span className="font-medium text-[15px] text-[#1D1D1F]">iPhone 14 Pro</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M4 6l4 4 4-4" stroke="#6E6E73" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <p className="text-xs text-[#6E6E73] uppercase tracking-wider mb-2">Capacité</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="bg-[#1D1D1F] text-white rounded-pill px-3 py-1.5 text-sm">128 Go</span>
                        <span className="border border-[#D2D2D7] text-[#6E6E73] rounded-pill px-3 py-1.5 text-sm">256 Go</span>
                        <span className="border border-[#D2D2D7] text-[#6E6E73] rounded-pill px-3 py-1.5 text-sm">512 Go</span>
                      </div>
                      <p className="text-xs text-[#6E6E73] uppercase tracking-wider mb-2">État</p>
                      <span className="bg-[#1D1D1F] text-white rounded-pill px-3 py-1.5 text-sm">Parfait</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 — Comparez */}
              <div className={`md:absolute md:inset-0 transition-opacity duration-200 ${
                activeStep === 2 ? 'block opacity-100' : 'hidden md:block md:opacity-0 md:pointer-events-none'
              }`}>
                <div className="flex flex-col md:flex-row gap-8 h-full">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[22px] text-[#1D1D1F]">10+ repreneurs comparés instantanément</h3>
                    <p className="text-[15px] text-[#6E6E73] mt-2 leading-relaxed">
                      Swappie, BackMarket, EasyCash, eRecycle, MagicRecycle et d'autres. Résultats triés du meilleur au moins bon.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {["Prix en direct", "Trié par prix", "Lien direct vers l'offre"].map(t => (
                        <span key={t} className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-3 py-1 text-sm text-[#6E6E73]">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="hidden md:block flex-shrink-0">
                    <div className="w-[260px]">
                      <p className="text-xs text-[#6E6E73] mb-3">iPhone 14 Pro · 128 Go · Parfait</p>
                      <div className="relative">
                        <div className="bg-[#1D1D1F] rounded-[10px] px-4 py-3 mb-2 flex justify-between items-center">
                          <span className="text-white text-sm font-medium">PhoneSpot</span>
                          <span className="text-white font-bold text-[16px]">416 €</span>
                        </div>
                        <div className="bg-[#F5F5F7] rounded-[10px] px-4 py-2.5 mb-1.5 flex justify-between items-center">
                          <span className="text-[#1D1D1F] text-sm">#1 Swappie</span>
                          <span className="font-semibold text-[15px] text-[#1D1D1F]">416 €</span>
                        </div>
                        <div className="bg-[#F5F5F7] rounded-[10px] px-4 py-2.5 mb-1.5 flex justify-between items-center">
                          <span className="text-[#1D1D1F] text-sm">#2 EasyCash</span>
                          <span className="font-semibold text-[15px] text-[#1D1D1F]">340 €</span>
                        </div>
                        <div className="bg-[#F5F5F7] rounded-[10px] px-4 py-2.5 flex justify-between items-center">
                          <span className="text-[#1D1D1F] text-sm">#3 BackMarket</span>
                          <span className="font-semibold text-[15px] text-[#1D1D1F]">295 €</span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 — Choisissez */}
              <div className={`md:absolute md:inset-0 transition-opacity duration-200 ${
                activeStep === 3 ? 'block opacity-100' : 'hidden md:block md:opacity-0 md:pointer-events-none'
              }`}>
                <div className="flex flex-col md:flex-row gap-8 h-full">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[22px] text-[#1D1D1F]">Reprise pro ou vente vous-même</h3>
                    <p className="text-[15px] text-[#6E6E73] mt-2 leading-relaxed">
                      Vendez à un repreneur en quelques clics, ou laissez notre IA rédiger votre annonce pour vendre plus cher sur Leboncoin ou Facebook Marketplace.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {['Annonce rédigée par IA', 'Guide photos inclus', 'Conseils anti-arnaque'].map(t => (
                        <span key={t} className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-3 py-1 text-sm text-[#6E6E73]">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="hidden md:block flex-shrink-0">
                    <div className="w-[260px]">
                      <div className="bg-[#1D1D1F] rounded-[14px] p-4 mb-2">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-white font-semibold text-[14px] flex-1 min-w-0">Reprise professionnelle</span>
                          <span className="text-white font-bold text-[16px] flex-none whitespace-nowrap">Jusqu'à 416 €</span>
                        </div>
                        <p className="text-white/50 text-xs mt-1">Envoi postal · 5-10 jours</p>
                      </div>
                      <div className="bg-white border border-[#D2D2D7] rounded-[14px] p-4">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[#1D1D1F] font-semibold text-[14px] flex-1 min-w-0">Vendre vous-même</span>
                          <span className="text-[#1D1D1F] font-bold text-[16px] flex-none whitespace-nowrap">Jusqu'à 665 €</span>
                        </div>
                        <p className="text-[#6E6E73] text-xs mt-1">Annonce IA + guide complet</p>
                        <span className="inline-block mt-2 bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill text-xs text-[#6E6E73] px-2 py-0.5">+59% vs reprise pro</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom CTA */}
            <div className="text-center mt-10">
              <span className="inline-block border border-[#0071E3] text-[#0071E3] rounded-pill px-6 py-3 text-[15px] font-semibold pointer-events-none">
                Estimez votre iPhone
              </span>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ── Estimator Form ────────────────────────────────────────────────── */}
      <section id="estimator" className="bg-white pb-20 px-6">
        <div ref={formRef} className="max-w-[720px] mx-auto">

          {/* Progress Bar */}
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

          {/* Summary pills — steps 2, 3, 4 */}
          {displayStep >= 2 && (
            <div className="flex justify-center gap-2 mb-8 flex-wrap">
              {model && (
                <button
                  type="button"
                  onClick={() => { setModel(''); setStorage(''); setCondition('Parfait'); goToStep(1) }}
                  className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-3 py-1.5 text-sm text-[#1D1D1F] flex items-center gap-1.5 hover:border-[#6E6E73] transition-colors cursor-pointer"
                >
                  {model} <span className="text-xs text-[#6E6E73]">✕</span>
                </button>
              )}
              {displayStep >= 3 && storage && (
                <button
                  type="button"
                  onClick={() => { setStorage(''); setCondition('Parfait'); goToStep(2) }}
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
          )}

          {/* Step content */}
          <div
            key={displayStep}
            className={animating ? 'opacity-0' : 'step-enter-active'}
          >

            {/* ── STEP 1 — MODÈLE ─────────────────────────────────────────── */}
            {displayStep === 1 && (
              <div>
                <h2 className="font-bold text-[24px] sm:text-[32px] text-[#1D1D1F] text-center mb-2 tracking-[-0.3px]">
                  Quel modèle d'iPhone ?
                </h2>
                <p className="text-[15px] text-[#6E6E73] text-center mb-10">
                  Sélectionnez votre modèle pour commencer.
                </p>
                <ModelGrid
                  visibleModels={visibleModels}
                  selectedModel={model}
                  allModelsCount={allModels.length}
                  showAllModels={showAllModels}
                  onSelect={handleModelSelect}
                  onToggleAll={handleToggleAll}
                />
              </div>
            )}

            {/* ── STEP 2 — CAPACITÉ ────────────────────────────────────────── */}
            {displayStep === 2 && (
              <div>
                <button
                  type="button"
                  onClick={() => { setModel(''); setStorage(''); setCondition('Parfait'); goToStep(1) }}
                  className="flex items-center gap-1 text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors mb-8 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Modèle
                </button>
                <h2 className="font-bold text-[24px] sm:text-[32px] text-[#1D1D1F] text-center mb-2 tracking-[-0.3px]">
                  Quelle capacité ?
                </h2>
                <p className="text-[15px] text-[#6E6E73] text-center mb-10">
                  {model} — choisissez le stockage
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {storagesForModel.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStorage(s)
                        goToStep(3)
                      }}
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

            {/* ── STEP 3 — ÉTAT ────────────────────────────────────────────── */}
            {displayStep === 3 && (
              <div>
                <button
                  type="button"
                  onClick={() => { setStorage(''); setCondition('Parfait'); goToStep(2) }}
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
                  {PHONE_CONDITIONS.map(cond => {
                    const selected = condition === cond.value
                    return (
                      <button
                        key={cond.value}
                        type="button"
                        onClick={() => {
                          setCondition(cond.value)
                          goToStep(4)
                        }}
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

            {/* ── STEP 4 — BATTERIE ────────────────────────────────────────── */}
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

                    {/* Large battery value */}
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

                    {/* Slider + quick-select */}
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

                    {/* Submit */}
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

                    {/* Unknown state */}
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

                    {/* Submit */}
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

      {/* ── PhoneSpot Local ───────────────────────────────────────────────── */}
      <section id="phonespot-local">
        <FadeSection className="bg-[#1D1D1F] py-24 px-6 text-center">
          <div className="max-w-[700px] mx-auto">
            <span className="inline-block bg-white/10 text-white/60 text-sm rounded-pill px-4 py-1.5 mb-6">
              Bordeaux · Acheteur local
            </span>
            <h2 className="font-bold text-[32px] md:text-[40px] text-white tracking-[-0.5px] mb-4">
              Vous êtes pressé ? On rachète directement.
            </h2>
            <p className="text-[16px] text-white/70 max-w-[560px] mx-auto leading-relaxed mb-8">
              Pas d'envoi postal. Pas d'attente de 10 jours. PhoneSpot Bordeaux est un acheteur local
              qui se déplace sur Bordeaux et alentours. Paiement cash ou virement immédiat le jour même.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=Bonjour%2C+je+souhaite+vendre+mon+iPhone`}
              target="_blank"
              rel="noopener noreferrer"
              className="block sm:inline-block text-center bg-white text-[#1D1D1F] rounded-pill px-8 py-4 font-semibold text-[15px] hover:opacity-90 transition-opacity duration-200"
            >
              Nous contacter sur WhatsApp →
            </a>
            <div className="flex flex-wrap justify-center gap-6 mt-8">
              {[
                "Réponse en moins d'1h",
                'Paiement cash ou virement',
                'Déplacement Bordeaux et alentours',
                'Sans envoi postal',
              ].map(t => (
                <span key={t} className="text-white/50 text-sm">&#10003; {t}</span>
              ))}
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ── Why PhoneSpot ─────────────────────────────────────────────────── */}
      <FadeSection className="bg-white py-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="font-bold text-[32px] text-[#1D1D1F] tracking-[-0.3px] text-center mb-16">
            Pourquoi PhoneSpot ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-4">
                <circle cx="11" cy="11" r="7" stroke="#0071E3" strokeWidth="2" />
                <path d="M16.5 16.5L21 21" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <h3 className="font-bold text-[18px] text-[#1D1D1F] mb-2">Spécialiste iPhone</h3>
              <p className="text-[16px] text-[#6E6E73] leading-relaxed">
                Aucun autre appareil. Tous nos prix, toutes nos données, tous nos conseils sont
                calibrés pour les iPhones uniquement.
              </p>
            </div>
            <div>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-4">
                <path
                  d="M13 2L4.09 12.57A1 1 0 004.84 14H11l-1 8 8.91-10.57A1 1 0 0018.16 10H12l1-8z"
                  stroke="#0071E3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
              <h3 className="font-bold text-[18px] text-[#1D1D1F] mb-2">Offre cash immédiate</h3>
              <p className="text-[16px] text-[#6E6E73] leading-relaxed">
                PhoneSpot Bordeaux rachète directement au meilleur prix local. Cash le jour même,
                sans attente, sans envoi.
              </p>
            </div>
            <div>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-4">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="#0071E3" strokeWidth="2" />
                <path d="M7 9h10M7 13h7" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <h3 className="font-bold text-[18px] text-[#1D1D1F] mb-2">Guide vente complet</h3>
              <p className="text-[16px] text-[#6E6E73] leading-relaxed">
                Annonce rédigée par IA, guide photos, meilleur créneau de publication. Tout pour
                vendre plus cher vous-même si vous préférez.
              </p>
            </div>
          </div>
        </div>
      </FadeSection>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq">
        <FadeSection className="bg-[#F5F5F7] py-20 px-6">
          <div className="max-w-[720px] mx-auto">
            <h2 className="font-bold text-[32px] text-[#1D1D1F] tracking-[-0.3px] text-center mb-12">
              Questions fréquentes
            </h2>
            <div>
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="bg-white border border-[#D2D2D7] rounded-card mb-3 overflow-hidden">
                  <button
                    className="w-full px-6 py-5 flex justify-between items-center cursor-pointer text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-semibold text-[15px] text-[#1D1D1F] pr-4">{item.q}</span>
                    <svg
                      width="20" height="20" viewBox="0 0 20 20" fill="none"
                      className={`flex-shrink-0 text-[#6E6E73] transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}
                    >
                      <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5 border-t border-[#D2D2D7] pt-4">
                      <p className="text-[16px] text-[#6E6E73] leading-[1.7]">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#1D1D1F] py-16 px-8">
        <div className="max-w-[1100px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <p className="font-bold text-[18px] text-white">PhoneSpot</p>
            <span className="inline-block bg-white/10 text-white/60 text-xs rounded-pill px-3 py-1 mt-2">
              iPhone only
            </span>
            <p className="text-[14px] text-white/50 mt-4 leading-relaxed max-w-[200px]">
              Le comparateur de prix de reprise spécialisé iPhone. Spécialiste Bordeaux.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[11px] text-white/40 uppercase tracking-wider mb-4">Navigation</p>
            {[
              { label: 'Estimer mon iPhone', href: '#estimator' },
              { label: 'Comment ça marche', href: '#how-it-works' },
              { label: 'PhoneSpot Bordeaux', href: '#phonespot-local' },
              { label: 'FAQ', href: '#faq' },
            ].map(l => (
              <a key={l.href} href={l.href} className="block text-sm text-white/60 hover:text-white transition-colors duration-200 mb-2">
                {l.label}
              </a>
            ))}
          </div>
          <div>
            <p className="font-semibold text-[11px] text-white/40 uppercase tracking-wider mb-4">10+ repreneurs comparés</p>
            {['Swappie', 'BackMarket', 'Recommerce', "et bien d'autres…"].map(r => (
              <p key={r} className="text-sm text-white/60 mb-2">{r}</p>
            ))}
          </div>
          <div>
            <p className="font-semibold text-[11px] text-white/40 uppercase tracking-wider mb-4">Contact</p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white/10 border border-white/20 text-white text-sm rounded-pill px-4 py-2 hover:bg-white/20 transition-colors duration-200"
            >
              WhatsApp →
            </a>
            <p className="text-sm text-white/50 mt-4">Bordeaux et alentours</p>
            <p className="text-sm text-white/50 mt-1">Réponse en moins d'1h</p>
          </div>
        </div>
        <div className="max-w-[1100px] mx-auto border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-white/30">
            © 2026 PhoneSpot. Tous droits réservés.{' '}·{' '}
            <Link to="/mentions-legales" className="hover:text-white/60 transition-colors duration-200">
              Mentions légales
            </Link>
          </p>
          <p className="text-xs text-white/30">Comparateur indépendant · Aucune publicité</p>
        </div>
      </footer>
    </>
  )
}
