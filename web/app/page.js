'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'

export default function Home() {
  const router = useRouter()
  const { loading, isAuthenticated, hasProfile } = useAuth()

  useEffect(() => {
    if (loading) return

    if (isAuthenticated && hasProfile) {
      router.replace('/chat')
    } else {
      router.replace('/login')
    }
  }, [loading, isAuthenticated, hasProfile, router])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Spinner />
    </main>
  )
}
