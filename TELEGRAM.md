# GhostTalk vs Telegram

GhostTalk = messagerie type **Telegram** + fonctionnalités **Ghost** (E2E, anonymat, sans trace, voix masquée, stories, bien-être).

## Déjà couvert (noyau Telegram)

| Fonctionnalité | GhostTalk |
|----------------|-----------|
| Messages texte | Oui, E2E |
| Groupes + admin | Oui |
| Médias (image, vidéo, audio, fichiers) | Oui, 50 Mo |
| Messages vocaux | Oui + voix masquée optionnelle |
| Répondre à un message | Oui |
| Accusés de lecture (✓✓) | Oui (direct + groupe partiel) |
| Recherche utilisateur @pseudo | Oui |
| Temps réel | Supabase Realtime |
| Notifications navigateur | Oui (permission) |
| Brouillons par conversation | localStorage |
| **Édition** de message | Oui (texte, expéditeur) |
| **Suppression** pour moi / pour tous | Oui |
| **Transférer** un message | Oui |
| **Réactions** emoji | Oui |
| **Épingler** un message | Oui |
| **Recherche** dans la conversation | Oui (texte déchiffré côté client) |
| **Indicateur de frappe** | Oui (broadcast) |
| **En ligne / dernière connexion** | Oui (profils) |
| **Silencieux** (mute) | Oui |
| **Archiver** une discussion | Oui |
| **Effacer l'historique** | Oui |
| **Bloquer** un utilisateur | Oui (DM) |

## Fonctionnalités Ghost (au-delà de Telegram)

- Chiffrement E2E par défaut (pas seulement « secret chat »)
- Mode fantôme (anonyme)
- Messages sans trace (timer + après lecture)
- Masquer ses accusés de lecture (bien-être)
- Stories 24h chiffrées pour contacts
- Transformation vocale optionnelle

## Non implémenté (Telegram avancé / hors scope web MVP)

- Appels vocaux / vidéo (WebRTC + infra TURN)
- Canaux (diffusion illimitée)
- Stickers / GIF Tenor
- Sondages, quiz, bots API
- Multi-appareils synchronisés type cloud Telegram (hors session Supabase)
- Dossiers / filtres personnalisés
- Thèmes multiples (un thème sombre actuel)
- Paiements, inline bots

## Migration requise

Appliquer **`013_telegram_parity.sql`** en plus des migrations 001–012.
