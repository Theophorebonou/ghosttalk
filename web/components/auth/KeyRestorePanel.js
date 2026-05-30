'use client'

import { useState } from 'react'
import { importKeyBackup } from '@/lib/crypto/keyBackup'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'

export function KeyRestorePanel({ onRestored, onGenerateNew }) {
  const [backupText, setBackupText] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleImport() {
    setLoading(true)
    setError(null)
    try {
      await importKeyBackup(backupText, passphrase || undefined)
      onRestored?.()
    } catch (err) {
      setError(err.message ?? 'Impossible de restaurer la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setBackupText(text)
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-bold text-zinc-50">Restaurer vos clés</h2>
        <p className="text-sm text-zinc-400">
          Vos clés de chiffrement ne sont pas sur cet appareil. Importez une
          sauvegarde pour lire vos messages.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-400">
          Fichier de sauvegarde (.json)
        </label>
        <input
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-400">
          Ou collez le contenu JSON
        </label>
        <textarea
          value={backupText}
          onChange={(e) => setBackupText(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500"
          placeholder='{"v":1,"app":"ghosttalk",...}'
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-400">
          Phrase secrète (si chiffré)
        </label>
        <Input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Optionnel"
          autoComplete="current-password"
        />
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={loading || !backupText.trim()}
        onClick={handleImport}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner className="h-5 w-5 border-2" />
            Restauration…
          </span>
        ) : (
          'Restaurer'
        )}
      </Button>

      {onGenerateNew && (
        <button
          type="button"
          onClick={onGenerateNew}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Je n&apos;ai pas de sauvegarde (nouvelles clés — anciens messages illisibles)
        </button>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
