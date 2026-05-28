import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../lib/api'

interface ListingGeneratorProps {
  model: string
  storage: string
  condition: string
  battery: number
  prixMaxPro: number
}

interface Listing {
  titre: string
  description: string
  prix_conseille: number
  tags: string[]
}

type Platform = 'Leboncoin' | 'Facebook Marketplace' | 'Vinted' | 'eBay'

const PLATFORMS: Platform[] = ['Leboncoin', 'Facebook Marketplace', 'Vinted', 'eBay']

const PLATFORM_TIPS: Record<Platform, string> = {
  'Leboncoin': "Misez tout sur les photos. Titre précis, prix juste. Les acheteurs LBC comparent beaucoup avant de contacter.",
  'Facebook Marketplace': "Répondez dans l'heure. Les acheteurs Facebook attendent une réactivité immédiate — sinon ils passent.",
  'Vinted': "Dernier recours pour iPhone. Clientèle plus mode que tech, prix tirés vers le bas.",
  'eBay': "Sur eBay, privilégiez la vente aux enchères pour les modèles Pro. Décrivez chaque défaut avec précision — les acheteurs sont exigeants.",
}

const ANTI_SCAM_TIPS: Record<Platform, string[]> = {
  'Leboncoin': [
    "Ne communiquez jamais en dehors de la messagerie Leboncoin.",
    "Refusez les paiements par virement Western Union, PayLib inconnu, ou chèque de banque — ce sont les arnaques les plus fréquentes.",
    "Exigez un paiement en espèces ou Lydia/Sumeria en face à face.",
    "Rencontrez l'acheteur dans un lieu public (café, sortie de métro).",
    "Ne donnez pas votre adresse personnelle avant d'avoir établi une relation de confiance avec l'acheteur.",
    "Vérifiez que l'acheteur a un profil avec historique et avis positifs.",
  ],
  'Facebook Marketplace': [
    "Méfiez-vous des profils créés récemment ou sans photo de profil réelle.",
    "Refusez les propositions d'envoi postal avec paiement à la livraison — arnaque classique sur Facebook.",
    "Ne partagez jamais votre numéro de téléphone personnel dans le chat.",
    "Exigez un paiement en main propre uniquement. Pas de virement avant remise.",
    "Si l'acheteur insiste pour payer via un lien externe, c'est une arnaque.",
    "Désactivez iCloud et réinitialisez l'iPhone avant la remise.",
  ],
  'Vinted': [
    "Vendez uniquement via le système de paiement intégré Vinted — jamais par virement direct.",
    "N'envoyez le téléphone qu'après confirmation du paiement par Vinted.",
    "Utilisez uniquement les transporteurs proposés par Vinted pour être protégé.",
    "Refusez toute demande de contact en dehors de l'application.",
    "Photographiez le colis avant envoi pour prouver l'état à l'expédition.",
    "Note : Vinted est peu adapté aux iPhones récents — peu d'acheteurs tech sur cette plateforme.",
  ],
  'eBay': [
    "Activez uniquement le paiement via eBay (Stripe) — jamais par virement.",
    "Conservez tous les justificatifs d'expédition et numéros de suivi.",
    "Photographiez l'iPhone sous tous les angles AVANT l'envoi — essentiel en cas de litige.",
    "Méfiez-vous des acheteurs qui demandent une transaction hors eBay juste après votre annonce.",
    "Désactivez iCloud et effectuez une réinitialisation complète avant l'envoi — obligatoire.",
    "Les retours abusifs existent sur eBay : décrivez chaque défaut avec précision pour vous protéger.",
  ],
}

const STEPS = [
  { label: 'Analyse de votre iPhone...', duration: 800 },
  { label: 'Adaptation au ton de la plateforme...', duration: 1200 },
  { label: 'Rédaction de la description...', duration: 1500 },
  { label: 'Optimisation du titre...', duration: 800 },
  { label: 'Calcul du prix conseillé...', duration: 600 },
]

const PRICE_MULTIPLIERS: Record<string, number> = {
  'Parfait': 1.55,
  'Très bon état': 1.40,
  'Bon état': 1.25,
  'Cassé': 0.85,
}

function formatStorageLabel(raw: string): string {
  if (raw === '1024GB') return '1 To'
  return raw.replace('GB', ' Go')
}

function getFallback(
  model: string,
  storage: string,
  condition: string,
  battery: number,
  prixMaxPro: number,
  platform: Platform,
): Listing {
  const mult = PRICE_MULTIPLIERS[condition] ?? 1.40
  const prix = Math.round(prixMaxPro * mult)
  const sl = formatStorageLabel(storage)
  const modelTag = model.replace(/\s+/g, '')
  const slTag = sl.replace(/\s+/g, '')

  const specsBlock = `📱 Fiche technique : ${model} — Stockage : ${sl} — Santé batterie : ${battery}% — État : ${condition}`
  const hashtagBlock = `#iPhone #Apple #${modelTag} #${slTag} #SmartphoneOccasion #TelephoneOccasion #iPhoneOccasion`

  const baseTitles: Record<string, string> = {
    'Parfait': `${model} ${sl} – Parfait état, bat. ${battery}%`,
    'Très bon état': `${model} ${sl} – Très bon état, bat. ${battery}%`,
    'Bon état': `${model} ${sl} – Bon état, prix réduit`,
    'Cassé': `${model} ${sl} – Pour pièces / réparation`,
  }
  const ebayTitles: Record<string, string> = {
    'Parfait': `${model} ${sl} Parfait état – Déverrouillé – Batterie ${battery}%`,
    'Très bon état': `${model} ${sl} Très bon état – Déverrouillé – Batterie ${battery}%`,
    'Bon état': `${model} ${sl} Bon état – Fonctionnel – Batterie ${battery}%`,
    'Cassé': `${model} ${sl} – Écran endommagé – Pour pièces ou réparation`,
  }

  const coreDesc: Record<string, string> = {
    'Parfait': `${model} ${sl} en parfait état, jamais reconditionné. Acheté neuf, toujours utilisé avec coque et verre trempé. Écran sans aucune rayure, coque impeccable. Santé batterie : ${battery}%. Accessoires d'origine inclus. Déverrouillé tous opérateurs.`,
    'Très bon état': `${model} ${sl} en très bon état. Quelques micro-rayures légères sur la tranche, invisibles à l'utilisation. Écran impeccable, aucune rayure. Santé batterie : ${battery}%. Toujours utilisé avec coque. Déverrouillé tous opérateurs.`,
    'Bon état': `${model} ${sl} en bon état. Quelques rayures d'usage visibles sur la coque et les tranches. Écran sans fissure. Toutes les fonctions opérationnelles. Santé batterie : ${battery}%. Déverrouillé tous opérateurs.`,
    'Cassé': `${model} ${sl} avec écran endommagé. L'écran s'allume mais présente des fissures. Caméra, Face ID et haut-parleurs fonctionnels. Santé batterie : ${battery}%. Idéal pour réparation ou pièces détachées.`,
  }
  const core = coreDesc[condition] ?? `${model} ${sl}, état ${condition}, batterie ${battery}%.`

  const ebayDetail: Record<string, string> = {
    'Parfait': `Aucune rayure visible sur le châssis ou l'écran. Tous les accessoires d'origine inclus (câble, documentation). Face ID fonctionnel, toutes caméras opérationnelles, 5G actif. Déverrouillé tous opérateurs. Remise à zéro effectuée avant vente.`,
    'Très bon état': `Micro-rayures légères sur la tranche, imperceptibles à l'usage. Écran sans défaut. Face ID, caméras et 5G fonctionnels. Câble USB-C inclus, pas de boîte d'origine. Déverrouillé tous opérateurs. Remise à zéro avant expédition.`,
    'Bon état': `Rayures visibles sur le dos et les tranches, conformes à l'usure normale. Écran sans fissure. Toutes fonctions opérationnelles : Face ID, caméras, 5G, haut-parleurs. Vendu sans accessoires. Déverrouillé tous opérateurs.`,
    'Cassé': `Écran fissuré — l'appareil démarre et l'écran répond tactile malgré les fissures. Caméras, 5G, Face ID et haut-parleurs testés et fonctionnels. Idéal pour technicien ou réparateur. Vendu en l'état, sans accessoires.`,
  }

  const vintedShort: Record<string, string> = {
    'Parfait': `${model} ${sl} parfait état. Batterie ${battery}%. Aucune rayure. Déverrouillé. Envoi soigné.`,
    'Très bon état': `${model} ${sl} très bon état. Micro-rayures légères. Batterie ${battery}%. Déverrouillé. Envoi soigné.`,
    'Bon état': `${model} ${sl} bon état. Rayures d'usage. Batterie ${battery}%. Fonctionne parfaitement. Prix sympa.`,
    'Cassé': `${model} ${sl} écran endommagé. Batterie ${battery}%. Pour pièces ou réparation.`,
  }

  let description = ''
  let titre = baseTitles[condition] ?? `${model} ${sl} – ${condition}`

  switch (platform) {
    case 'Leboncoin': {
      const contact = condition === 'Cassé'
        ? 'Prix ferme. Remise en main propre uniquement.'
        : 'Photos disponibles sur demande. Remise en main propre ou envoi avec suivi. Prix négociable dans la limite du raisonnable.'
      description = `${core} ${contact}`
      break
    }
    case 'Facebook Marketplace': {
      const emoji = condition === 'Parfait' ? '✨' : '📱'
      description = `${emoji} ${core}\n\nEnvoyez-moi un message pour plus d'infos ou pour fixer un rendez-vous. 😊`
      break
    }
    case 'Vinted': {
      description = `${vintedShort[condition] ?? core}\n\n${hashtagBlock}`
      break
    }
    case 'eBay': {
      titre = ebayTitles[condition] ?? `${model} ${sl} – ${condition}`
      description = `${specsBlock}\n\n${ebayDetail[condition] ?? core}`
      break
    }
  }

  return {
    titre,
    description,
    prix_conseille: prix,
    tags: [model, sl, condition, 'Apple', 'iPhone'],
  }
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function ClipboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="1" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 4H2a1 1 0 00-1 1v9a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-[13px] text-[#6E6E73] hover:text-[#0071E3] transition-colors"
    >
      <ClipboardIcon />
      {copied ? <span className="text-[#34C759]">Copié !</span> : 'Copier'}
    </button>
  )
}

function TagPill({ tag }: { tag: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(tag).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      className={`rounded-pill px-3 py-1 text-[13px] transition-all duration-200 border ${
        copied
          ? 'border-[#34C759] text-[#34C759] bg-white'
          : 'border-[#D2D2D7] text-[#6E6E73] bg-white hover:border-[#0071E3] hover:text-[#0071E3]'
      }`}
    >
      {copied ? '✓ ' + tag : tag}
    </button>
  )
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11.5L6 10L3 11.5L3.5 8L1 5.5L4.5 4.5L6 1Z" stroke="#0071E3" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
}

function ListingPreviewBlur({ platform }: { platform: Platform }) {
  return (
    <div className="relative rounded-[14px] overflow-hidden border border-[#D2D2D7] bg-white p-4 h-full min-h-[140px]">
      <div className="blur-[5px] select-none pointer-events-none opacity-60">
        <div className="h-3.5 bg-[#D2D2D7] rounded-full w-3/4 mb-3" />
        <div className="h-2.5 bg-[#E5E5EA] rounded-full w-full mb-2" />
        <div className="h-2.5 bg-[#E5E5EA] rounded-full w-5/6 mb-2" />
        <div className="h-2.5 bg-[#E5E5EA] rounded-full w-4/5 mb-2" />
        <div className="h-2.5 bg-[#E5E5EA] rounded-full w-full mb-4" />
        <div className="flex gap-2">
          <div className="h-5 bg-[#F5F5F7] rounded-pill w-16" />
          <div className="h-5 bg-[#F5F5F7] rounded-pill w-14" />
          <div className="h-5 bg-[#F5F5F7] rounded-pill w-12" />
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="bg-white rounded-full p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 1.5L11 6.5L16.5 7.5L12.5 11.5L13.5 17L9 14.5L4.5 17L5.5 11.5L1.5 7.5L7 6.5L9 1.5Z" stroke="#1D1D1F" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-[11px] text-[#6E6E73] text-center font-medium leading-tight">
          Optimisé pour<br />{platform}
        </p>
      </div>
    </div>
  )
}

function AntiScamSection({ platform }: { platform: Platform }) {
  const [open, setOpen] = useState(false)
  const tips = ANTI_SCAM_TIPS[platform]

  return (
    <div className="border-t border-[#D2D2D7] pt-4 mt-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 cursor-pointer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#FF9500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="font-semibold text-[14px] text-[#1D1D1F] flex-1 text-left">
          Conseils pour éviter les arnaques
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`text-[#6E6E73] flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="mt-4">
          <ul className="flex flex-col gap-2.5 mb-4">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
                  <path d="M8 15s6-3 6-7.5V3.5L8 1.5 2 3.5V7.5c0 4.5 6 7.5 6 7.5z" fill="#34C759" fillOpacity="0.15" stroke="#34C759" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5.5 8l2 2 3-3" stroke="#34C759" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[14px] text-[#1D1D1F] leading-snug">{tip}</span>
              </li>
            ))}
          </ul>

          <div className="bg-[#FFF9EC] border border-[#FF9500]/30 rounded-[12px] p-4 flex items-start gap-2.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
              <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="#FF9500" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M8 6v3.5" stroke="#FF9500" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="8" cy="11" r="0.8" fill="#FF9500"/>
            </svg>
            <p className="text-[13px] text-[#92400E] leading-relaxed">
              Quel que soit le moyen de paiement : désactivez toujours iCloud (Réglages → [votre nom] → Se déconnecter) et réinitialisez l'iPhone avant la remise à l'acheteur.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function ListingGenerator({ model, storage, condition, battery, prixMaxPro }: ListingGeneratorProps) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [platform, setPlatform] = useState<Platform>('Leboncoin')
  const [generationStep, setGenerationStep] = useState(0)
  const [generationDone, setGenerationDone] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const waNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '33600000000'
  const waText = encodeURIComponent(`Bonjour, je veux vendre mon ${model} ${storage} état ${condition} batterie ${battery}%`)
  const waUrl = `https://wa.me/${waNumber}?text=${waText}`

  useEffect(() => {
    const styleId = 'listing-generator-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        @keyframes checkIn {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .animate-check-in {
          animation: checkIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `
      document.head.appendChild(style)
    }
    return () => { timeoutsRef.current.forEach(clearTimeout) }
  }, [])

  async function generate() {
    const startTime = Date.now()
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setIsLoading(true)
    setGenerationStep(0)
    setGenerationDone(false)

    // Animate steps sequentially
    const totalDuration = STEPS.reduce((acc, s) => acc + s.duration, 0)
    let cumulative = 0
    STEPS.forEach((step, index) => {
      const id = setTimeout(() => setGenerationStep(index + 1), cumulative)
      timeoutsRef.current.push(id)
      cumulative += step.duration
    })

    // Run API call in parallel
    let result: Listing
    try {
      const res = await apiFetch('/api/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, storage, condition, battery, prix_max: prixMaxPro, platform }),
      })
      if (!res.ok) throw new Error()
      result = await res.json()
      if (window.umami) window.umami.track('annonce_generee', { platform })
    } catch {
      result = getFallback(model, storage, condition, battery, prixMaxPro, platform)
    }

    // Wait until all steps shown, then fade out and reveal result
    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, totalDuration - elapsed)
    const doneId = setTimeout(() => {
      setGenerationDone(true)
      const finalId = setTimeout(() => {
        setListing(result)
        setIsLoading(false)
      }, 300)
      timeoutsRef.current.push(finalId)
    }, remaining)
    timeoutsRef.current.push(doneId)
  }

  function reset() {
    setListing(null)
  }

  /* STATE 1 — Pre-generation */
  if (!listing) {
    return (
      <div className="bg-[#F5F5F7] rounded-card p-6">
        {isLoading ? (
          /* ── Loading UI ── */
          <div className={`text-center py-8 px-6 transition-all duration-300 ${generationDone ? 'opacity-0 -translate-y-2.5' : 'opacity-100 translate-y-0'}`}>
            {/* Status pill */}
            <div className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-4 py-1.5 flex items-center gap-2 justify-center mx-auto w-fit mb-6">
              <div className="w-2 h-2 bg-[#0071E3] rounded-full animate-pulse" />
              <span className="font-medium text-[14px] text-[#1D1D1F]">IA en cours de rédaction...</span>
            </div>

            {/* Steps */}
            <div className="mb-6 max-w-[320px] mx-auto">
              {STEPS.map((step, index) => {
                const stepNum = index + 1
                const isDone = generationStep > stepNum
                const isActive = generationStep === stepNum
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 py-2.5 px-3 transition-colors duration-200 ${isActive ? 'bg-white rounded-[8px]' : ''}`}
                  >
                    <div className="flex-shrink-0">
                      {isDone ? (
                        <div className="w-6 h-6 bg-[#34C759] rounded-full flex items-center justify-center animate-check-in">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      ) : isActive ? (
                        <div className="w-6 h-6 bg-[#0071E3] rounded-full flex items-center justify-center">
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3"/>
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 border-2 border-[#D2D2D7] rounded-full bg-white" />
                      )}
                    </div>
                    <span className={`text-[14px] transition-all duration-200 ${
                      isDone    ? 'text-[#6E6E73] line-through opacity-60' :
                      isActive  ? 'font-semibold text-[#1D1D1F]' :
                                  'text-[#6E6E73] opacity-40'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-[#E5E5EA] rounded-full w-full max-w-[320px] mx-auto">
              <div
                className="h-1 bg-[#0071E3] rounded-full transition-[width] duration-[600ms] ease-out"
                style={{ width: `${(generationStep / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          /* ── Pre-generation UI ── */
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Left */}
            <div className="flex-1">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0071E3] bg-[#EAF3FF] rounded-pill px-3 py-1 mb-3">
                <SparkleIcon />
                IA · Annonce personnalisée
              </span>
              <h3 className="font-semibold text-[18px] text-[#1D1D1F] mb-2">
                Votre annonce, prête en 3 secondes
              </h3>
              <p className="text-[14px] text-[#6E6E73] mb-5">
                Notre IA génère un titre accrocheur et une description adaptée à la plateforme choisie.
              </p>

              {/* Platform selector */}
              <div className="mb-4">
                <p className="text-[13px] text-[#6E6E73] mb-2">Plateforme cible</p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`rounded-pill px-4 py-1.5 text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                        platform === p
                          ? 'bg-[#1D1D1F] text-white'
                          : 'bg-white border border-[#D2D2D7] text-[#6E6E73] hover:border-[#6E6E73] hover:text-[#1D1D1F]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic tip */}
              <p className="text-[13px] text-[#6E6E73] bg-white border border-[#D2D2D7] rounded-[10px] px-4 py-3 mb-5 leading-relaxed">
                💡 {PLATFORM_TIPS[platform]}
              </p>

              <button
                onClick={generate}
                className="bg-[#1D1D1F] text-white rounded-pill px-6 py-3 text-[15px] font-medium hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              >
                Générer mon annonce →
              </button>
            </div>

            {/* Right — blurred preview, desktop only */}
            <div className="hidden sm:block w-[170px] flex-shrink-0">
              <ListingPreviewBlur platform={platform} />
            </div>
          </div>
        )}
      </div>
    )
  }

  /* STATE 2 — Listing ready */
  return (
    <div className="bg-[#F5F5F7] rounded-card p-6 animate-fade-up">
      {/* Tags row */}
      <div className="flex items-center gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0071E3] bg-[#EAF3FF] rounded-pill px-3 py-1">
          <SparkleIcon />
          Générée par IA
        </span>
        <span className="text-[12px] text-[#6E6E73] bg-white border border-[#D2D2D7] rounded-pill px-3 py-1">
          {platform}
        </span>
      </div>

      {/* Titre */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[13px] font-medium text-[#6E6E73]">Titre</label>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[#6E6E73]">{listing.titre.length}/60</span>
            <CopyButton text={listing.titre} />
          </div>
        </div>
        <input
          readOnly
          value={listing.titre}
          className="border border-[#D2D2D7] rounded-input px-4 py-3 text-[15px] w-full bg-white text-[#1D1D1F] focus:outline-none"
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[13px] font-medium text-[#6E6E73]">Description</label>
          <CopyButton text={listing.description} />
        </div>
        <textarea
          readOnly
          value={listing.description}
          rows={6}
          className="border border-[#D2D2D7] rounded-input px-4 py-3 text-[14px] w-full bg-white text-[#1D1D1F] resize-none focus:outline-none min-h-[140px]"
        />
      </div>

      {/* Prix */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className="font-bold text-[24px] text-[#1D1D1F]">{listing.prix_conseille}€</span>
        <span className="text-[13px] text-[#6E6E73]">Prix conseillé · mettez 5–10% au-dessus pour absorber la négociation</span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-5">
        {listing.tags.map((tag) => (
          <TagPill key={tag} tag={tag} />
        ))}
      </div>

      {/* Anti-scam tips */}
      <AntiScamSection platform={platform} />

      {/* Action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[#D2D2D7] mt-4">
        <div className="flex items-center gap-4">
          <button
            onClick={reset}
            className="border border-[#D2D2D7] text-[#6E6E73] rounded-pill px-4 py-2 text-[13px] hover:border-[#6E6E73] hover:text-[#1D1D1F] transition-colors duration-200 cursor-pointer"
          >
            Régénérer
          </button>
          <button
            onClick={reset}
            className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors duration-200 underline underline-offset-2 cursor-pointer"
          >
            Changer de plateforme
          </button>
        </div>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors duration-200 whitespace-nowrap"
        >
          Trop compliqué ? PhoneSpot rachète →
        </a>
      </div>
    </div>
  )
}
