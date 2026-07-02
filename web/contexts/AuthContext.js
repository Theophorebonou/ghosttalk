'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getProfileByUserId } from '@/lib/api/profiles'
import { clearMessageCache } from '@/lib/cache/messageCache'
import { clearStoredKeyPair } from '@/lib/crypto/keys'
import {
  generateRecoveryPhrase,
  ghostEmailForUsername,
  normalizeRecoveryPhrase,
} from '@/lib/crypto/recoveryPhrase'
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

  // Création d'un compte fantôme : email synthétique dérivé du pseudo
  // (jamais affiché) + phrase de récupération générée comme mot de passe.
  const signUpGhost = useCallback(async (username) => {
    setAuthError(null)

    const phrase = generateRecoveryPhrase()
    const { data, error } = await supabase.auth.signUp({
      email: ghostEmailForUsername(username),
      password: phrase,
    })
    if (error) {
      if (error.message?.toLowerCase().includes('already registered')) {
        throw new Error('Ce pseudo est déjà pris.')
      }
      throw error
    }

    if (!data.session) {
      // « Confirm email » est activé côté Supabase : le mode fantôme exige
      // une session immédiate (l'email synthétique ne reçoit rien).
      throw new Error(
        'Configuration Supabase requise : désactivez « Confirm email » (Authentication → Sign In / Up) pour le mode fantôme.'
      )
    }

    setUser(data.user)
    return { user: data.user, phrase }
  }, [])

  // Reconnexion : pseudo + phrase de récupération.
  const signInGhost = useCallback(async (username, phrase) => {
    setAuthError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: ghostEmailForUsername(username),
      password: normalizeRecoveryPhrase(phrase),
    })
    if (error) {
      if (error.message?.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Pseudo ou phrase de récupération incorrects.')
      }
      throw error
    }

    setUser(data.user)
    const existingProfile = await refreshProfile(data.user.id)
    return { user: data.user, profile: existingProfile }
  }, [refreshProfile])

  const signOut = useCallback(async () => {
    setAuthError(null)
    await supabase.auth.signOut()
    clearStoredKeyPair()
    clearMessageCache()
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
      signUpGhost,
      signInGhost,
      signOut,
      refreshProfile,
      setAuthError,
    }),
    [user, profile, loading, authError, signUpGhost, signInGhost, signOut, refreshProfile]
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
