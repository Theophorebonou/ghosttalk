'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateKeyPair } from '@/lib/crypto/keys'
import { supabase } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/Spinner'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    async function finishAuth() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          router.replace('/login')
          return
        }
      } else {
        const { error } = await supabase.auth.getSession()
        if (error) {
          router.replace('/login')
          return
        }
      }

      await getOrCreateKeyPair()
      router.replace('/login')
    }

    finishAuth()
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-sm text-zinc-400">Connexion en cours…</p>
      </div>
    </main>
  )
}
