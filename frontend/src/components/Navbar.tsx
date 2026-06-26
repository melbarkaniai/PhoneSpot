import { useState, useEffect } from 'react'

const NAV_LINKS = [
  { label: 'Estimer mon iPhone', href: '#estimator' },
  { label: 'Comment ça marche', href: '#how-it-works' },
  { label: 'PhoneSpot Bordeaux', href: '#phonespot-local' },
  { label: 'FAQ', href: '#faq' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    if (menuOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <>
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
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <span className="block w-6 h-[1.5px] bg-[#1D1D1F] rounded-full" />
            <span className="block w-6 h-[1.5px] bg-[#1D1D1F] rounded-full" />
            <span className="block w-6 h-[1.5px] bg-[#1D1D1F] rounded-full" />
          </button>
        </div>
      </nav>

      {/* Full-screen mobile menu overlay */}
      <div
        className={`md:hidden fixed inset-0 z-[60] bg-white flex flex-col transition-all duration-300 ease-in-out ${
          menuOpen
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 translate-x-full pointer-events-none'
        }`}
      >
        {/* Top bar with logo and X */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-[#D2D2D7] flex-shrink-0">
          <a href="/" className="flex items-center shrink-0" onClick={() => setMenuOpen(false)}>
            <span className="font-bold text-[18px] text-[#1D1D1F]">PhoneSpot</span>
            <span className="ml-2 text-xs bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] rounded-pill px-2 py-0.5">
              iPhone
            </span>
          </a>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
            className="w-8 h-8 flex items-center justify-center cursor-pointer border-none bg-transparent p-0"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="#1D1D1F" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Nav links — centered vertically */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="w-full text-center text-[20px] font-medium text-[#1D1D1F] py-4 hover:text-[#6E6E73] transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-8 w-full px-8">
            <a
              href="#estimator"
              onClick={() => setMenuOpen(false)}
              className="block text-center bg-[#1D1D1F] text-white rounded-pill px-6 py-4 text-[17px] font-medium hover:opacity-80 transition-opacity duration-200"
            >
              Vendre mon iPhone
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
