'use client'

import { ThemeSelector } from '@/components/ui/ThemeSelector'
import { Button } from '@/components/ui/Button'

export function AppSettingsModal({ onClose, onOpenKeys }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="settings-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="settings-title" className="text-lg font-bold text-text">
            Paramètres
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-text-muted transition hover:bg-surface-highlight hover:text-text"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <h3 className="mb-1 text-sm font-semibold text-text">Apparence</h3>
            <p className="mb-3 text-xs text-text-muted">
              Couleurs de l&apos;interface (barre latérale, boutons, fond).
            </p>
            <ThemeSelector variant="settings" />
          </section>

          <section className="border-t border-border pt-5">
            <h3 className="mb-1 text-sm font-semibold text-text">Sécurité</h3>
            <p className="mb-3 text-xs text-text-muted">
              Sauvegarde et restauration de vos clés de chiffrement bout en bout.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                onClose()
                onOpenKeys?.()
              }}
            >
              Clés de chiffrement
            </Button>
          </section>
        </div>

        <div className="border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  )
}
