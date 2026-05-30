'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'

export function GhostLoginButton() {
  const { signInGhost } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleClick() {
    setLoading(true)
    setError(null)

    try {
      await signInGhost()
    } catch (err) {
      setError(err.message ?? 'Connexion impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-zinc-50">Mode Fantôme</h2>
        <p className="text-sm text-zinc-400">
          Pas d'email. Pas de numéro. Un pseudo, c'est tout.
        </p>
      </div>

      <Button
        className="w-full"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-5 w-5 border-2" />
            Connexion…
          </span>
        ) : (
          'Entrer en mode fantôme'
        )}
      </Button>

      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
