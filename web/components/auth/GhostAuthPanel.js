'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { KeyBackupPanel } from './KeyBackupPanel'
import { useAuth } from '@/hooks/useAuth'
import { createProfile, isUsernameAvailable } from '@/lib/api/profiles'
import { generateKeyPair, storeKeyPair } from '@/lib/crypto/keys'
import {
  normalizeUsername,
  suggestUsername,
  validateUsername,
} from '@/lib/utils/username'

/**
 * Mode fantôme : création (pseudo → phrase de récupération générée, style
 * portefeuille crypto) et reconnexion (pseudo + phrase).
 * `onDone` : rend la main à la page de login (reconnexion réussie).
 */
export function GhostAuthPanel({ onDone }) {
  const router = useRouter()
  const { signUpGhost, signInGhost, refreshProfile } = useAuth()

  const [mode, setMode] = useState('create') // 'create' | 'login'
  const [step, setStep] = useState('form') // création : 'form' → 'phrase' → 'backup'

  const [username, setUsername] = useState(suggestUsername())
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPhrase, setLoginPhrase] = useState('')

  const [phrase, setPhrase] = useState(null)
  const [keyPair, setKeyPair] = useState(null)
  const [phraseSaved, setPhraseSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function switchMode(next) {
    setMode(next)
    setStep('form')
    setError(null)
  }

  async function handleCreate(event) {
    event.preventDefault()
    setError(null)

    const normalized = normalizeUsername(username)
    const validationError = validateUsername(normalized)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const available = await isUsernameAvailable(normalized)
      if (!available) {
        throw new Error('Ce pseudo est déjà pris.')
      }

      const { user, phrase: generated } = await signUpGhost(normalized)

      const keys = await generateKeyPair()
      storeKeyPair(keys)
      await createProfile({
        userId: user.id,
        username: normalized,
        publicKey: keys.publicKey,
      })
      await refreshProfile(user.id)

      setKeyPair(keys)
      setPhrase(generated)
      setStep('phrase')
    } catch (err) {
      setError(err.message ?? 'Impossible de créer le compte')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setError(null)

    if (!loginUsername.trim() || !loginPhrase.trim()) {
      setError('Pseudo et phrase de récupération requis.')
      return
    }

    setLoading(true)
    try {
      await signInGhost(loginUsername, loginPhrase)
      // La page de login reprend la main : redirection ou restauration des clés
      onDone?.()
    } catch (err) {
      setError(err.message ?? 'Connexion impossible')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopyPhrase() {
    try {
      await navigator.clipboard.writeText(phrase)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Impossible de copier — notez la phrase à la main.')
    }
  }

  // ── Étape 2 (création) : affichage de la phrase de récupération ──
  if (mode === 'create' && step === 'phrase' && phrase) {
    const words = phrase.split(' ')
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-bold text-zinc-50">
            Ta phrase de récupération
          </h2>
          <p className="text-sm text-zinc-400">
            C&apos;est le <strong>seul moyen</strong> de te reconnecter à{' '}
            <span className="text-primary">@{normalizeUsername(username)}</span>.
            Note-la comme la seed d&apos;un portefeuille crypto : personne ne
            pourra la retrouver pour toi.
          </p>
        </div>

        <ol className="grid grid-cols-2 gap-2">
          {words.map((word, i) => (
            <li
              key={`${word}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-highlight px-3 py-2 text-sm"
            >
              <span className="w-5 shrink-0 text-right text-xs text-zinc-500">
                {i + 1}.
              </span>
              <span className="font-mono text-zinc-100">{word}</span>
            </li>
          ))}
        </ol>

        <Button type="button" variant="ghost" onClick={handleCopyPhrase}>
          {copied ? 'Copiée !' : 'Copier la phrase'}
        </Button>

        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100/90">
          Perdue = compte perdu. Aucune récupération par email possible :
          c&apos;est le prix de l&apos;anonymat.
        </p>

        <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={phraseSaved}
            onChange={(e) => setPhraseSaved(e.target.checked)}
            className="mt-0.5 rounded border-zinc-600"
          />
          J&apos;ai noté ma phrase de récupération dans un endroit sûr
        </label>

        <Button
          type="button"
          className="w-full"
          disabled={!phraseSaved}
          onClick={() => setStep('backup')}
        >
          Continuer
        </Button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    )
  }

  // ── Étape 3 (création) : sauvegarde des clés (fichier = compte + clés) ──
  if (mode === 'create' && step === 'backup' && keyPair) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <KeyBackupPanel
          keyPair={keyPair}
          account={{
            username: normalizeUsername(username),
            recoveryPhrase: phrase,
          }}
          requireAcknowledge
          onAcknowledged={() => router.replace('/chat')}
        />
        <p className="text-center text-xs text-zinc-500">
          Le fichier contient aussi ton pseudo et ta phrase : il restaure ton
          compte et tes messages d&apos;un coup.
        </p>
      </div>
    )
  }

  // ── Étape 1 : créer / se reconnecter ──
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-bold text-zinc-50">Mode Fantôme</h2>
        <p className="text-sm text-zinc-400">
          Pas d&apos;email. Pas de numéro. Un pseudo et une phrase de
          récupération, c&apos;est tout.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-highlight p-1">
        <button
          type="button"
          onClick={() => switchMode('create')}
          className={`rounded-md px-3 py-2 text-sm transition ${
            mode === 'create'
              ? 'bg-primary text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Créer un compte
        </button>
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`rounded-md px-3 py-2 text-sm transition ${
            mode === 'login'
              ? 'bg-primary text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Se reconnecter
        </button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label htmlFor="ghost-username" className="mb-2 block text-sm text-zinc-400">
              Choisis ton pseudo
            </label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">@</span>
              <Input
                id="ghost-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-5 w-5 border-2" />
                Création…
              </span>
            ) : (
              'Entrer en mode fantôme'
            )}
          </Button>

          <p className="text-xs leading-relaxed text-zinc-500">
            Une phrase de récupération sera générée : c&apos;est elle qui te
            permettra de te reconnecter, comme pour un portefeuille crypto.
          </p>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label htmlFor="ghost-login-username" className="mb-2 block text-sm text-zinc-400">
              Ton pseudo
            </label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">@</span>
              <Input
                id="ghost-login-username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                autoComplete="username"
                spellCheck={false}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="ghost-login-phrase" className="mb-2 block text-sm text-zinc-400">
              Ta phrase de récupération (8 mots)
            </label>
            <textarea
              id="ghost-login-phrase"
              value={loginPhrase}
              onChange={(e) => setLoginPhrase(e.target.value)}
              rows={3}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full rounded-lg border border-border bg-surface-highlight px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-primary"
              placeholder="mot1 mot2 mot3 …"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-5 w-5 border-2" />
                Connexion…
              </span>
            ) : (
              'Se reconnecter'
            )}
          </Button>
        </form>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  )
}
