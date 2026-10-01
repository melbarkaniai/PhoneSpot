import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { POPULAR_MODELS } from '../lib/models'

// Prerendered as dist/404.html, which Vercel serves with a 404 status for any
// unknown URL. noindex is a safety net for client-side navigations.
export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>Page introuvable | PhoneSpot</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <section className="bg-white pt-20 pb-24 px-6">
        <div className="max-w-[680px] mx-auto text-center">
          <p className="text-[14px] text-[#6E6E73] mb-3">Erreur 404</p>
          <h1 className="font-bold text-[32px] md:text-[40px] text-[#1D1D1F] tracking-[-0.5px] leading-[1.1]">
            Page introuvable
          </h1>
          <p className="text-[17px] text-[#6E6E73] mt-4 leading-relaxed">
            Cette page n'existe pas ou a été déplacée.
          </p>
          <Link
            to="/"
            className="inline-block mt-8 bg-[#0071E3] text-white rounded-pill px-6 py-3 text-[17px] font-medium hover:bg-[#0077ED] transition-colors duration-200"
          >
            Retour à l'accueil
          </Link>

          <h2 className="font-semibold text-[20px] text-[#1D1D1F] mt-16 mb-5">Modèles populaires</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {POPULAR_MODELS.map(({ slug, model }) => (
              <Link
                key={slug}
                to={`/estimer/${slug}`}
                className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-4 py-2 text-[14px] text-[#1D1D1F] hover:border-[#6E6E73] transition-colors duration-200"
              >
                {model}
              </Link>
            ))}
          </div>
          <Link to="/estimer" className="inline-block mt-6 text-[14px] text-[#0071E3] hover:underline">
            Voir tous les modèles →
          </Link>
        </div>
      </section>
    </>
  )
}
