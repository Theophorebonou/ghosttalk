'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getProfileByUserId } from '@/lib/api/profiles'
import { clearStoredKeyPair, getOrCreateKeyPair } from '@/lib/crypto/keys'
import { supabase } from '@/lib/supabase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  const refreshProfile = useCallback(async (userId) => {
    const id = userId ?? user?.id
    if (!id) {
      setProfile(null)
      return null
    }

    const data = await getProfileByUserId(id)
    setProfile(data)
    return data
  }, [user?.id])

  useEffect(() => {
    let mounted = true

    async function applySession(session) {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)

      if (sessionUser) {
        try {
          const data = await getProfileByUserId(sessionUser.id)
          if (mounted) setProfile(data)
        } catch (err) {
          if (mounted) setAuthError(err.message)
        }
      } else if (mounted) {
        setProfile(null)
      }

      if (mounted) setLoading(false)
    }

    async function init() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!mounted) return
        await applySession(session)
      } catch (err) {
        if (mounted) setAuthError(err.message)
        if (mounted) setLoading(false)
      }
    }

    init()

    // Never await Supabase calls directly in this callback — it deadlocks
    // getSession() when a persisted session exists (normal browsing).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (!mounted) return
        void applySession(session)
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInGhost = useCallback(async () => {
    setAuthError(null)

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error

    await getOrCreateKeyPair()
    setUser(data.user)

    const existingProfile = await refreshProfile(data.user.id)
    return { user: data.user, profile: existingProfile }
  }, [refreshProfile])

  const signOut = useCallback(async () => {
    setAuthError(null)
    await supabase.auth.signOut()
    clearStoredKeyPair()
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      authError,
      isAuthenticated: !!user,
      hasProfile: !!profile,
      signInGhost,
      signOut,
      refreshProfile,
      setAuthError,
    }),
    [user, profile, loading, authError, signInGhost, signOut, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}
