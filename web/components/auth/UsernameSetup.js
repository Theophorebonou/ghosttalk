'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProfile, isUsernameAvailable } from '@/lib/api/profiles'
import { generateKeyPair, storeKeyPair } from '@/lib/crypto/keys'
import {
  normalizeUsername,
  suggestUsername,
  validateUsername,
} from '@/lib/utils/username'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { KeyBackupPanel } from './KeyBackupPanel'

export function UsernameSetup() {
  const router = useRouter()
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState('username')
  const [username, setUsername] = useState(suggestUsername())
  const [keyPair, setKeyPair] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleUsernameSubmit(event) {
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
        setError('Ce pseudo est déjà pris.')
        return
      }

      const keys = await generateKeyPair()
      setKeyPair(keys)
      setStep('backup')
    } catch (err) {
      setError(err.message ?? 'Impossible de préparer le compte')
    } finally {
      setLoading(false)
    }
  }

  async function finishSetup() {
    if (!keyPair || !user) return

    setLoading(true)
    setError(null)

    try {
      const normalized = normalizeUsername(username)
      storeKeyPair(keyPair)
      await createProfile({
        userId: user.id,
        username: normalized,
        publicKey: keyPair.publicKey,
      })

      await refreshProfile(user.id)
      router.replace('/chat')
    } catch (err) {
      setError(err.message ?? 'Impossible de créer le profil')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'backup' && keyPair) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <KeyBackupPanel
          keyPair={keyPair}
          requireAcknowledge
          onAcknowledged={finishSetup}
        />
        {loading && (
          <p className="flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Spinner className="h-4 w-4 border-2" />
            Création du profil…
          </p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <form
      onSubmit={handleUsernameSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div>
        <label htmlFor="username" className="mb-2 block text-sm text-zinc-400">
          Choisis ton pseudo
        </label>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">@</span>
          <Input
            id="username"
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
            Vérification…
          </span>
        ) : (
          'Continuer'
        )}
      </Button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100/90">
        Étape suivante : vous devrez sauvegarder vos clés de chiffrement. Sans
        elles, vos messages seront perdus si vous changez d&apos;appareil ou
        effacez les données du navigateur.
      </p>
    </form>
  )
}
