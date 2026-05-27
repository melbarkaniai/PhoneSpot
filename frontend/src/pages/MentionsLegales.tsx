import { Helmet } from 'react-helmet-async'

const SECTIONS = [
  {
    title: 'Éditeur du site',
    content: `PhoneSpot est édité par Mohammed EL BARKANI, agissant en qualité de particulier.
Adresse : Bordeaux, France.
Email : contact@phonespot.fr
Numéro de téléphone : 07 45 91 49 27`,
  },
  {
    title: 'Hébergement',
    content: `Le site PhoneSpot est hébergé par :
Vercel Inc.
440 N Barranca Ave #4133
Covina, CA 91723, États-Unis
https://vercel.com`,
  },
  {
    title: 'Propriété intellectuelle',
    content: `L'ensemble du contenu de ce site (textes, images, logo) est la propriété exclusive de PhoneSpot. Toute reproduction, même partielle, est interdite sans autorisation préalable.`,
  },
  {
    title: 'Données personnelles',
    content: `PhoneSpot ne collecte aucune donnée personnelle. Aucun compte utilisateur n'est requis. Les recherches effectuées sur le site restent anonymes.

Le site utilise Umami Analytics, un outil de mesure d'audience respectueux de la vie privée, sans cookie et conforme au RGPD.

Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous à : contact@phonespot.fr`,
  },
  {
    title: 'Cookies',
    content: `PhoneSpot n'utilise pas de cookies publicitaires ni de traceurs tiers. L'outil d'analyse Umami fonctionne sans cookie.`,
  },
  {
    title: 'Limitation de responsabilité',
    content: `Les prix affichés sur PhoneSpot sont fournis à titre indicatif et peuvent varier. PhoneSpot ne peut être tenu responsable des écarts entre les prix affichés et les offres réelles des repreneurs. Nous vous recommandons de vérifier les offres directement auprès des repreneurs avant toute décision.`,
  },
  {
    title: 'Contact',
    content: `Pour toute question, vous pouvez nous contacter :
Email : contact@phonespot.fr
WhatsApp : +33 7 45 91 49 27`,
  },
]

export default function MentionsLegales() {
  return (
    <>
      <Helmet>
        <title>Mentions légales — PhoneSpot</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="max-w-[720px] mx-auto px-6 py-16">
        <h1 className="font-bold text-[32px] text-[#1D1D1F] mb-8">
          Mentions légales
        </h1>

        <div className="flex flex-col gap-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-bold text-[20px] text-[#1D1D1F] mb-3">
                {section.title}
              </h2>
              <p className="text-[15px] text-[#1D1D1F] leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
