'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getProfileByUserId } from '@/lib/api/profiles'
import { clearMessageCache } from '@/lib/cache/messageCache'
import { clearStoredKeyPair } from '@/lib/crypto/keys'
import { buildGhostCredentials } from '@/lib/crypto/ghostWallet'
import { generateRecoveryPhrase } from '@/lib/crypto/recoveryPhrase'
import { supabase } from '@/lib/supabase/client'
import { normalizeUsername } from '@/lib/utils/username'

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

  // La phrase dérive une clé Ed25519 ; Supabase authentifie la signature
  // (provider Web3). Aucun email, aucun téléphone : la phrase EST l'identité.
  async function ghostWeb3SignIn(phrase) {
    const credentials = await buildGhostCredentials(phrase)
    const { data, error } = await supabase.auth.signInWithWeb3(credentials)
    if (error) {
      if (error.code === 'web3_provider_disabled' || /web3/i.test(error.message ?? '')) {
        throw new Error(
          'Configuration Supabase requise : activez le provider « Web3 Wallet » (Authentication → Sign In / Up).'
        )
      }
      throw error
    }
    return data
  }

  // Création d'un compte fantôme : génère la phrase puis ouvre la session.
  const signUpGhost = useCallback(async () => {
    setAuthError(null)

    const phrase = generateRecoveryPhrase()
    const data = await ghostWeb3SignIn(phrase)

    setUser(data.user)
    return { user: data.user, phrase }
  }, [])

  // Reconnexion : la phrase suffit à retrouver le compte ; le pseudo saisi
  // sert de garde-fou contre les fautes de frappe dans la phrase.
  const signInGhost = useCallback(async (username, phrase) => {
    setAuthError(null)

    const data = await ghostWeb3SignIn(phrase)
    const existingProfile = await refreshProfile(data.user.id)

    if (!existingProfile) {
      // Une phrase inconnue crée un compte vierge : on le referme aussitôt.
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      throw new Error(
        'Aucun compte ne correspond à cette phrase. Vérifie chaque mot (l\'ordre compte).'
      )
    }

    if (username && existingProfile.username !== normalizeUsername(username)) {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      throw new Error('Cette phrase ne correspond pas à ce pseudo.')
    }

    setUser(data.user)
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
