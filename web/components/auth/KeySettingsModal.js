'use client'

import { getStoredKeyPair } from '@/lib/crypto/keys'
import { KeyBackupPanel } from './KeyBackupPanel'
import { KeyRestorePanel } from './KeyRestorePanel'
import { Button } from '@/components/ui/Button'

export function KeySettingsModal({ onClose }) {
  const stored = getStoredKeyPair()
  const keyPair = stored?.publicKey && stored?.privateKey ? stored : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => onClose?.()}>
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-xl font-bold text-text">Clés de chiffrement</h2>

        {keyPair ? (
          <KeyBackupPanel keyPair={keyPair} compact />
        ) : (
          <p className="mb-4 text-sm text-zinc-400">
            Aucune clé sur cet appareil.
          </p>
        )}

        <div className="mt-6 border-t border-zinc-800 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">
            Restaurer une sauvegarde
          </h3>
          <KeyRestorePanel onRestored={onClose} />
        </div>

        <Button type="button" variant="ghost" className="mt-6 w-full" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  )
}
