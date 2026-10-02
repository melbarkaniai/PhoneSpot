import { Link } from 'react-router-dom'
import { POPULAR_MODELS } from '../lib/models'

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '33600000000'

// Anchors point at the home page sections so they also work from other pages.
const NAV_LINKS = [
  { label: 'Estimer mon iPhone', href: '/#estimator' },
  { label: 'Comment ça marche', href: '/#how-it-works' },
  { label: 'Rachat iPhone Bordeaux', href: '/rachat-iphone-bordeaux' },
  { label: 'FAQ', href: '/#faq' },
]

export default function Footer() {
  return (
    <footer className="bg-[#1D1D1F] py-16 px-4 sm:px-8">
      <div className="max-w-[1100px] mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 md:gap-10">
        <div className="col-span-2 md:col-span-1">
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
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="block text-sm text-white/60 hover:text-white transition-colors duration-200 mb-2">
              {l.label}
            </a>
          ))}
        </div>
        <div>
          <p className="font-semibold text-[11px] text-white/40 uppercase tracking-wider mb-4">Modèles populaires</p>
          {POPULAR_MODELS.map(({ slug, model }) => (
            <Link key={slug} to={`/estimer/${slug}`} className="block text-sm text-white/60 hover:text-white transition-colors duration-200 mb-2">
              {model}
            </Link>
          ))}
          <Link to="/estimer" className="block text-sm text-white hover:text-white/80 transition-colors duration-200 mt-3">
            Tous les modèles →
          </Link>
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
  )
}
