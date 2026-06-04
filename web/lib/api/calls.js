import { supabase } from '@/lib/supabase/client'

export async function initiateCall(calleeId, callType = 'audio', conversationId = null) {
  try {
    const { data: call, error } = await supabase.rpc('create_call', {
      p_callee_id: calleeId,
      p_call_type: callType,
      p_conversation_id: conversationId,
    })

    if (error) throw error
    return call
  } catch (err) {
    // Si la fonction RPC n'existe pas (migration non appliquée), retourner un ID temporaire
    if (err.message?.includes('function') || err.code === 'PGRST202') {
      console.warn('Migration 019_calls non appliquée, mode démo activé')
      return { id: 'demo-call-' + Date.now(), call_type: callType }
    }
    throw err
  }
}

export async function getCall(callId) {
  try {
    const { data, error } = await supabase
      .from('calls')
      .select(`
        *,
        caller:profiles!calls_caller_id_fkey (username, display_name, avatar_seed),
        callee:profiles!calls_callee_id_fkey (username, display_name, avatar_seed)
      `)
      .eq('id', callId)
      .single()

    if (error) throw error
    return data
  } catch (err) {
    // Si la table n'existe pas (migration non appliquée), retourner null
    if (err.code === 'PGRST116' || err.message?.includes('relation')) {
      console.warn('Migration 019_calls non appliquée')
      return null
    }
    throw err
  }
}

export async function updateCallStatus(callId, status) {
  try {
    const { error } = await supabase.rpc('update_call_status', {
      p_call_id: callId,
      p_status: status,
    })

    if (error) throw error
  } catch (err) {
    // Si la fonction RPC n'existe pas (migration non appliquée), ignorer silencieusement
    if (err.message?.includes('function') || err.code === 'PGRST202') {
      console.warn('Migration 019_calls non appliquée')
      return
    }
    throw err
  }
}

export async function getIncomingCalls() {
  const result = await supabase.auth.getUser()
  if (!result?.data?.user) return []

  const user = result.data.user

  try {
    const { data, error } = await supabase
      .from('calls')
      .select(`
        *,
        caller:profiles!calls_caller_id_fkey (username, display_name, avatar_seed)
      `)
      .eq('callee_id', user.id)
      .in('status', ['ringing'])
      .order('started_at', { ascending: false })

    if (error) throw error
    return data ?? []
  } catch (err) {
    // Si la table n'existe pas (migration non appliquée), retourner un tableau vide
    if (err.code === 'PGRST116' || err.message?.includes('relation')) {
      console.warn('Migration 019_calls non appliquée')
      return []
    }
    throw err
  }
}

export async function getActiveCall() {
  const result = await supabase.auth.getUser()
  if (!result?.data?.user) return null

  const user = result.data.user

  try {
    const { data, error } = await supabase
      .from('calls')
      .select(`
        *,
        caller:profiles!calls_caller_id_fkey (username, display_name, avatar_seed),
        callee:profiles!calls_callee_id_fkey (username, display_name, avatar_seed)
      `)
      .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
      .in('status', ['ringing', 'connected'])
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  } catch (err) {
    // Si la table n'existe pas (migration non appliquée), retourner null
    if (err.code === 'PGRST116' || err.message?.includes('relation')) {
      console.warn('Migration 019_calls non appliquée')
      return null
    }
    throw err
  }
}

export function subscribeToIncomingCalls(callback) {
  const result = supabase.auth.getUser()
  if (!result?.data?.user) return null

  const user = result.data.user
  const channel = supabase.channel('incoming_calls')

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'calls',
      filter: `callee_id=eq.${user.id}`,
    },
    (payload) => {
      if (payload.new.status === 'ringing') {
        callback(payload.new)
      }
    }
  )

  channel.subscribe()
  return channel
}

export function subscribeToCallStatus(callId, callback) {
  const channel = supabase.channel(`call_status:${callId}`)

  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'calls',
      filter: `id=eq.${callId}`,
    },
    (payload) => {
      callback(payload.new)
    }
  )

  channel.subscribe()
  return channel
}

export async function getCallHistory(limit = 50) {
  const result = await supabase.auth.getUser()
  if (!result?.data?.user) return []

  const user = result.data.user

  try {
    const { data, error } = await supabase
      .from('calls')
      .select(`
        *,
        caller:profiles!calls_caller_id_fkey (username, display_name, avatar_seed),
        callee:profiles!calls_callee_id_fkey (username, display_name, avatar_seed)
      `)
      .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
      .in('status', ['ended', 'rejected', 'missed'])
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data ?? []
  } catch (err) {
    // Si la table n'existe pas (migration non appliquée), retourner un tableau vide
    if (err.code === 'PGRST116' || err.message?.includes('relation')) {
      console.warn('Migration 019_calls non appliquée')
      return []
    }
    throw err
  }
}
