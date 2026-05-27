import { useState } from 'react'

const NAV_LINKS = [
  { label: 'Estimer mon iPhone', href: '#estimator' },
  { label: 'Comment ça marche', href: '#how-it-works' },
  { label: 'PhoneSpot Bordeaux', href: '#phonespot-local' },
  { label: 'FAQ', href: '#faq' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="bg-white/85 backdrop-blur-xl border-b border-apple-border sticky top-0 z-50">
      <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center shrink-0">
          <span className="font-bold text-[18px] text-[#1D1D1F]">PhoneSpot</span>
          <span className="ml-2 text-xs bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] rounded-pill px-2 py-0.5">
            iPhone
          </span>
        </a>

        {/* Center nav links — desktop only */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors duration-200 whitespace-nowrap"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right CTA — desktop only */}
        <div className="hidden md:block shrink-0">
          <a
            href="#estimator"
            className="bg-[#1D1D1F] text-white rounded-pill px-5 py-2 text-[13px] hover:opacity-80 transition-opacity duration-200"
          >
            Vendre mon iPhone
          </a>
        </div>

        {/* Hamburger icon — mobile */}
        <button
          className="md:hidden flex flex-col justify-center gap-[5px] w-8 h-8 cursor-pointer border-none bg-transparent p-0"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <span className="block w-6 h-[1.5px] bg-[#1D1D1F] rounded-full" />
          <span className="block w-6 h-[1.5px] bg-[#1D1D1F] rounded-full" />
          <span className="block w-6 h-[1.5px] bg-[#1D1D1F] rounded-full" />
        </button>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-b border-[#D2D2D7] py-4 px-6 flex flex-col gap-4">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors duration-200 py-1"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#estimator"
            onClick={() => setMenuOpen(false)}
            className="bg-[#1D1D1F] text-white rounded-pill px-5 py-2.5 text-[13px] text-center hover:opacity-80 transition-opacity duration-200 mt-2"
          >
            Vendre mon iPhone
          </a>
        </div>
      )}
    </nav>
  )
}
