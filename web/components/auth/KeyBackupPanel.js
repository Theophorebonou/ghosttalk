'use client'

import { useState } from 'react'
import {
  downloadBackupFile,
  exportKeyBackupEncrypted,
  exportKeyBackupPlaintext,
} from '@/lib/crypto/keyBackup'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function KeyBackupPanel({
  keyPair,
  compact = false,
  requireAcknowledge = false,
  onAcknowledged,
}) {
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [useEncryption, setUseEncryption] = useState(true)
  const [copied, setCopied] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleDownload() {
    setError(null)
    setBusy(true)
    try {
      let content
      if (useEncryption) {
        if (passphrase !== confirmPassphrase) {
          throw new Error('Les phrases secrètes ne correspondent pas.')
        }
        content = await exportKeyBackupEncrypted(keyPair, passphrase)
      } else {
        content = exportKeyBackupPlaintext(keyPair)
      }
      downloadBackupFile(content)
      if (requireAcknowledge) setAcknowledged(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    setError(null)
    setBusy(true)
    try {
      if (useEncryption && passphrase !== confirmPassphrase) {
        throw new Error('Les phrases secrètes ne correspondent pas.')
      }
      const content = useEncryption
        ? await exportKeyBackupEncrypted(keyPair, passphrase)
        : exportKeyBackupPlaintext(keyPair)
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      if (requireAcknowledge) setAcknowledged(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-amber-500/10 ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <h3 className="text-sm font-semibold text-amber-200">
        Sauvegardez vos clés de chiffrement
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
        Sans cette sauvegarde, vos messages ne pourront plus être déchiffrés si vous
        changez d&apos;appareil ou effacez les données du navigateur.
      </p>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={useEncryption}
          onChange={(e) => setUseEncryption(e.target.checked)}
          className="rounded border-zinc-600"
        />
        Protéger le fichier avec une phrase secrète
      </label>

      {useEncryption && (
        <div className="mt-3 flex flex-col gap-2">
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Phrase secrète (8 caractères min.)"
            autoComplete="new-password"
          />
          <Input
            type="password"
            value={confirmPassphrase}
            onChange={(e) => setConfirmPassphrase(e.target.value)}
            placeholder="Confirmer la phrase secrète"
            autoComplete="new-password"
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={handleDownload} disabled={busy} className="flex-1">
          Télécharger
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleCopy}
          disabled={busy}
          className="flex-1"
        >
          {copied ? 'Copié !' : 'Copier'}
        </Button>
      </div>

      {requireAcknowledge && (
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 rounded border-zinc-600"
          />
          J&apos;ai sauvegardé ma clé dans un endroit sûr
        </label>
      )}

      {requireAcknowledge && onAcknowledged && (
        <Button
          type="button"
          className="mt-3 w-full"
          disabled={!acknowledged}
          onClick={onAcknowledged}
        >
          Continuer
        </Button>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  )
}
