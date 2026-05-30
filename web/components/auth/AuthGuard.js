'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'

export function AuthGuard({ children }) {
  const router = useRouter()
  const { loading, isAuthenticated, hasProfile } = useAuth()

  useEffect(() => {
    if (loading) return

    if (!isAuthenticated || !hasProfile) {
      router.replace('/login')
    }
  }, [loading, isAuthenticated, hasProfile, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!isAuthenticated || !hasProfile) {
    return null
  }

  return children
}
