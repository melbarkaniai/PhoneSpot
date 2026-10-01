import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ModelDirectory from '../components/ModelDirectory'

const TITLE = 'Prix de reprise iPhone par modèle — iPhone 11 à 17 | PhoneSpot'
const DESCRIPTION = 'Choisissez votre modèle d\'iPhone et comparez les offres de rachat de 10+ repreneurs. De l\'iPhone 11 à l\'iPhone 17 Pro Max.'
const CANONICAL = 'https://www.phonespot.fr/estimer'

const BREADCRUMB_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.phonespot.fr/' },
    { '@type': 'ListItem', position: 2, name: 'Estimer', item: CANONICAL },
  ],
}

// Hub page: target of the "Estimer" breadcrumb level on every model page.
export default function EstimerIndex() {
  return (
    <>
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="PhoneSpot" />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:locale" content="fr_FR" />
        <script type="application/ld+json">{JSON.stringify(BREADCRUMB_JSON_LD)}</script>
      </Helmet>

      <section className="bg-white pt-16 pb-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <nav aria-label="Fil d'Ariane" className="text-[14px] text-[#6E6E73] mb-6">
            <Link to="/" className="hover:text-[#1D1D1F] transition-colors duration-200">Accueil</Link>
            <span className="mx-2">›</span>
            <span aria-current="page" className="text-[#1D1D1F]">Estimer</span>
          </nav>
          <h1 className="font-bold text-[28px] md:text-[40px] text-[#1D1D1F] leading-[1.1] tracking-[-0.5px]">
            Estimer votre iPhone
          </h1>
          <p className="text-[17px] text-[#6E6E73] mt-3 mb-12 max-w-[560px] leading-relaxed">
            Choisissez votre modèle pour comparer les offres de reprise.
          </p>
          <ModelDirectory />
        </div>
      </section>
    </>
  )
}
