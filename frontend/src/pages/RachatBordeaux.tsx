import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { track } from '../utils/analytics'
import { POPULAR_MODELS } from '../lib/models'

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '33600000000'
const CANONICAL = 'https://www.phonespot.fr/rachat-iphone-bordeaux'
const META_TITLE = 'Rachat iPhone Bordeaux : paiement cash le jour même | PhoneSpot'
const META_DESCRIPTION = "Vendez votre iPhone à Bordeaux sans envoi postal. Rendez-vous sur Bordeaux et alentours, paiement cash ou virement immédiat le jour même. Réponse en moins d'1h sur WhatsApp."

const STEPS = [
  {
    title: 'Estimez votre iPhone',
    text: 'Comparez en quelques secondes les offres des repreneurs en ligne pour connaître la valeur de votre modèle.',
  },
  {
    title: 'Écrivez-nous sur WhatsApp',
    text: "Indiquez le modèle, la capacité, l'état et la santé de la batterie. Réponse en moins d'1h.",
  },
  {
    title: 'Rendez-vous et paiement',
    text: 'On se retrouve sur Bordeaux ou alentours. Paiement cash ou virement immédiat le jour même.',
  },
]

const FAQ_ITEMS = [
  {
    q: 'Comment vendre mon iPhone à Bordeaux ?',
    a: "Contactez PhoneSpot sur WhatsApp avec le modèle, la capacité et l'état de votre iPhone. On fixe un rendez-vous sur Bordeaux ou alentours et vous êtes payé le jour même, en cash ou par virement immédiat.",
  },
  {
    q: 'Faut-il envoyer mon iPhone par la poste ?',
    a: "Non. Contrairement aux repreneurs en ligne, il n'y a aucun envoi postal et aucune attente de 5 à 10 jours : la vente se fait en main propre.",
  },
  {
    q: 'Comment est fixé le prix ?',
    a: "Le prix dépend du modèle, de la capacité, de l'état et de la batterie. Vous pouvez le comparer aux offres des repreneurs en ligne sur PhoneSpot avant de nous contacter.",
  },
]

const LOCAL_BUSINESS_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'PhoneSpot',
  description: 'Rachat direct d’iPhone à Bordeaux et alentours, paiement cash ou virement immédiat le jour même.',
  url: CANONICAL,
  telephone: '+33745914927',
  email: 'contact@phonespot.fr',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bordeaux',
    addressCountry: 'FR',
  },
  areaServed: [
    'Bordeaux',
    'Mérignac',
    'Pessac',
    'Talence',
    'Bègles',
    'Le Bouscat',
    'Eysines',
    'Villenave-d’Ornon',
    'Bruges',
    'Cenon',
  ].map((name) => ({ '@type': 'City', name })),
  sameAs: ['https://share.google/jHNyMgycB83OafcCs'],
}

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}

const BREADCRUMB_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.phonespot.fr/' },
    { '@type': 'ListItem', position: 2, name: 'Rachat iPhone Bordeaux', item: CANONICAL },
  ],
}

export default function RachatBordeaux() {
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=Bonjour%2C+je+souhaite+vendre+mon+iPhone+%C3%A0+Bordeaux`

  return (
    <>
      <Helmet>
        <title>{META_TITLE}</title>
        <meta name="description" content={META_DESCRIPTION} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={META_TITLE} />
        <meta property="og:description" content={META_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="PhoneSpot" />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:locale" content="fr_FR" />
        <script type="application/ld+json">{JSON.stringify(LOCAL_BUSINESS_JSON_LD)}</script>
        <script type="application/ld+json">{JSON.stringify(FAQ_JSON_LD)}</script>
        <script type="application/ld+json">{JSON.stringify(BREADCRUMB_JSON_LD)}</script>
      </Helmet>

      <section className="bg-white pt-16 pb-12 px-6">
        <div className="max-w-[680px] mx-auto">
          <nav aria-label="Fil d'Ariane" className="text-[14px] text-[#6E6E73] mb-6">
            <Link to="/" className="hover:text-[#1D1D1F] transition-colors duration-200">Accueil</Link>
            <span className="mx-2">›</span>
            <span aria-current="page" className="text-[#1D1D1F]">Rachat iPhone Bordeaux</span>
          </nav>
          <span className="inline-block bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] text-sm rounded-pill px-4 py-1.5 mb-5">
            Bordeaux · Acheteur local
          </span>
          <h1 className="font-bold text-[28px] md:text-[40px] text-[#1D1D1F] leading-[1.1] tracking-[-0.5px]">
            Rachat d'iPhone à Bordeaux, payé le jour même
          </h1>
          <p className="text-[17px] text-[#6E6E73] mt-4 leading-relaxed">
            Vous voulez vendre votre iPhone à Bordeaux sans envoi postal ni attente de 10 jours ?
            PhoneSpot Bordeaux rachète directement votre iPhone, sur Bordeaux et alentours, avec un
            paiement cash ou par virement immédiat le jour même.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('clic_whatsapp_bordeaux', { source: 'bordeaux_page' })}
              className="text-center bg-[#0071E3] text-white rounded-pill px-6 py-3 text-[17px] font-medium hover:bg-[#0077ED] transition-opacity duration-200"
            >
              Nous contacter sur WhatsApp →
            </a>
            <Link
              to="/estimer"
              className="text-center border border-[#0071E3] text-[#0071E3] rounded-pill px-6 py-3 text-[17px] font-medium hover:bg-[#0071E3] hover:text-white transition-all duration-200"
            >
              Estimer mon iPhone
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6">
            {["Réponse en moins d'1h", 'Paiement cash ou virement', 'Déplacement Bordeaux et alentours', 'Sans envoi postal'].map((t) => (
              <span key={t} className="text-[14px] text-[#6E6E73]">&#10003; {t}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F5F5F7] py-16 px-6">
        <div className="max-w-[900px] mx-auto">
          <h2 className="font-bold text-[24px] sm:text-[32px] text-[#1D1D1F] text-center mb-10 tracking-[-0.3px]">
            Comment vendre votre iPhone à Bordeaux
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="bg-white border border-[#D2D2D7] rounded-card p-6">
                <p className="text-[14px] text-[#6E6E73]">Étape {i + 1}</p>
                <h3 className="font-semibold text-[20px] text-[#1D1D1F] mt-1">{step.title}</h3>
                <p className="text-[15px] text-[#6E6E73] mt-2 leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white py-16 px-6">
        <div className="max-w-[680px] mx-auto">
          <h2 className="font-bold text-[24px] sm:text-[32px] text-[#1D1D1F] mb-6 tracking-[-0.3px]">
            Repreneur en ligne ou rachat local ?
          </h2>
          <p className="text-[17px] text-[#1D1D1F] leading-relaxed">
            Les repreneurs en ligne (Swappie, BackMarket, Recommerce…) demandent d'envoyer
            l'iPhone par la poste puis paient sous 5 à 10 jours. À Bordeaux, PhoneSpot vous propose
            une vente en main propre et un paiement immédiat. Comparez d'abord les offres en ligne
            pour votre modèle, puis choisissez l'option qui vous convient.
          </p>
          <p className="text-[15px] text-[#6E6E73] mt-6 mb-3">Estimer un modèle :</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_MODELS.map(({ slug, model }) => (
              <Link
                key={slug}
                to={`/estimer/${slug}`}
                className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-pill px-4 py-2 text-[14px] text-[#1D1D1F] hover:border-[#6E6E73] transition-colors duration-200"
              >
                Rachat {model}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F5F5F7] py-16 px-6">
        <div className="max-w-[680px] mx-auto">
          <h2 className="font-bold text-[24px] sm:text-[32px] text-[#1D1D1F] mb-8 tracking-[-0.3px]">
            Questions fréquentes
          </h2>
          <div className="flex flex-col gap-6">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q}>
                <h3 className="font-semibold text-[17px] text-[#1D1D1F]">{item.q}</h3>
                <p className="text-[15px] text-[#6E6E73] mt-2 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
