'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { GhostLoginButton } from '@/components/auth/GhostLoginButton'
import { EmailPhoneLoginButton } from '@/components/auth/EmailPhoneLoginButton'
import { KeyRestorePanel } from '@/components/auth/KeyRestorePanel'
import { UsernameSetup } from '@/components/auth/UsernameSetup'
import { WelcomeScreen } from '@/components/auth/WelcomeScreen'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { generateKeyPair, getStoredKeyPair, storeKeyPair } from '@/lib/crypto/keys'
import { updateProfilePublicKey } from '@/lib/api/profiles'

function hasLocalKeys() {
  const stored = getStoredKeyPair()
  return !!(stored?.publicKey && stored?.privateKey)
}

export default function LoginPage() {
  const router = useRouter()
  const { loading, isAuthenticated, hasProfile, user, authError } = useAuth()
  const [authMethod, setAuthMethod] = useState(null)
  const [keysReady, setKeysReady] = useState(null)

  useEffect(() => {
    if (!loading && isAuthenticated && hasProfile && hasLocalKeys()) {
      router.replace('/chat')
    }
  }, [loading, isAuthenticated, hasProfile, router])

  useEffect(() => {
    if (isAuthenticated && hasProfile) {
      setKeysReady(hasLocalKeys())
    } else {
      setKeysReady(null)
    }
  }, [isAuthenticated, hasProfile, loading])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Spinner className="h-10 w-10" />
        <p className="text-sm text-zinc-500 animate-pulse">Chargement…</p>
      </div>
    )
  }

  if (isAuthenticated && hasProfile && keysReady === true) {
    return null
  }

  if (isAuthenticated && hasProfile && keysReady === false) {
    return (
      <AuthPanel title="Restaurer vos clés">
        <KeyRestorePanel
          onRestored={() => setKeysReady(true)}
          onGenerateNew={async () => {
            if (!user?.id) return
            if (
              !confirm(
                'Sans sauvegarde, vos anciens messages seront illisibles. Une nouvelle paire de clés sera créée. Continuer ?'
              )
            ) {
              return
            }
            const keyPair = await generateKeyPair()
            storeKeyPair(keyPair)
            await updateProfilePublicKey(user.id, keyPair.publicKey)
            setKeysReady(true)
          }}
        />
      </AuthPanel>
    )
  }

  if (isAuthenticated && !hasProfile) {
    return (
      <AuthPanel title="Créer votre identité">
        <UsernameSetup />
      </AuthPanel>
    )
  }

  if (authMethod === 'ghost') {
    return (
      <AuthPanel onBack={() => setAuthMethod(null)}>
        <GhostLoginButton />
      </AuthPanel>
    )
  }

  if (authMethod === 'email-phone') {
    return (
      <AuthPanel onBack={() => setAuthMethod(null)}>
        <EmailPhoneLoginButton />
      </AuthPanel>
    )
  }

  return (
    <WelcomeScreen
      onGhostMode={() => setAuthMethod('ghost')}
      onEmailPhone={() => setAuthMethod('email-phone')}
      authError={authError}
    />
  )
}
