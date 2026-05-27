const photos = [
  {
    label: 'Écran éteint',
    text: 'Révèle les micro-rayures. Lumière naturelle latérale.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="7" y="2" width="18" height="28" rx="4" stroke="#0071E3" strokeWidth="1.5"/>
        <rect x="10" y="5" width="12" height="18" rx="2" fill="#F5F5F7"/>
        <line x1="14" y1="27" x2="18" y2="27" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 11 L20 19 M20 11 L12 19" stroke="#D2D2D7" strokeWidth="1" opacity="0.6"/>
      </svg>
    ),
  },
  {
    label: 'Écran allumé',
    text: 'Fond blanc, luminosité max. Prouve que l\'écran fonctionne.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="7" y="2" width="18" height="28" rx="4" stroke="#0071E3" strokeWidth="1.5"/>
        <rect x="10" y="5" width="12" height="18" rx="2" fill="white" stroke="#D2D2D7" strokeWidth="0.5"/>
        <line x1="14" y1="27" x2="18" y2="27" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Face arrière',
    text: 'Surface plane, bonne lumière. Montrez les éventuelles rayures.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="7" y="2" width="18" height="28" rx="4" stroke="#0071E3" strokeWidth="1.5" fill="#F5F5F7"/>
        <rect x="9" y="4" width="8" height="8" rx="2.5" stroke="#0071E3" strokeWidth="1.5" fill="none"/>
        <circle cx="11" cy="6" r="1.5" fill="#0071E3" opacity="0.5"/>
        <circle cx="15" cy="6" r="1.5" fill="#0071E3" opacity="0.5"/>
        <circle cx="13" cy="10" r="1.5" fill="#0071E3" opacity="0.5"/>
      </svg>
    ),
  },
  {
    label: 'Coins et tranches',
    text: 'Les acheteurs cherchent les chocs. Montrez-les : ça crée la confiance.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="12" y="2" width="8" height="28" rx="4" stroke="#0071E3" strokeWidth="1.5" fill="#F5F5F7"/>
        <rect x="20" y="8" width="2.5" height="12" rx="1.25" fill="#D2D2D7"/>
      </svg>
    ),
  },
  {
    label: 'Boîte originale',
    text: 'Ajoute 10 à 20€ de valeur perçue. Indispensable si vous l\'avez.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="10" width="24" height="18" rx="3" stroke="#0071E3" strokeWidth="1.5" fill="#F5F5F7"/>
        <rect x="4" y="4" width="24" height="8" rx="3" stroke="#0071E3" strokeWidth="1.5" fill="white"/>
        <line x1="16" y1="4" x2="16" y2="12" stroke="#D2D2D7" strokeWidth="1"/>
        <text x="16" y="22" textAnchor="middle" fontSize="6" fill="#0071E3" fontFamily="Inter,sans-serif">Apple</text>
      </svg>
    ),
  },
  {
    label: 'Santé batterie',
    text: 'Réglages → Batterie → Santé. Un screenshot suffit.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="7" y="2" width="18" height="28" rx="4" stroke="#0071E3" strokeWidth="1.5"/>
        <rect x="10" y="5" width="12" height="18" rx="2" fill="white" stroke="#D2D2D7" strokeWidth="0.5"/>
        <rect x="12" y="15" width="8" height="6" rx="1" fill="#F5F5F7" stroke="#D2D2D7" strokeWidth="0.5"/>
        <rect x="12" y="15" width="5" height="6" rx="1" fill="#34C759"/>
        <line x1="14" y1="27" x2="18" y2="27" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function PhotoGuide() {
  return (
    <div>
      <h3 className="font-bold text-[22px] text-[#1D1D1F] mb-6">Les photos qui font vendre</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <div
            key={photo.label}
            className="bg-white border border-[#D2D2D7] rounded-[12px] p-4 flex flex-col gap-3"
          >
            {photo.icon}
            <div>
              <p className="font-semibold text-[15px] text-[#1D1D1F]">{photo.label}</p>
              <p className="text-[13px] text-[#6E6E73] mt-1 leading-relaxed">{photo.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
