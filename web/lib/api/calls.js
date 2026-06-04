import { supabase } from '@/lib/supabase/client'

/** Normalise la réponse RPC create_call (retourne un uuid brut). */
export function normalizeCallRecord(callIdOrRow, callType = 'audio') {
  if (!callIdOrRow) return null
  if (typeof callIdOrRow === 'string') {
    return { id: callIdOrRow, call_type: callType, status: 'ringing' }
  }
  if (callIdOrRow.id) return callIdOrRow
  return null
}

export async function initiateCall(calleeId, callType = 'audio', conversationId = null) {
  const { data, error } = await supabase.rpc('create_call', {
    p_callee_id: calleeId,
    p_call_type: callType,
    p_conversation_id: conversationId,
  })

  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('function')) {
      console.warn('Migration 019_calls non appliquée')
      return normalizeCallRecord(`demo-${Date.now()}`, callType)
    }
    throw error
  }

  return normalizeCallRecord(data, callType)
}

export async function getCall(callId) {
  if (!callId || String(callId).startsWith('demo-')) {
    return { id: callId, call_type: 'audio', status: 'ringing' }
  }

  const { data, error } = await supabase
    .from('calls')
    .select(`
      *,
      caller:profiles!calls_caller_id_fkey (id, username, display_name, avatar_seed),
      callee:profiles!calls_callee_id_fkey (id, username, display_name, avatar_seed)
    `)
    .eq('id', callId)
    .single()

  if (error) {
    if (error.code === '42P01' || error.message?.includes('relation')) {
      return { id: callId, call_type: 'audio', status: 'ringing' }
    }
    throw error
  }
  return data
}

export async function updateCallStatus(callId, status) {
  if (!callId || String(callId).startsWith('demo-')) return

  const { error } = await supabase.rpc('update_call_status', {
    p_call_id: callId,
    p_status: status,
  })

  if (error && error.code !== 'PGRST202') {
    console.warn('update_call_status:', error.message)
  }
}

export async function getIncomingCalls() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return []

  const { data, error } = await supabase
    .from('calls')
    .select(`
      *,
      caller:profiles!calls_caller_id_fkey (username, display_name, avatar_seed)
    `)
    .eq('callee_id', session.user.id)
    .eq('status', 'ringing')
    .order('started_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return data ?? []
}

export function subscribeToIncomingCalls(callback) {
  let channel = null

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.user) return

    channel = supabase
      .channel('incoming_calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${session.user.id}`,
        },
        (payload) => {
          if (payload.new?.status === 'ringing') {
            callback(payload.new)
          }
        }
      )
      .subscribe()
  })

  return {
    unsubscribe: () => channel?.unsubscribe(),
  }
}

export function subscribeToCallStatus(callId, callback) {
  if (!callId || String(callId).startsWith('demo-')) return { unsubscribe: () => {} }

  const channel = supabase
    .channel(`call_status:${callId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${callId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe()

  return channel
}
