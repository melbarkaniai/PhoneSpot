"""
AI listing generator.
Priority: Gemini → Anthropic → Static fallback
"""

import json
import logging
import os
import random
import re

import httpx
from typing import Optional

logger = logging.getLogger("ai_generator")

# ─── PROMPT TEMPLATES ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Tu es un particulier français qui vend son iPhone
sur les marketplaces. Tu n'es PAS un professionnel, PAS un revendeur,
PAS une entreprise. Tu parles naturellement, comme un vrai particulier
qui veut vendre son téléphone rapidement au meilleur prix.

RÈGLES ABSOLUES :
- Écris comme un vrai particulier — naturel, direct, humain
- Jamais de langage corporate ou marketing ("produit de qualité",
  "satisfait ou remboursé", "n'hésitez pas")
- Jamais de superlatifs vides ("super", "excellent", "top", "nickel")
- Toujours mentionner la santé batterie avec le pourcentage exact
- Toujours préciser que iCloud est désactivé — c'est ce que
  tout acheteur vérifie en premier
- Si défauts : les nommer précisément et honnêtement
  Un vendeur honnête sur les défauts inspire PLUS confiance
- Prix légèrement au-dessus pour laisser une marge de négociation
- Mentionner la raison de la vente (passage à un nouveau modèle,
  plus besoin...) — ça rassure l'acheteur sur l'authenticité

CODES PAR PLATEFORME :

LEBONCOIN (150-180 mots) :
  Ton : sobre, factuel, honnête. Zéro emoji. Pas de point d'exclamation.
  Structure en 3 paragraphes :
  §1 : "Je vends mon [modèle]..." + raison courte de la vente
       + état résumé en une phrase honnête
  §2 : Détails précis — batterie %, état écran, dos, coins
       Si parfait : le dire clairement avec détails concrets
       Si défauts : les localiser ("légère rayure sur le dos côté gauche")
       Accessoires inclus ou non
  §3 : iCloud désactivé, remise en main propre, moyen de paiement
  Terminer par : "Prix ferme." ou "Prix négociable pour achat rapide."

  Psychologie :
  - Utiliser des prix psychologiques (249€ pas 250€)
  - Mentionner "premier arrivé premier servi" si parfait état
  - Répondre rapidement dans les messages augmente les ventes de 40%

FACEBOOK MARKETPLACE (100-130 mots) :
  Ton : chaleureux, conversationnel, de quartier. Max 1-2 emoji.
  Structure :
  - Ligne 1 accrocheuse avec l'essentiel (modèle, état, prix)
  - Raconter brièvement l'histoire du téléphone
    ("utilisé soigneusement", "toujours eu une coque")
  - Points rassurants : batterie, écran, iCloud off
  - Terminer par une invitation directe à écrire
    ("Écrivez-moi, je réponds vite !")
  - Mentionner disponibilité pour se rencontrer

  Psychologie :
  - La proximité géographique est un argument fort sur FB
  - Répondre dans l'heure double les chances de vente
  - Photo de profil réelle = plus de confiance

VINTED (50-70 mots MAXIMUM + 5 hashtags) :
  Ton : direct, jeune, sans chichis. Pas de formule de politesse.
  Structure :
  - Ligne 1 : état + modèle + point fort en une phrase
  - Ligne 2 : batterie + accessoires
  - Ligne 3 : iCloud off + un éventuel défaut si applicable
  - Saut de ligne puis exactement 5 hashtags pertinents

  Hashtags iPhone qui fonctionnent sur Vinted en 2025 :
  #iPhone #Apple #Smartphone #TechOccasion #iPhoneOccasion
  Adapter selon modèle : #iPhone14Pro #iPhone15 etc.
  Selon état : #ParfaitEtat #TresBonEtat #BonEtat

  Note : Vinted fonctionne MOINS bien pour les iPhones récents
  car l'audience cherche surtout des vêtements.
  Mentionner ce fait dans une note après la description si pertinent.

EBAY (200-230 mots, structuré et technique) :
  Ton : professionnel, précis, exhaustif. Aucun emoji.
  Les acheteurs eBay sont plus exigeants et vérifient tout.
  Structure obligatoire :
  §1 FICHE TECHNIQUE (liste avec tirets) :
    - Modèle exact
    - Stockage
    - Santé batterie : X%
    - État cosmétique : [description précise]
    - iCloud : Désactivé ✓
    - Accessoires inclus
  §2 ÉTAT DÉTAILLÉ (3-4 phrases) :
    Chaque défaut avec localisation précise.
    "Aucun défaut constaté" si parfait — ne pas survendre
  §3 FONCTIONNALITÉS VÉRIFIÉES :
    Face ID, caméras, haut-parleurs, connectivité, écran (pixels morts ?)
  §4 EXPÉDITION :
    Emballage protecteur, numéro de suivi fourni
    Paiement eBay uniquement
    Retours acceptés selon politique eBay

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
{
  "titre": "string (max 60 chars, modèle + capacité + argument clé)",
  "description": "string (respecter STRICTEMENT longueur et format plateforme)",
  "prix_conseille": number (entier, pas de décimales),
  "tags": ["string", "string", "string", "string", "string"]
}"""


def build_user_prompt(
    model: str,
    storage: str,
    condition: str,
    battery: int,
    prix_max: float,
    platform: str,
) -> str:
    return (
        f"iPhone {model}, {storage}, état : {condition}, "
        f"santé batterie : {battery}%.\n"
        f"Prix maximum constaté chez les repreneurs pros : {prix_max}€.\n"
        f"Plateforme cible : {platform}.\n"
        f"Génère l'annonce."
    )


def parse_ai_response(text: str) -> dict:
    """Parse JSON from AI response, handle common formatting issues."""
    # Strip markdown fences
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            if part.startswith("json"):
                text = part[4:].strip()
                break
            elif "{" in part:
                text = part.strip()
                break

    text = text.strip()

    # Remove control characters that break JSON parsing
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    # Replace literal newlines inside strings with \n
    def escape_newlines_in_strings(json_str: str) -> str:
        result = []
        in_string = False
        i = 0
        while i < len(json_str):
            char = json_str[i]
            if char == '"' and (i == 0 or json_str[i-1] != '\\'):
                in_string = not in_string
                result.append(char)
            elif in_string and char == '\n':
                result.append('\\n')
            elif in_string and char == '\r':
                result.append('\\r')
            elif in_string and char == '\t':
                result.append('\\t')
            else:
                result.append(char)
            i += 1
        return ''.join(result)

    text = escape_newlines_in_strings(text)

    # Extract JSON object if surrounded by text
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        text = json_match.group()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} — text: {text[:200]}")
        raise


# ─── OLLAMA ────────────────────────────────────────────────────────────────────

async def generate_with_ollama(
    model: str,
    storage: str,
    condition: str,
    battery: int,
    prix_max: float,
    platform: str,
) -> Optional[dict]:
    """
    Generate listing using local Ollama instance.
    No API key needed. Runs entirely on local machine.
    """
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")

    try:
        user_prompt = build_user_prompt(
            model, storage, condition, battery, prix_max, platform
        )

        full_prompt = f"{SYSTEM_PROMPT}\n\nUtilisateur: {user_prompt}\n\nRéponds UNIQUEMENT en JSON valide:"

        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": ollama_model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 1024,
                    },
                },
            )

        if r.status_code != 200:
            logger.error(f"Ollama HTTP {r.status_code}: {r.text[:200]}")
            return None

        text = r.json().get("response", "")
        if not text:
            return None

        result = parse_ai_response(text)
        logger.info(f"Ollama generated listing for {model} {storage} {condition}")
        return result

    except httpx.ConnectError:
        logger.warning("Ollama not running — skipping (start with: ollama serve)")
        return None
    except Exception as e:
        logger.error(f"Ollama error: {e}")
        return None


# ─── GEMINI ────────────────────────────────────────────────────────────────────

async def generate_with_gemini(
    model: str,
    storage: str,
    condition: str,
    battery: int,
    prix_max: float,
    platform: str,
) -> Optional[dict]:
    """Generate listing using Groq (free tier). Returns None on failure."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set — skipping Groq")
        return None
    try:
        user_prompt = build_user_prompt(
            model, storage, condition, battery, prix_max, platform
        )
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1024,
                    "response_format": {"type": "json_object"},
                },
            )
        if r.status_code != 200:
            logger.error(f"Groq HTTP {r.status_code}: {r.text[:200]}")
            return None
        text = r.json()["choices"][0]["message"]["content"]
        json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if json_match:
            text = json_match.group()
        result = parse_ai_response(text)
        logger.info(f"Groq generated listing for {model} {storage} {condition}")
        return result
    except Exception as e:
        logger.error(f"Groq error: {e}")
        return None


# ─── ANTHROPIC ─────────────────────────────────────────────────────────────────

async def generate_with_anthropic(
    model: str,
    storage: str,
    condition: str,
    battery: int,
    prix_max: float,
    platform: str,
) -> Optional[dict]:
    """Generate listing using Anthropic Claude. Returns None on failure."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — skipping Anthropic")
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        user_prompt = build_user_prompt(model, storage, condition, battery, prix_max, platform)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        result = parse_ai_response(message.content[0].text)
        logger.info(f"Anthropic generated listing for {model} {storage} {condition}")
        return result
    except Exception as e:
        logger.error(f"Anthropic error: {e}")
        return None


# ─── STATIC FALLBACK ───────────────────────────────────────────────────────────

def generate_static_fallback(
    model: str,
    storage: str,
    condition: str,
    battery: int,
    prix_max: float,
    platform: str,
) -> dict:
    """
    Rich template-based listing generator.
    Multiple variants per condition/platform, random rotation.
    No AI needed — produces natural, varied descriptions.
    """

    storage_label = storage.replace("GB", " Go").replace("1024 Go", "1 To")
    battery_mention = f"santé batterie à {battery}%" if battery >= 80 else f"batterie à {battery}%"

    prix_map = {
        "Parfait":       round(prix_max * 1.55),
        "Très bon état": round(prix_max * 1.40),
        "Bon état":      round(prix_max * 1.25),
        "Cassé":         round(prix_max * 0.85),
    }
    prix = prix_map.get(condition, round(prix_max * 1.3))
    prix = round(prix / 5) * 5

    # ── TITRES ──────────────────────────────────────────────────────────────
    titres = {
        "Parfait": [
            f"{model} {storage_label} – Parfait état, jamais reconditionné",
            f"{model} {storage_label} – Comme neuf, {battery_mention}",
            f"Vends {model} {storage_label} parfait état – boîte d'origine",
            f"{model} {storage_label} neuf ou presque – {battery_mention}",
        ],
        "Très bon état": [
            f"{model} {storage_label} – Très bon état, {battery_mention}",
            f"{model} {storage_label} – Quasi neuf, aucune rayure écran",
            f"Vends {model} {storage_label} très bon état – {battery_mention}",
            f"{model} {storage_label} – Excellent état général, {battery_mention}",
        ],
        "Bon état": [
            f"{model} {storage_label} – Bon état, fonctionne parfaitement",
            f"{model} {storage_label} – Traces d'usage, {battery_mention}",
            f"Vends {model} {storage_label} bon état – prix honnête",
            f"{model} {storage_label} – Bon état fonctionnel, {battery_mention}",
        ],
        "Cassé": [
            f"{model} {storage_label} – Pour pièces ou réparation",
            f"{model} {storage_label} – Écran cassé, reste fonctionnel",
            f"Vends {model} {storage_label} cassé – idéal réparation",
            f"{model} {storage_label} – Endommagé, {battery_mention}",
        ],
    }

    # ── DESCRIPTIONS PAR PLATEFORME ET CONDITION ────────────────────────────

    descriptions = {
        "leboncoin": {
            "Parfait": [
                f"Je vends mon {model} {storage_label} en parfait état. "
                f"L'appareil n'a jamais été reconditionné ni réparé depuis son achat. "
                f"Aucune rayure visible sur l'écran, le dos et les tranches sont impeccables. "
                f"Santé batterie : {battery}%, comme au premier jour. "
                f"Vendu avec la boîte d'origine, le câble et les accessoires. "
                f"Face ID fonctionne parfaitement, toutes les fonctionnalités sont opérationnelles. "
                f"iCloud désactivé, prêt à être configuré avec votre compte. "
                f"Disponible pour remise en main propre. "
                f"Paiement en espèces ou virement instantané uniquement. Prix ferme.",

                f"Vends {model} {storage_label} en parfait état de conservation. "
                f"Utilisé avec une coque et une protection d'écran dès le premier jour, "
                f"aucune trace d'usure. Santé batterie {battery}%. "
                f"Toutes les fonctions sont opérationnelles : Face ID, caméras, haut-parleurs, "
                f"connectivité 5G/WiFi/Bluetooth. "
                f"Boîte d'origine présente. iCloud désactivé avant la vente. "
                f"Sérieux vendeur, réponse rapide. "
                f"Espèces ou virement instantané. Prix ferme.",
            ],
            "Très bon état": [
                f"Je vends mon {model} {storage_label} en très bon état. "
                f"Quelques micro-rayures légères sur le dos, invisibles en utilisation normale. "
                f"L'écran est parfait, aucune rayure visible. "
                f"Santé batterie : {battery}%. "
                f"Face ID, caméras et haut-parleurs 100% fonctionnels. "
                f"iCloud désactivé, prêt à l'emploi. "
                f"Je peux fournir des photos supplémentaires sur demande. "
                f"Remise en main propre uniquement. "
                f"Paiement espèces ou virement instantané. Prix négociable.",

                f"Vends {model} {storage_label} en très bon état général. "
                f"Légères marques d'usage sur la coque, écran sans défaut. "
                f"Batterie {battery}% — excellente autonomie. "
                f"Appareil complet et fonctionnel : Face ID, GPS, caméras testées. "
                f"iCloud désactivé et réinitialisation effectuée. "
                f"Disponible rapidement. Sérieux et réponse assurée dans la journée. "
                f"Espèces ou virement. Prix à débattre.",
            ],
            "Bon état": [
                f"Je vends mon {model} {storage_label} en bon état de fonctionnement. "
                f"Rayures visibles sur le dos dues à un usage quotidien sans coque — "
                f"honnête sur les défauts. L'écran fonctionne parfaitement. "
                f"Santé batterie : {battery}%. "
                f"Face ID opérationnel, caméras et haut-parleurs fonctionnels. "
                f"iCloud désactivé. Prix en rapport avec l'état. "
                f"Photos disponibles sur demande. Espèces uniquement.",

                f"Vends {model} {storage_label} bon état. "
                f"Des rayures d'usage sur le dos et les tranches, "
                f"c'est un téléphone qui a servi — je préfère être transparent. "
                f"Écran sans fissure, fonctionnel. Batterie {battery}%. "
                f"Toutes les fonctions marchent : Face ID, caméras, 5G. "
                f"iCloud désactivé, prêt à utiliser. "
                f"Prix honnête en rapport avec l'état réel. "
                f"Remise en main propre. Espèces ou virement.",
            ],
            "Cassé": [
                f"Je vends mon {model} {storage_label} pour pièces ou réparation. "
                f"L'écran est fissuré / la coque est endommagée — décrit honnêtement. "
                f"L'appareil s'allume et reste utilisable malgré les dégâts. "
                f"Santé batterie : {battery}%. Face ID fonctionnel. "
                f"Idéal pour quelqu'un qui souhaite le faire réparer "
                f"ou récupérer des composants. iCloud désactivé. "
                f"Prix très bas, ouvert à la discussion. Espèces uniquement.",
            ],
        },

        "facebook": {
            "Parfait": [
                f"📱 Mon {model} {storage_label} cherche un nouveau propriétaire ! "
                f"Appareil en parfait état, jamais reconditionné. "
                f"Aucune rayure sur l'écran ou le dos, batterie à {battery}% comme neuf. "
                f"Vendu avec boîte et accessoires d'origine. iCloud désactivé. "
                f"N'hésitez pas à m'envoyer un message pour plus de photos ou d'infos !",

                f"Je vends mon {model} {storage_label} en parfait état 🔥 "
                f"Utilisé très soigneusement, toujours avec coque et protection écran. "
                f"Batterie {battery}%, aucun défaut. Face ID nickel, caméras top. "
                f"Boîte d'origine incluse. iCloud off, prêt à configurer. "
                f"Dispo pour se rencontrer, réponse rapide garantie 😊",
            ],
            "Très bon état": [
                f"📱 Je vends mon {model} {storage_label} en très bon état ! "
                f"Quelques micro-rayures légères sur le dos mais l'écran est impeccable. "
                f"Batterie {battery}%, tout fonctionne parfaitement. "
                f"iCloud désactivé. Envoyez-moi un message, je réponds vite !",

                f"Vends {model} {storage_label} très bon état 👌 "
                f"Légers signes d'usage sur la coque, écran sans défaut. "
                f"Batterie {battery}% — autonomie top. Face ID et caméras OK. "
                f"iCloud off. Photos dispo sur demande. Réponse rapide !",
            ],
            "Bon état": [
                f"Je vends mon {model} {storage_label} en bon état. "
                f"Rayures d'usage visibles sur le dos, l'écran est fonctionnel sans fissure. "
                f"Batterie {battery}%. Tout fonctionne : Face ID, caméras, 5G. "
                f"Prix honnête en rapport avec l'état. "
                f"N'hésitez pas à me contacter pour des photos supplémentaires !",
            ],
            "Cassé": [
                f"Vends {model} {storage_label} pour pièces ou réparation. "
                f"Écran cassé mais l'appareil s'allume. Batterie {battery}%. "
                f"Idéal pour réparation ou récupération de pièces. "
                f"Prix très bas, à discuter. Envoyez un message !",
            ],
        },

        "vinted": {
            "Parfait": [
                f"{model} {storage_label} parfait état. Aucune rayure. "
                f"Batterie {battery}%. Boîte originale. iCloud off. "
                f"#iPhone #Apple #{model.replace(' ', '')} "
                f"#iPhoneOccasion #SmartphoneOccasion #ParfaitEtat #Reconditionné",
            ],
            "Très bon état": [
                f"{model} {storage_label} très bon état. Micro-rayures légères. "
                f"Écran parfait. Batterie {battery}%. Fonctionne parfaitement. "
                f"#iPhone #Apple #{model.replace(' ', '')} "
                f"#iPhoneOccasion #TrèsBonEtat #SmartphoneOccasion #Occasion",
            ],
            "Bon état": [
                f"{model} {storage_label} bon état. Rayures d'usage. "
                f"Écran OK. Batterie {battery}%. Tout fonctionne. "
                f"#iPhone #Apple #{model.replace(' ', '')} "
                f"#iPhoneOccasion #BonEtat #Occasion #PrixBas",
            ],
            "Cassé": [
                f"{model} {storage_label} pour pièces. Écran cassé. "
                f"Batterie {battery}%. S'allume encore. "
                f"#iPhone #Apple #PourPièces #Cassé #Réparation #iPhoneOccasion",
            ],
        },

        "ebay": {
            "Parfait": [
                f"📱 Fiche technique : {model} — Stockage : {storage_label} — "
                f"Santé batterie : {battery}% — État : Parfait\n\n"
                f"Vente de {model} {storage_label} en parfait état, jamais reconditionné. "
                f"Aucune rayure constatée sur l'écran, le dos et les quatre tranches. "
                f"Tous les coins sont intacts. "
                f"Fonctionnalités vérifiées : Face ID opérationnel, caméras principale et selfie testées, "
                f"haut-parleurs fonctionnels, connectivité 5G/WiFi/Bluetooth vérifiée, "
                f"aucun pixel mort constaté sur l'écran. "
                f"Vendu avec boîte d'origine et câble. "
                f"iCloud désactivé, réinitialisation complète effectuée avant expédition. "
                f"Expédition soignée avec emballage protecteur. Numéro de suivi fourni. "
                f"Paiement uniquement via eBay. Retours acceptés.",
            ],
            "Très bon état": [
                f"📱 Fiche technique : {model} — Stockage : {storage_label} — "
                f"Santé batterie : {battery}% — État : Très bon état\n\n"
                f"Vente de {model} {storage_label} en très bon état. "
                f"Légères micro-rayures sur le dos, invisibles en utilisation courante. "
                f"Écran sans rayure ni fissure. "
                f"Face ID, caméras, haut-parleurs et connectivité 100% fonctionnels. "
                f"iCloud désactivé, réinitialisation complète effectuée. "
                f"Expédition avec emballage protecteur, suivi fourni. "
                f"Paiement via eBay uniquement.",
            ],
            "Bon état": [
                f"📱 Fiche technique : {model} — Stockage : {storage_label} — "
                f"Santé batterie : {battery}% — État : Bon état\n\n"
                f"Vente de {model} {storage_label} en bon état fonctionnel. "
                f"Rayures visibles sur le dos dues à un usage quotidien normal. "
                f"Légère marque sur un coin. Écran fonctionnel sans fissure. "
                f"Face ID, caméras et haut-parleurs opérationnels. "
                f"iCloud désactivé, réinitialisation effectuée. "
                f"Expédition sécurisée avec suivi. Paiement via eBay.",
            ],
            "Cassé": [
                f"📱 Fiche technique : {model} — Stockage : {storage_label} — "
                f"Santé batterie : {battery}% — État : Endommagé\n\n"
                f"Vente de {model} {storage_label} pour pièces détachées ou réparation. "
                f"Écran fissuré / coque endommagée — décrit honnêtement. "
                f"L'appareil s'allume. Face ID et caméras testés fonctionnels. "
                f"iCloud désactivé. Prix reflétant l'état. "
                f"Expédition sécurisée avec suivi. Paiement via eBay.",
            ],
        },
    }

    # Sélection plateforme avec fallback
    platform_key = platform.lower()
    if "leboncoin" in platform_key or "lbc" in platform_key:
        platform_key = "leboncoin"
    elif "facebook" in platform_key or "fb" in platform_key:
        platform_key = "facebook"
    elif "vinted" in platform_key:
        platform_key = "vinted"
    elif "ebay" in platform_key:
        platform_key = "ebay"
    else:
        platform_key = "leboncoin"

    cond_titres = titres.get(condition, titres["Bon état"])
    titre = random.choice(cond_titres)[:60]

    platform_descs = descriptions.get(platform_key, descriptions["leboncoin"])
    cond_descs = platform_descs.get(condition, platform_descs.get("Bon état", [""]))
    description = random.choice(cond_descs)

    tags = [model, storage_label, condition, "Apple", "iPhone"]
    if platform_key == "vinted":
        tags = [
            f"#{model.replace(' ', '')}",
            "#iPhone",
            "#Apple",
            f"#{storage_label.replace(' ', '')}",
            "#iPhoneOccasion",
        ]

    return {
        "titre": titre,
        "description": description,
        "prix_conseille": prix,
        "tags": tags,
        "source": "template",
    }


# ─── MAIN ENTRY POINT ──────────────────────────────────────────────────────────

async def generate_listing(
    model: str,
    storage: str,
    condition: str,
    battery: int,
    prix_max: float,
    platform: str = "leboncoin",
) -> dict:
    """
    Generate listing with fallback chain:
    1. Ollama local (primary — free, unlimited, no API key)
    2. Groq (fallback — free tier)
    3. Anthropic Claude (fallback)
    4. Static template (last resort)
    """
    # 1. Try Ollama (local)
    result = await generate_with_ollama(
        model, storage, condition, battery, prix_max, platform
    )
    if result:
        result["source"] = "ollama"
        return result

    # 2. Try Groq
    result = await generate_with_gemini(
        model, storage, condition, battery, prix_max, platform
    )
    if result:
        result["source"] = "groq"
        return result

    # 3. Try Anthropic
    result = await generate_with_anthropic(
        model, storage, condition, battery, prix_max, platform
    )
    if result:
        result["source"] = "anthropic"
        return result

    # 4. Static fallback
    logger.warning("All AI providers failed — using static fallback")
    return generate_static_fallback(
        model, storage, condition, battery, prix_max, platform
    )
