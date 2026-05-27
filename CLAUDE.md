# CLAUDE.md — PhoneSpot

> Lis ce fichier intégralement avant d'écrire la moindre ligne de code.
> Il prime sur toute intuition ou habitude. Chaque décision ici est intentionnelle.

---

## 1. VISION DU PROJET

PhoneSpot est un comparateur de prix de reprise iPhone. Il s'adresse à des particuliers
qui veulent savoir combien vaut leur iPhone — soit pour le vendre à un repreneur pro
(Swappie, BackMarket, Recommerce...), soit pour le vendre eux-mêmes sur Leboncoin /
Facebook Marketplace / Vinted.

**Ce qui rend ce site unique :**
- Spécialisé 100% iPhone (pas d'autres marques, jamais)
- Une offre de rachat direct "PhoneSpot Bordeaux" est épinglée dans les résultats
  (cash immédiat ou virement instantané, sans envoi postal)
- Section "Vendre soi-même" avec annonce générée par IA + guide photos + stratégie
- Design Apple-grade : minimaliste, typographie forte, zéro bruit visuel
- Zéro publicité display

---

## 2. STACK TECHNIQUE

```
Frontend : React 18 + Vite + Tailwind CSS
Backend  : FastAPI (Python) — même environnement que le scraper
Scraper  : scraper.py existant (NE PAS MODIFIER) — importé comme module Python
IA       : Anthropic API (claude-haiku-4-5-20251001) pour la génération d'annonces
Déploiement : Frontend → Vercel / Backend → Railway ou Render
```

---

## 3. SCRAPER — COMMENT L'UTILISER

> ⚠️ NE PAS MODIFIER scraper.py. NE PAS appeler via subprocess. L'importer directement.

### Import et appel

```python
# Dans backend/main.py
from scraper import search, SWAPPIE_MODELS, SWAPPIE_STORAGES, STANDARD_CONDITIONS

@app.get("/api/prices/{model}")
async def get_prices(model: str, storages: list[str] | None = Query(None)):
    data = await search(model, storages=storages)
    return data
```

### Format de retour de `search(model)`

```json
{
  "scraped_at": "2025-05-12T14:32:00Z",
  "model": "iPhone 14 Pro",
  "sources": ["Swappie", "BackMarket", "Recommerce"],
  "conditions": ["Parfait", "Très bon état", "Bon état", "Cassé"],
  "storages": ["128GB", "256GB", "512GB", "1024GB"],
  "comparison": {
    "128GB": {
      "Parfait": { "Swappie": 420, "BackMarket": 410 },
      "Très bon état": { "Swappie": 370, "BackMarket": 355 },
      "Bon état": { "Swappie": 320 },
      "Cassé": { "BackMarket": 120 }
    }
  },
  "raw": [
    {
      "source": "Swappie",
      "model": "iPhone 14 Pro",
      "storage": "128GB",
      "condition": "Parfait",
      "raw_condition": "Comme neuf",
      "price": 420,
      "currency": "EUR",
      "url": "https://swappie.com/..."
    }
  ]
}
```

### Les 4 conditions standardisées (TOUJOURS dans cet ordre)
```
"Parfait" | "Très bon état" | "Bon état" | "Cassé"
```
Ces valeurs viennent de `STANDARD_CONDITIONS` dans scraper.py. Les utiliser telles quelles
dans le formulaire frontend.

### Modèles disponibles
Les modèles viennent de `SWAPPIE_MODELS` dans scraper.py. Les exporter via une route :
```
GET /api/models → { models: [...], storages: { "iPhone 14 Pro": ["128GB", ...] } }
```

---

## 4. ROUTES BACKEND (FastAPI)

```
GET  /api/models
     → { models: string[], storages: Record<string, string[]> }
     Expose SWAPPIE_MODELS et SWAPPIE_STORAGES depuis scraper.py

GET  /api/prices/{model}?storages=128GB&storages=256GB
     → Résultat complet search() (voir format ci-dessus)
     Le cache est géré par scraper.py lui-même (fichiers dans cache/)
     TTL : 60 minutes (défini dans scraper.py, ne pas reconfigurer)

POST /api/listing
     Body: { model, storage, condition, battery, prix_max }
     → { titre, description, prix_conseille, tags }
     Appelle Anthropic API avec claude-haiku-4-5-20251001

GET  /api/phonespot-price?model=iPhone+14+Pro&storage=128GB&condition=Parfait
     → { prix: 280 } ou { prix: null } si non configuré
     Lit prices.json. Si clé absente, retourne null (la card PhoneSpot ne s'affiche pas)

POST /api/admin/prices
     Header: Authorization: Bearer {ADMIN_PASSWORD}
     Body: { "iPhone 14 Pro_128GB_Parfait": 280, ... }
     → Écrit dans prices.json

GET  /api/admin/prices
     Header: Authorization: Bearer {ADMIN_PASSWORD}
     → Contenu actuel de prices.json
```

---

## 5. DESIGN SYSTEM — STYLE APPLE, ZÉRO COMPROMIS

!! PRIORISER LE DESIGN RESPONSIVE

### Philosophie
Le design de ce site est inspiré d'Apple.com. Cela signifie :
- Beaucoup d'espace blanc. Plus qu'on ne pense naturellement.
- Une seule couleur accent. Jamais deux.
- La typographie fait le design, pas les décorations.
- Chaque élément a une raison d'exister. Si tu doutes, tu supprimes.

### Couleurs — palette complète, rien d'autre

```css
--color-bg:           #FFFFFF;    /* Fond principal */
--color-bg-secondary: #F5F5F7;    /* Sections alternées, cards formulaire */
--color-text-primary: #1D1D1F;    /* Titres, texte fort */
--color-text-secondary:#6E6E73;   /* Sous-titres, labels, metadata */
--color-border:       #D2D2D7;    /* Tous les bords */
--color-accent:       #0071E3;    /* CTAs, focus, liens — SEULE couleur bleue */
--color-accent-hover: #0077ED;    /* Hover sur accent */
--color-black:        #1D1D1F;    /* PhoneSpot card, éléments noirs */
```

Configurer dans `tailwind.config.ts` :
```ts
theme: {
  extend: {
    colors: {
      apple: {
        bg: '#F5F5F7',
        text: '#1D1D1F',
        muted: '#6E6E73',
        border: '#D2D2D7',
        accent: '#0071E3',
        black: '#1D1D1F',
      }
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
    },
    borderRadius: {
      pill: '980px',
      card: '18px',
      input: '12px',
    }
  }
}
```

### Typographie

```
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

Hero title (h1)    : Inter 700, 56px, letter-spacing -0.5px, #1D1D1F
Section title (h2) : Inter 700, 40px, letter-spacing -0.3px, #1D1D1F
Card title (h3)    : Inter 600, 20px, #1D1D1F
Body               : Inter 400, 17px, line-height 1.6, #1D1D1F
Caption / label    : Inter 400, 14px, #6E6E73
Price display      : Inter 700, 28px, #1D1D1F
```

### Composants UI — specs exactes

**Button primaire (CTA)**
```
bg-[#0071E3] text-white rounded-pill px-6 py-3 text-[17px] font-medium
hover:bg-[#0077ED] transition-opacity duration-200
Pas d'ombre. Pas de gradient. Pas de border.
```

**Button outline**
```
border border-[#0071E3] text-[#0071E3] rounded-pill px-6 py-3 text-[17px] font-medium
hover:bg-[#0071E3] hover:text-white transition-all duration-200
```

**Card standard**
```
bg-white border border-[#D2D2D7] rounded-card p-6
shadow: box-shadow: 0 2px 8px rgba(0,0,0,0.06) — subtil, jamais prononcé
```

**Input / Select**
```
border border-[#D2D2D7] rounded-input px-4 py-3 text-[17px] w-full
focus:border-[#0071E3] focus:outline-none transition-colors duration-200
```

**Navbar**
```
bg-white/85 backdrop-blur-xl border-b border-[#D2D2D7]
sticky top-0 z-50
Logo : "PhoneSpot" Inter 600 20px #1D1D1F — rien d'autre dans la nav (pas de liens)
```

**Skeleton loading**
```
bg-[#F5F5F7] rounded animate-pulse
```

### Animations -- Utilise GSAP et autres librairies
```css
/* Fade-in au scroll — à appliquer sur les sections */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-up {
  animation: fadeUp 0.5s ease-out forwards;
}

/* Toutes les transitions hover : duration-200 ease */
```
Utiliser IntersectionObserver pour déclencher fadeUp quand l'élément entre dans le viewport.

---

## 6. COMPOSANT CLÉ : PhoneConditionPicker

C'est le composant le plus important du formulaire. Il remplace les boutons radio basiques
par une sélection visuelle avec un mockup SVG d'iPhone qui change selon l'état.

### Comportement
- 4 options horizontales (2×2 sur mobile)
- Chaque option : mockup iPhone SVG + label + description courte
- L'option sélectionnée : border 2px solid #1D1D1F, fond légèrement gris
- Non sélectionnée : border 1px solid #D2D2D7, fond blanc

### Les 4 états et leurs mockups SVG

Dessiner chaque mockup iPhone comme un rectangle arrondi (le téléphone) avec des
variantes visuelles selon l'état. Les mockups sont en SVG inline, stylisés en niveaux
de gris + accent couleur uniquement pour indiquer l'état.

**Parfait** (`condition = "Parfait"`)
- Mockup : iPhone propre, sans rayure, écran lumineux (fond blanc avec reflet subtil)
- Badge SVG : petit cercle vert `#34C759` en haut à droite du mockup
- Description : "Aucune rayure visible. Écran parfait. Comme neuf."

**Très bon état** (`condition = "Très bon état"`)
- Mockup : iPhone avec 1-2 micro-rayures fines sur la tranche (lignes SVG légères)
- Badge SVG : cercle bleu `#0071E3`
- Description : "Quelques micro-rayures légères. Écran impeccable."

**Bon état** (`condition = "Bon état"`)
- Mockup : iPhone avec rayures visibles sur la face arrière (lignes SVG plus marquées)
  et éventuellement une légère marque sur un coin
- Badge SVG : cercle orange `#FF9500`
- Description : "Rayures visibles. Fonctionne parfaitement."

**Cassé** (`condition = "Cassé"`)
- Mockup : iPhone avec un écran fissuré (lignes SVG en étoile partant d'un point)
  et/ou coque endommagée
- Badge SVG : cercle rouge `#FF3B30`
- Description : "Écran fissuré ou coque très abîmée."

### Structure du composant
```tsx
interface PhoneConditionPickerProps {
  value: string;
  onChange: (condition: string) => void;
}

// Les 4 conditions viennent de STANDARD_CONDITIONS du scraper :
// ["Parfait", "Très bon état", "Bon état", "Cassé"]
```

### Mockup SVG iPhone — structure de base
```svg
<svg width="80" height="140" viewBox="0 0 80 140">
  <!-- Corps du téléphone -->
  <rect x="4" y="4" width="72" height="132" rx="14" fill="#F5F5F7" stroke="#D2D2D7" stroke-width="1.5"/>
  <!-- Dynamic island / notch -->
  <rect x="28" y="10" width="24" height="8" rx="4" fill="#1D1D1F"/>
  <!-- Écran -->
  <rect x="8" y="22" width="64" height="100" rx="4" fill="#FFFFFF"/>
  <!-- Bouton côté droit -->
  <rect x="75" y="40" width="3" height="20" rx="1.5" fill="#D2D2D7"/>
  <!-- Boutons volume gauche -->
  <rect x="2" y="36" width="3" height="14" rx="1.5" fill="#D2D2D7"/>
  <rect x="2" y="56" width="3" height="14" rx="1.5" fill="#D2D2D7"/>

  <!-- VARIANTES selon l'état — ajouter ici les rayures / fissures / etc. -->
</svg>
```

Pour "Cassé", ajouter sur l'écran :
```svg
<!-- Fissure en étoile -->
<line x1="35" y1="55" x2="20" y2="40" stroke="#1D1D1F" stroke-width="1" opacity="0.4"/>
<line x1="35" y1="55" x2="50" y2="45" stroke="#1D1D1F" stroke-width="1" opacity="0.4"/>
<line x1="35" y1="55" x2="25" y2="75" stroke="#1D1D1F" stroke-width="1" opacity="0.4"/>
<line x1="35" y1="55" x2="55" y2="70" stroke="#1D1D1F" stroke-width="1" opacity="0.4"/>
<line x1="35" y1="55" x2="35" y2="90" stroke="#1D1D1F" stroke-width="0.5" opacity="0.3"/>
<circle cx="35" cy="55" r="2" fill="#1D1D1F" opacity="0.5"/>
```

---

## 7. PAGE ACCUEIL — STRUCTURE COMPLÈTE

### Section Hero
```
Fond blanc pur. Centré. Pas d'image.

h1 : "Votre iPhone vaut combien ?"
     Inter 700, 56px, #1D1D1F, max-width 700px, centré

p  : "Comparez les offres de rachat en temps réel. Et découvrez comment en
      tirer encore plus en vendant vous-même."
     Inter 400, 21px, #6E6E73, max-width 500px, centré

Padding top : 100px. Padding bottom : 60px.
```

### Section Formulaire
```
Card : max-width 560px, centré, bg #F5F5F7, border-radius card (18px), padding 32px

Champs dans l'ordre :

1. Modèle
   Label : "Modèle"
   Select custom avec les modèles de SWAPPIE_MODELS (charger depuis GET /api/models)
   Placeholder : "Choisissez votre iPhone"

2. Capacité
   Label : "Capacité"
   Select conditionnel — options depuis SWAPPIE_STORAGES[model sélectionné]
   Disabled si aucun modèle sélectionné.
   Format d'affichage : "128 Go" (remplacer "GB" par " Go", "1024GB" → "1 To")

3. État — PhoneConditionPicker
   Label : "État de votre iPhone"
   Composant PhoneConditionPicker (voir section 6)

4. Santé batterie
   Label : "Santé de la batterie — [valeur]%"
   Slider min=70 max=100 step=1 defaultValue=90
   Thumb : bg #0071E3, w-5 h-5, rounded-full
   Track rempli : bg #0071E3. Track vide : bg #D2D2D7.

Bouton submit : "Estimer mon iPhone →"
Full width, style bouton primaire (voir section 5)
Disabled + opacity-50 si modèle ou capacité non sélectionné.
```

### Logique de navigation
Au submit, naviguer vers :
```
/results?model=iPhone+14+Pro&storage=128GB&condition=Parfait&battery=92
```
Utiliser React Router v6.

### Section Réassurance (sous le formulaire)
```
3 colonnes, gap-8, centré.
Fond blanc. Padding vertical 60px.

Col 1 : Icône SVG "grid 3×3" + "3 repreneurs comparés" + "Swappie, BackMarket, Recommerce"
Col 2 : Icône SVG "clock" + "Résultats en 30 secondes" + "Cache intelligent inclus"
Col 3 : Icône SVG "sparkle" + "Vendez vous-même" + "Annonce IA + guide inclus"

Icônes : SVG custom 24px, couleur #0071E3. Pas d'emoji.
Texte principal : Inter 600 17px #1D1D1F
Texte secondaire : Inter 400 14px #6E6E73
```

---

## 8. PAGE RÉSULTATS — STRUCTURE COMPLÈTE

### URL et paramètres
```
/results?model=iPhone+14+Pro&storage=128GB&condition=Parfait&battery=92
```
Lire les params avec `useSearchParams()`.

### En-tête
```
← Nouvelle estimation (lien retour /)

h1 : "iPhone 14 Pro · 128 Go"
     Inter 700 40px

p  : "État : Parfait · Batterie : 92%"
     Inter 400 17px #6E6E73

Timestamp : "Données mises à jour il y a X min" (calculé depuis scraped_at)
```

### Appel API et états
```tsx
// usePrices.ts
const { data, isLoading, error } = usePrices(model);

// Pendant le chargement : afficher 4 skeleton cards (animate-pulse, hauteur ~100px)
// En erreur : "Impossible de charger les offres. Réessayez." avec bouton retry
// Succès : afficher les résultats filtrés
```

**Filtrage des données :**
Depuis `data.comparison[storage][condition]`, extraire les prix par source.
Construire un tableau : `[{ source, prix, url }]` trié par prix décroissant.

### BLOC 1 — Reprise professionnelle

**Titre :** "Reprise professionnelle"
**Sous-titre :** "Envoi postal · Paiement sous 5 à 10 jours selon le repreneur"

**PhoneSpotCard (toujours en position 0)**
```
Fond #1D1D1F (noir), texte blanc, border-radius card
Toujours affichée EN PREMIER, avant les autres résultats.
Récupérer le prix via GET /api/phonespot-price?model=...&storage=...&condition=...
Si prix null : ne pas afficher la card (ne pas afficher de card vide).

Layout :
  Ligne 1 : Badge pill blanc "⚡ Cash immédiat · Bordeaux" + texte "PhoneSpot"
  Ligne 2 : Prix en Inter 700 36px blanc
  Ligne 3 : "Paiement cash le jour même. Déplacement possible sur Bordeaux."
             Inter 400 14px blanc/70%
  Bouton : "Nous contacter →" bg blanc, text #1D1D1F, rounded-pill
           Au clic : ouvre WhatsApp
           URL : https://wa.me/{WHATSAPP_NUMBER}?text=Bonjour%2C+je+veux+vendre+mon+{model}+{storage}+état+{condition}+batterie+{battery}%25
```

**ResultCard (repreneurs pros)**
```
Fond blanc, border #D2D2D7, border-radius card
Layout horizontal :

Gauche  : Rang "#1", "#2"... Inter 400 14px #6E6E73
Centre  : Nom du repreneur Inter 600 17px #1D1D1F
          Badge pill gris "5-7 jours" Inter 400 12px
Droite  : Prix Inter 700 28px #1D1D1F
          Bouton "Voir l'offre →" outline bleu rounded-pill

Au clic sur "Voir l'offre →" : ouvrir data.url dans un nouvel onglet.
```

### Séparateur entre les deux blocs
```
<div class="flex items-center gap-4 my-12">
  <div class="flex-1 h-px bg-[#D2D2D7]"></div>
  <span class="text-[14px] text-[#6E6E73] font-medium whitespace-nowrap">
    Ou vendez vous-même pour plus
  </span>
  <div class="flex-1 h-px bg-[#D2D2D7]"></div>
</div>
```

### BLOC 2 — Vendre soi-même

**Titre :** "Vous pouvez faire mieux"
**Sous-titre calculé :**
```tsx
const prixMin = Math.round(prixMaxPro * 1.3);
const prixMax = Math.round(prixMaxPro * 1.6);
// "En vendant vous-même, estimez entre 370€ et 480€ sur Leboncoin ou Facebook Marketplace"
```

---

**Sous-section A : Générateur d'annonce IA**

Card bg #F5F5F7 :
```
Titre : "Votre annonce, prête en 3 secondes"
Texte : "Notre IA génère un titre accrocheur et une description optimisée
         pour vendre rapidement sur les marketplaces françaises."
Bouton : "Générer mon annonce" (bouton primaire bleu)
```

Au clic → `POST /api/listing` avec `{ model, storage, condition, battery, prix_max: prixMaxPro }`

**Prompt système Anthropic (à utiliser tel quel dans le backend) :**
```
Tu es un expert en vente de smartphones d'occasion sur les marketplaces françaises
(Leboncoin, Facebook Marketplace, Vinted). Tu connais les codes de chaque plateforme.
Génère une annonce naturelle, honnête, qui donne envie sans survendre.
Ne jamais écrire "parfait état" pour un téléphone en "Bon état".
Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sans commentaire :
{
  "titre": "string (max 60 chars, inclut le modèle exact et un point fort clé)",
  "description": "string (150-200 mots, ton naturel de particulier, mentionne la
                  santé batterie si >= 85%, évite les superlatifs vides,
                  termine par une invitation à contacter)",
  "prix_conseille": number,
  "tags": ["string", "string", "string", "string", "string"]
}
```

**Prompt utilisateur :**
```
iPhone {model}, {storage}, état : {condition}, santé batterie : {battery}%.
Prix maximum constaté chez les repreneurs pros : {prix_max}€.
Génère l'annonce.
```

**Affichage du résultat :**
```
Fade-in animation.

Champ "Titre" :
  Label "Titre de l'annonce"
  Input readonly avec le titre
  Bouton icône clipboard SVG → copie + tooltip "Copié !"

Champ "Description" :
  Label "Description"
  Textarea readonly 6 lignes
  Bouton icône clipboard SVG → copie + tooltip "Copié !"

Ligne prix :
  "Prix conseillé : {prix_conseille}€"
  "Mettez 5-10% au-dessus pour absorber la négociation"
  Inter 400 14px #6E6E73

Tags :
  Pills grises, cliquables → copie le tag au clic, tooltip "Copié !"
```

**Fallback si API Anthropic absente / erreur :**
```ts
const FALLBACK_LISTINGS: Record<string, Record<string, object>> = {
  "iPhone 14 Pro": {
    "Parfait": {
      titre: "iPhone 14 Pro 128Go – Parfait état, jamais reconditionné",
      description: "Vends mon iPhone 14 Pro 128Go en parfait état...",
      prix_conseille: 520,
      tags: ["iPhone 14 Pro", "128Go", "parfait état", "Apple", "smartphone"]
    }
  }
  // etc. pour les modèles les plus courants
};
```

---

**Sous-section B : Guide photos**

```
Titre : "Les photos qui font vendre"
Grille : 3 colonnes desktop, 2 colonnes mobile, gap-4

6 items — chacun : Card blanche, border #D2D2D7, border-radius 12px, p-4

1. "Écran éteint"
   Icône : SVG smartphone avec reflet sur l'écran
   Texte : "Révèle les micro-rayures. Lumière naturelle latérale."

2. "Écran allumé"
   Icône : SVG smartphone avec fond blanc illuminé
   Texte : "Fond d'écran blanc, luminosité max. Prouve que l'écran fonctionne."

3. "Face arrière"
   Icône : SVG vue dos du téléphone avec module caméra
   Texte : "Surface plane, bonne lumière. Montrez les éventuelles rayures."

4. "Coins et tranches"
   Icône : SVG vue latérale du téléphone
   Texte : "Les acheteurs cherchent les chocs. Montrez-les : ça crée la confiance."

5. "Boîte originale"
   Icône : SVG boîte Apple simplifiée
   Texte : "Ajoute 10 à 20€ de valeur perçue. Indispensable si vous l'avez."

6. "Santé batterie"
   Icône : SVG écran avec jauge batterie
   Texte : "Réglages → Batterie → Santé. Un screenshot suffit."
```

---

**Sous-section C : Stratégie de publication**

```
Titre : "Quand et comment poster"

4 cards horizontales. Sur mobile : scroll horizontal natif (overflow-x-auto, no scrollbar).
Chaque card : bg #F5F5F7, border-radius 12px, p-5, min-width 200px

Card 1 — "Prix de départ"
  Valeur : "{prixMax}€"  (prixMax de la fourchette)
  Texte  : "Mettez 5-10% au-dessus pour absorber la négociation."

Card 2 — "Sans réponse ?"
  Valeur : "−5 à 8%"
  Texte  : "Baissez progressivement après 4 jours sans message."

Card 3 — "Meilleur créneau"
  Valeur : "Mer–Jeu 19h–21h"
  Texte  : "Aussi : samedi matin 9h–11h. Évitez lundi et dimanche matin."

Card 4 — "Par plateforme"
  Valeur : "LBC · FB · Vinted"
  Texte  : "LBC : misez tout sur les photos.
            FB : répondez dans l'heure.
            Vinted : dernier recours pour iPhone."
```

---

## 9. FORMULAIRE — LOGIQUE CAPACITÉ CONDITIONELLE

Les capacités disponibles varient selon le modèle. Utiliser la data de `/api/models`.

```ts
// Affichage lisible des capacités
function formatStorage(raw: string): string {
  if (raw === "1024GB") return "1 To";
  return raw.replace("GB", " Go");  // "128GB" → "128 Go"
}
```

Le select Capacité doit se réinitialiser chaque fois que le modèle change.

---

## 10. PAGE ADMIN

**Route :** `/admin`

**Auth :** Avant d'afficher quoi que ce soit, vérifier un mot de passe local.
```tsx
// Stocker le token admin dans sessionStorage (pas localStorage)
// Si non authentifié : afficher un formulaire de mot de passe simple
// POST /api/admin/prices avec header Authorization: Bearer {password}
// Si 401 : afficher erreur "Mot de passe incorrect"
```

**Interface :**
Formulaire avec une grille de prix.
Pour chaque combinaison (model × storage × condition), un input number.
Organisé par modèle (accordion ou tabs).
Bouton "Enregistrer" en bas → POST /api/admin/prices.
Confirmation : "Prix mis à jour ✓"

Design sobre, fonctionnel. Même palette, mais pas besoin d'être aussi soigné que le frontend.

---

## 11. VARIABLES D'ENVIRONNEMENT

### Frontend (`.env` dans `frontend/`)
```
VITE_API_URL=http://localhost:8000
VITE_WHATSAPP_NUMBER=33XXXXXXXXX
```

### Backend (`.env` dans `backend/`)
```
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_PASSWORD=ton_mot_de_passe_secret
```

---

## 12. CE QU'IL NE FAUT ABSOLUMENT PAS FAIRE

> Ces règles sont non-négociables. Aucune exception.

**Design**
- ❌ Pas d'image stock (téléphone Unsplash, main tenant un iPhone, etc.)
- ❌ Pas de gradient sur les boutons ou les fonds
- ❌ Pas d'ombre prononcée (box-shadow forte)
- ❌ Pas de font autre qu'Inter (pas Poppins, pas Nunito, pas Montserrat)
- ❌ Pas de couleur supplémentaire (pas d'orange, pas de violet, pas de vert dans l'UI)
- ❌ Pas de footer avec 40 liens
- ❌ Pas de section "Pourquoi nous choisir ?" avec 3 icônes emoji
- ❌ Pas de compteur animé "1 000 000 appareils vendus"
- ❌ Pas de popup newsletter
- ❌ Pas de chatbot widget
- ❌ Pas de barre de progression en haut de page
- ❌ Pas de dark mode (le site est blanc, c'est intentionnel)

**Code**
- ❌ Ne pas modifier `scraper.py`
- ❌ Ne pas appeler `scraper.py` via subprocess — l'importer comme module Python
- ❌ Ne pas utiliser Shadcn/UI, Radix, Material UI, Ant Design — tout est custom Tailwind
- ❌ Ne pas utiliser `axios` — utiliser `fetch` natif ou `ky`
- ❌ Ne pas mettre de logique métier dans les composants React — la logique va dans les hooks

**Contenu**
- ❌ Ne pas mentionner Samsung, Google Pixel, ou toute autre marque que Apple/iPhone
- ❌ Ne pas afficher la PhoneSpotCard si le prix n'est pas configuré (pas de card vide)

---

## 13. ORDRE DE DÉVELOPPEMENT RECOMMANDÉ

Claude Code doit suivre cet ordre. Ne pas sauter d'étape.

```
1. Setup projet (Vite + React + TypeScript + Tailwind + React Router)
2. tailwind.config.ts avec le design system complet (couleurs, fonts, border-radius)
3. Composants UI primitifs : Button, Card, Input, Select, Slider
4. Backend FastAPI : main.py avec routes /api/models et /api/prices/{model}
5. PhoneConditionPicker avec les 4 mockups SVG
6. Page Accueil : Hero + Formulaire complet + Réassurance
7. Hook usePrices (fetch + gestion états loading/error)
8. Page Résultats : en-tête + PhoneSpotCard + ResultCards
9. Générateur d'annonce IA (ListingGenerator + route /api/listing)
10. Guide photos (PhotoGuide — statique)
11. Stratégie publication (PublishStrategy — calculs dynamiques)
12. Page Admin
13. Polish : animations fadeUp, transitions hover, responsive mobile
```

---

## 14. COMMANDES DE DÉMARRAGE

```bash
# Backend
cd backend
pip install fastapi uvicorn anthropic python-dotenv
pip install -r requirements.txt  # dépendances de scraper.py
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # Vite sur port 5173
```

Le frontend proxifie les appels `/api/*` vers le backend via `vite.config.ts` :
```ts
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

---

*Ce fichier est la source de vérité du projet. En cas de doute sur une décision design
ou technique, la réponse est dans ce fichier. Si ce n'est pas dedans, privilégier
la simplicité et le minimalisme.*