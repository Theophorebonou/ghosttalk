'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { getOrCreateKeyPair } from '@/lib/crypto/keys'
import { supabase } from '@/lib/supabase/client'
import { formatAuthError, normalizePhoneNumber } from '@/lib/utils/authErrors'

const REDIRECT_URL =
  typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : ''

export function EmailPhoneLoginButton() {
  const [method, setMethod] = useState('email')
  const [emailAuthMode, setEmailAuthMode] = useState('password')
  const [accountMode, setAccountMode] = useState('signin')
  const [step, setStep] = useState('form')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  function resetMessages() {
    setError(null)
    setInfo(null)
  }

  async function handleEmailPasswordSubmit(e) {
    e.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      if (accountMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: REDIRECT_URL },
        })
        if (error) throw error

        if (data.session) {
          await getOrCreateKeyPair()
        } else {
          setInfo(
            'Un email de confirmation vous a été envoyé. Cliquez sur le lien pour activer votre compte.'
          )
          setStep('email-sent')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        await getOrCreateKeyPair()
      }
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: REDIRECT_URL,
          shouldCreateUser: true,
        },
      })
      if (error) throw error

      setInfo(
        'Un lien de connexion a été envoyé à votre adresse email. Ouvrez-le sur cet appareil.'
      )
      setStep('email-sent')
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: REDIRECT_URL,
      })
      if (error) throw error

      setInfo('Si un compte existe, un email de réinitialisation a été envoyé.')
      setStep('reset-sent')
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleSendPhoneOtp(e) {
    e.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      const normalized = normalizePhoneNumber(phone)
      if (normalized.length < 8) {
        throw new Error('Numéro de téléphone invalide (format international, ex. +33612345678).')
      }

      const { error } = await supabase.auth.signInWithOtp({ phone: normalized })
      if (error) throw error

      setPhone(normalized)
      setInfo('Un code SMS a été envoyé.')
      setStep('phone-otp')
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyPhoneOtp(e) {
    e.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp.trim(),
        type: 'sms',
      })
      if (error) throw error
      await getOrCreateKeyPair()
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  if (step === 'email-sent' || step === 'reset-sent') {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h2 className="text-xl font-bold text-zinc-50">Vérifiez votre email</h2>
        <p className="text-sm text-zinc-400">{info}</p>
        <Button type="button" variant="ghost" onClick={() => setStep('form')}>
          Retour
        </Button>
      </div>
    )
  }

  if (step === 'phone-otp') {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <div className="space-y-2 text-center">
          <h2 className="text-xl font-bold text-zinc-50">Code SMS</h2>
          <p className="text-sm text-zinc-400">
            Entrez le code reçu au {phone}
          </p>
        </div>

        <form onSubmit={handleVerifyPhoneOtp} className="flex w-full flex-col gap-3">
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-5 w-5 border-2" />
                Vérification…
              </span>
            ) : (
              'Valider le code'
            )}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setStep('form')}
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          ← Changer de numéro
        </button>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-bold text-zinc-50">
          {method === 'email' ? 'Email' : 'Téléphone'}
        </h2>
        <p className="text-sm text-zinc-400">
          {method === 'email' && emailAuthMode === 'reset'
            ? 'Réinitialisation du mot de passe'
            : accountMode === 'signup'
              ? 'Créer un compte'
              : 'Se connecter'}
        </p>
      </div>

      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={() => {
            setMethod('email')
            resetMessages()
          }}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            method === 'email'
              ? 'bg-primary text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod('phone')
            resetMessages()
          }}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            method === 'phone'
              ? 'bg-primary text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          Téléphone
        </button>
      </div>

      {method === 'email' && emailAuthMode !== 'reset' && (
        <div className="flex w-full gap-2">
          {['password', 'magic'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setEmailAuthMode(mode)
                resetMessages()
              }}
              className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition ${
                emailAuthMode === mode
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
              }`}
            >
              {mode === 'password' ? 'Mot de passe' : 'Lien magique'}
            </button>
          ))}
        </div>
      )}

      {method === 'email' && emailAuthMode === 'password' && (
        <form onSubmit={handleEmailPasswordSubmit} className="flex w-full flex-col gap-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            autoComplete="email"
            required
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={accountMode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-5 w-5 border-2" />
                {accountMode === 'signup' ? 'Création…' : 'Connexion…'}
              </span>
            ) : accountMode === 'signup' ? (
              'Créer un compte'
            ) : (
              'Se connecter'
            )}
          </Button>
          <button
            type="button"
            onClick={() =>
              setAccountMode(accountMode === 'signin' ? 'signup' : 'signin')
            }
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            {accountMode === 'signin'
              ? 'Pas de compte ? Créer un compte'
              : 'Déjà un compte ? Se connecter'}
          </button>
          {accountMode === 'signin' && (
            <button
              type="button"
              onClick={() => {
                setEmailAuthMode('reset')
                resetMessages()
              }}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Mot de passe oublié ?
            </button>
          )}
        </form>
      )}

      {method === 'email' && emailAuthMode === 'magic' && (
        <form onSubmit={handleMagicLink} className="flex w-full flex-col gap-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            autoComplete="email"
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-5 w-5 border-2" />
                Envoi…
              </span>
            ) : (
              'Envoyer le lien magique'
            )}
          </Button>
        </form>
      )}

      {method === 'email' && emailAuthMode === 'reset' && (
        <form onSubmit={handleResetPassword} className="flex w-full flex-col gap-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            autoComplete="email"
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-5 w-5 border-2" />
                Envoi…
              </span>
            ) : (
              'Envoyer le lien de réinitialisation'
            )}
          </Button>
          <button
            type="button"
            onClick={() => {
              setEmailAuthMode('password')
              resetMessages()
            }}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            ← Retour à la connexion
          </button>
        </form>
      )}

      {method === 'phone' && (
        <form onSubmit={handleSendPhoneOtp} className="flex w-full flex-col gap-3">
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+33612345678"
            autoComplete="tel"
            required
          />
          <p className="text-xs text-zinc-500">
            Format international requis (ex. +33…). Le SMS peut prendre une minute.
          </p>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-5 w-5 border-2" />
                Envoi du code…
              </span>
            ) : (
              'Recevoir un code SMS'
            )}
          </Button>
        </form>
      )}

      {info && !error && (
        <p className="text-center text-sm text-primary">{info}</p>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  )
}
