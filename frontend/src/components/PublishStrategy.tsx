import { useState, useRef, useEffect, useCallback } from 'react'

interface PublishStrategyProps {
  prixMax: number
}

export default function PublishStrategy({ prixMax }: PublishStrategyProps) {
  const cards = [
    {
      value: `${prixMax}€`,
      label: 'Prix de départ',
      text: 'Mettez 5-10% au-dessus pour absorber la négociation.',
    },
    {
      value: '−5 à 8%',
      label: 'Sans réponse ?',
      text: 'Baissez progressivement après 4 jours sans message.',
    },
    {
      value: 'Mer–Jeu 19h–21h',
      label: 'Meilleur créneau',
      text: 'Aussi : samedi matin 9h–11h. Évitez lundi et dimanche matin.',
    },
    {
      value: 'LBC · FB · Vinted',
      label: 'Par plateforme',
      text: 'LBC : misez tout sur les photos. FB : répondez dans l\'heure. Vinted : dernier recours pour iPhone.',
    },
  ]

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [hasScrolled, setHasScrolled] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const updateState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const left = el.scrollLeft
    const atEnd = left + el.clientWidth >= el.scrollWidth - 2
    setCanScrollLeft(left > 2)
    setCanScrollRight(!atEnd)
    if (left > 4) setHasScrolled(true)
    // Active dot: which card's left edge is closest to current scroll position
    const cardWidth = 200 + 16 // min-w + gap
    setActiveIndex(Math.min(Math.round(left / cardWidth), cards.length - 1))
  }, [cards.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateState()
    el.addEventListener('scroll', updateState, { passive: true })
    return () => el.removeEventListener('scroll', updateState)
  }, [updateState])

  function scrollBy(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  const arrowBase =
    'absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-[#D2D2D7] rounded-full items-center justify-center cursor-pointer z-10 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:bg-[#F5F5F7] transition-colors duration-150'

  return (
    <div>
      <h3 className="font-bold text-[22px] text-[#1D1D1F] mb-6">Quand et comment poster</h3>

      {/* Scroll container with arrows and fade */}
      <div className="relative">
        {/* Left arrow */}
        <button
          onClick={() => scrollBy(-220)}
          className={`${arrowBase} -left-4 hidden sm:flex ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!canScrollLeft}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 13L7 9l4-4" stroke="#1D1D1F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Right arrow */}
        <button
          onClick={() => scrollBy(220)}
          className={`${arrowBase} -right-4 hidden sm:flex ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!canScrollRight}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 13l4-4-4-4" stroke="#1D1D1F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Cards */}
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {cards.map((card) => (
            <div
              key={card.label}
              className="bg-[#F5F5F7] rounded-[12px] p-5 min-w-[200px] flex-shrink-0"
            >
              <p className="font-bold text-[22px] text-[#1D1D1F] mb-1">{card.value}</p>
              <p className="font-semibold text-[14px] text-[#1D1D1F] mb-1.5">{card.label}</p>
              <p className="text-[13px] text-[#6E6E73] leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>

        {/* Right fade gradient */}
        {canScrollRight && (
          <div
            className="absolute right-0 top-0 bottom-2 w-12 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to right, transparent, white)' }}
          />
        )}
      </div>

      {/* Scroll hint */}
      {!hasScrolled && (
        <p className="text-[12px] text-[#6E6E73] text-center mt-3">
          ← Faites défiler pour voir plus →
        </p>
      )}

      {/* Dots indicator */}
      <div className="flex justify-center items-center gap-1.5 mt-2">
        {cards.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-200"
            style={{
              width: i === activeIndex ? '16px' : '6px',
              height: '6px',
              backgroundColor: i === activeIndex ? '#1D1D1F' : '#D2D2D7',
            }}
          />
        ))}
      </div>
    </div>
  )
}
