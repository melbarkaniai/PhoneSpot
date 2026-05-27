interface PhoneConditionPickerProps {
  value: string
  onChange: (condition: string) => void
}

const PhonePerfect = () => (
  <svg width="100" height="180" viewBox="0 0 100 180" fill="none">
    <rect x="5" y="5" width="90" height="170" rx="18" fill="#F5F5F7" stroke="#D2D2D7" strokeWidth="1.5"/>
    <rect x="10" y="22" width="80" height="132" rx="6" fill="white"/>
    <rect x="35" y="12" width="30" height="8" rx="4" fill="#1D1D1F"/>
    <rect x="94" y="50" width="4" height="24" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="44" width="4" height="18" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="68" width="4" height="18" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="32" width="4" height="9" rx="2" fill="#D2D2D7"/>
    <circle cx="82" cy="14" r="6" fill="#34C759"/>
    <rect x="18" y="30" width="16" height="50" rx="3" fill="white" opacity="0.4"/>
  </svg>
)

const PhoneVeryGood = () => (
  <svg width="100" height="180" viewBox="0 0 100 180" fill="none">
    <rect x="5" y="5" width="90" height="170" rx="18" fill="#F5F5F7" stroke="#D2D2D7" strokeWidth="1.5"/>
    <rect x="10" y="22" width="80" height="132" rx="6" fill="white"/>
    <rect x="35" y="12" width="30" height="8" rx="4" fill="#1D1D1F"/>
    <rect x="94" y="50" width="4" height="24" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="44" width="4" height="18" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="68" width="4" height="18" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="32" width="4" height="9" rx="2" fill="#D2D2D7"/>
    <circle cx="82" cy="14" r="6" fill="#0071E3"/>
    <line x1="20" y1="35" x2="35" y2="55" stroke="#D2D2D7" strokeWidth="0.8" opacity="0.6"/>
    <line x1="65" y1="100" x2="75" y2="120" stroke="#D2D2D7" strokeWidth="0.8" opacity="0.6"/>
  </svg>
)

const PhoneGood = () => (
  <svg width="100" height="180" viewBox="0 0 100 180" fill="none">
    <rect x="5" y="5" width="90" height="170" rx="18" fill="#F5F5F7" stroke="#D2D2D7" strokeWidth="1.5"/>
    <rect x="10" y="22" width="80" height="132" rx="6" fill="white"/>
    <rect x="35" y="12" width="30" height="8" rx="4" fill="#1D1D1F"/>
    <rect x="94" y="50" width="4" height="24" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="44" width="4" height="18" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="68" width="4" height="18" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="32" width="4" height="9" rx="2" fill="#D2D2D7"/>
    <circle cx="82" cy="14" r="6" fill="#FF9500"/>
    <line x1="20" y1="40" x2="45" y2="80" stroke="#C7C7CC" strokeWidth="1.2"/>
    <line x1="55" y1="60" x2="75" y2="110" stroke="#C7C7CC" strokeWidth="1"/>
    <line x1="30" y1="100" x2="50" y2="130" stroke="#C7C7CC" strokeWidth="0.8"/>
    <path d="M5 160 Q5 173 18 175 L5 175 Z" fill="#D2D2D7"/>
  </svg>
)

const PhoneBroken = () => (
  <svg width="100" height="180" viewBox="0 0 100 180" fill="none">
    <rect x="5" y="5" width="90" height="170" rx="18" fill="#F5F5F7" stroke="#D2D2D7" strokeWidth="1.5"/>
    <rect x="10" y="22" width="80" height="132" rx="6" fill="#F5F5F7"/>
    <rect x="35" y="12" width="30" height="8" rx="4" fill="#1D1D1F"/>
    <rect x="94" y="50" width="4" height="24" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="44" width="4" height="18" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="68" width="4" height="18" rx="2" fill="#D2D2D7"/>
    <rect x="2" y="32" width="4" height="9" rx="2" fill="#D2D2D7"/>
    <circle cx="82" cy="14" r="6" fill="#FF3B30"/>
    <circle cx="40" cy="70" r="3" fill="#C7C7CC" opacity="0.6"/>
    <line x1="40" y1="70" x2="15" y2="40" stroke="#1D1D1F" strokeWidth="1" opacity="0.35"/>
    <line x1="40" y1="70" x2="70" y2="45" stroke="#1D1D1F" strokeWidth="1" opacity="0.35"/>
    <line x1="40" y1="70" x2="20" y2="100" stroke="#1D1D1F" strokeWidth="1.2" opacity="0.4"/>
    <line x1="40" y1="70" x2="75" y2="95" stroke="#1D1D1F" strokeWidth="1" opacity="0.35"/>
    <line x1="40" y1="70" x2="30" y2="140" stroke="#1D1D1F" strokeWidth="0.8" opacity="0.3"/>
    <line x1="40" y1="70" x2="80" y2="130" stroke="#1D1D1F" strokeWidth="0.8" opacity="0.3"/>
  </svg>
)

export const CONDITIONS = [
  {
    value: 'Parfait',
    label: 'Parfait',
    description: 'Aucune rayure visible. Écran parfait. Comme neuf.',
    svg: <PhonePerfect />,
  },
  {
    value: 'Très bon état',
    label: 'Très bon état',
    description: 'Quelques micro-rayures légères. Écran impeccable.',
    svg: <PhoneVeryGood />,
  },
  {
    value: 'Bon état',
    label: 'Bon état',
    description: 'Rayures visibles. Fonctionne parfaitement.',
    svg: <PhoneGood />,
  },
  {
    value: 'Cassé',
    label: 'Cassé',
    description: 'Écran fissuré ou coque très abîmée.',
    svg: <PhoneBroken />,
  },
]

export default function PhoneConditionPicker({ value, onChange }: PhoneConditionPickerProps) {
  return (
    <div>
      <p className="font-medium text-[13px] text-[#6E6E73] uppercase tracking-[0.05em] mb-3">État de votre iPhone</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {CONDITIONS.map((cond) => {
          const selected = value === cond.value
          return (
            <button
              key={cond.value}
              type="button"
              onClick={() => onChange(cond.value)}
              className={`flex flex-col items-center text-center p-4 rounded-[16px] transition-all duration-200 cursor-pointer ${
                selected
                  ? 'border-2 border-[#1D1D1F] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.08)] -translate-y-0.5'
                  : 'border border-[#D2D2D7] bg-white hover:border-[#6E6E73] hover:-translate-y-0.5'
              }`}
            >
              {cond.svg}
              <p className="font-semibold text-[14px] text-[#1D1D1F] mt-3">{cond.label}</p>
              <p className="text-[12px] text-[#6E6E73] mt-1 leading-snug">{cond.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
