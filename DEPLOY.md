# Déployer GhostTalk

Guide pour mettre en production le frontend Next.js et le backend Supabase.

## Prérequis

- Compte [Supabase](https://supabase.com)
- Compte [Vercel](https://vercel.com) (ou autre hébergeur Node.js)
- Node.js 20+ en local
- CLI Supabase optionnelle : `npm install -g supabase`

---

## 1. Supabase — projet et base

### Créer le projet

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Note l’**URL** et la clé **anon** (`Settings` → `API`)

### Appliquer les migrations SQL

Dans **SQL Editor**, exécute **dans l’ordre** chaque fichier de `supabase/migrations/` :

| Fichier | Contenu |
|---------|---------|
| `001_profiles.sql` | Profils |
| `002_conversations.sql` | Conversations directes |
| `003_messages.sql` | Messages |
| `004_rls_policies.sql` | Sécurité RLS |
| `005_group_roles.sql` | Groupes |
| `006_fix_group_member_user_id.sql` | Fix ajout membres |
| `007_leave_group.sql` | Quitter un groupe |
| `008_conversation_names.sql` | Noms de groupes |
| `009_storage_media.sql` | Bucket fichiers chiffrés |
| `010_unread_messages.sql` | Non-lus (sidebar) |
| `011_message_reads_ephemeral.sql` | Accusés de lecture + messages sans trace |
| `012_stories.sql` | Statuts 24h + bucket `story-media` |
| `013_telegram_parity.sql` | Édition, réactions, épinglage, archive, mute, blocage, présence |
| `019_calls.sql` | Appels audio/vidéo WebRTC + signaux |
| `020_calls_fix.sql` | Grants RPC appels + Realtime (si 019 déjà appliqué à la main) |

Ou en CLI (depuis la racine du repo) :

```bash
supabase login
supabase link --project-ref VOTRE_PROJECT_REF
supabase db push
```

### Base déjà créée (erreur « relation already exists »)

Si tu as déjà exécuté les SQL à la main et `db push` plante parce que les tables existent :

**Option A — SQL Editor (simple)**  
1. Ouvre `supabase/scripts/mark-existing-migrations.sql` dans **SQL Editor** → Run.  
2. En local : `supabase db push` (ne devrait appliquer que `019_calls` + `020_calls_fix`).

**Option B — CLI** (versions **`001`**, pas `001_profiles`)  
```bash
chmod +x scripts/sync-db-migrations.sh
./scripts/sync-db-migrations.sh
```

Si `supabase migration list` montre déjà `001`–`014` côté Remote, marque seulement le reste puis pousse les appels :

```bash
supabase migration repair 015 016 017 018 --status applied
supabase db push
```

Pour voir l’état : `supabase migration list` ou `supabase/scripts/diagnose_remote.sql` dans le SQL Editor.

Si `calls` existe déjà, ajoute `019` dans `mark-existing-migrations.sql` ou `supabase migration repair 019 --status applied`, puis `db push` pour `020` seulement.

### Vérifier le bucket Storage

Après `009_storage_media.sql` :

- **Storage** → bucket `conversation-media` (privé, limite 50 Mo)

### Authentication

**Authentication** → **URL Configuration** :

| Champ | Valeur locale | Valeur production |
|-------|---------------|-------------------|
| Site URL | `http://localhost:3000` | `https://votre-domaine.vercel.app` |
| Redirect URLs | `http://localhost:3000/auth/callback` | `https://votre-domaine.vercel.app/auth/callback` |

**Providers** :

- **Anonymous** : activé (mode Fantôme)
- **Email** : activé ; confirmer les templates si besoin
- **Phone** : optionnel (SMS via Twilio / MessageBird configuré dans Supabase)

**Realtime** : la table `messages` doit être dans la publication `supabase_realtime` (migration `003`).

---

## 2. Frontend — variables d’environnement

Copie `web/.env.local.example` vers `web/.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Test local :

```bash
cd web
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

---

## 3. Déploiement sur Vercel (recommandé)

### Option A — GitHub

1. Pousse le repo sur GitHub
2. [vercel.com/new](https://vercel.com/new) → importe le repo
3. **Root Directory** : `web`
4. **Framework** : Next.js (détecté automatiquement)
5. **Environment Variables** :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. **Deploy**

### Option B — CLI

```bash
cd web
npm install -g vercel
vercel login
vercel
```

Ajoute les variables quand la CLI le demande, ou dans le dashboard Vercel → **Settings** → **Environment Variables**.

### Après le déploiement

1. Copie l’URL Vercel (ex. `https://ghosttalk.vercel.app`)
2. Mets à jour **Supabase** → Auth → Redirect URLs avec cette URL + `/auth/callback`
3. Mets **Site URL** sur la même URL de production

---

## 4. Build de production en local

```bash
cd web
npm run build
npm run start
```

Corrige les erreurs éventuelles avant de déployer.

---

## 5. Pièces jointes (fichiers / vidéos)

- Chiffrement **côté client** avant envoi
- Fichiers &lt; 256 Ko : inline dans le message
- Fichiers plus gros : bucket `conversation-media` (migration `009`)
- Limite : **50 Mo** par fichier

Si l’upload échoue : vérifie que `009_storage_media.sql` est appliqué et que les policies Storage sont actives.

---

## 6. Checklist avant mise en ligne

- [ ] Toutes les migrations `001` → `019` exécutées (appels : `019_calls.sql`)
- [ ] Bucket `conversation-media` présent
- [ ] Auth : Anonymous + Email (et Phone si besoin)
- [ ] Redirect URLs production configurées
- [ ] Variables `NEXT_PUBLIC_*` sur Vercel
- [ ] `npm run build` OK en local
- [ ] Test : inscription fantôme, message texte, envoi image/vidéo
- [ ] Test : message sans trace (timer + après lecture), accusés de lecture (✓✓), vocal masqué optionnel
- [ ] Test : publier un statut, le voir depuis un contact, répondre en DM
- [ ] Bucket `story-media` présent (migration `012`)

---

## 7. Dépannage

| Problème | Piste |
|----------|--------|
| Spinner infini au login | Vider cookies / localStorage ; vérifier Auth URL |
| `user_id is ambiguous` | Appliquer migration `006` |
| Impossible d’ajouter au groupe | Migrations `006` + `007` |
| Upload fichier refusé | Migration `009` + utilisateur participant de la conversation |
| Realtime ne marche pas | Table `messages` dans publication Realtime |
| Email / SMS ne part pas | Templates Auth + provider SMS configuré |

---

## Structure du dépôt

```
ghosttalk/
├── supabase/migrations/   # Schéma SQL
├── web/                   # App Next.js (à déployer)
└── DEPLOY.md              # Ce fichier
```

Pour toute évolution (domaine custom, CI GitHub Actions), configure le domaine dans Vercel puis mets à jour les URLs Supabase en conséquence.
