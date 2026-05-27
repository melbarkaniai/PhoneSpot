import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useLayoutEffect } from 'react'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Results from './pages/Results'
import Admin from './pages/Admin'
import EstimerModel from './pages/EstimerModel'
import MentionsLegales from './pages/MentionsLegales'

function ScrollToTop() {
  const { pathname, search } = useLocation()
  useLayoutEffect(() => {
    const el = document.documentElement
    el.style.scrollBehavior = 'auto'
    el.scrollTop = 0
    document.body.scrollTop = 0
    el.style.scrollBehavior = ''
  }, [pathname, search])
  return null
}

export default function App() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/revendre" element={<Results />} />
          <Route path="/results" element={<Navigate to="/revendre" replace />} />
          <Route path="/estimer/:slug" element={<EstimerModel />} />
          <Route path="/ps-backoffice" element={<Admin />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
        </Routes>
      </main>
    </div>
  )
}
