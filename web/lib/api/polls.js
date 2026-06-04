import { supabase } from '@/lib/supabase/client'

export async function createPoll(messageId, question, options, config = {}) {
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .insert({
      message_id: messageId,
      question,
      is_anonymous: config.isAnonymous || false,
      is_quiz: config.isQuiz || false,
      allow_multiple_choice: config.allowMultipleChoice || false,
    })
    .select()
    .single()

  if (pollError) throw pollError

  // Créer les options
  const optionsWithPositions = options.map((text, index) => ({
    poll_id: poll.id,
    option_text: text,
    position: index,
  }))

  const { error: optionsError } = await supabase
    .from('poll_options')
    .insert(optionsWithPositions)

  if (optionsError) throw optionsError

  return poll
}

export async function getPollByMessageId(messageId) {
  const { data, error } = await supabase
    .from('polls')
    .select(`
      *,
      poll_options (
        id,
        option_text,
        position,
        poll_votes (
          id,
          user_id,
          voted_at
        )
      )
    `)
    .eq('message_id', messageId)
    .single()

  if (error) throw error
  return data
}

export async function voteOnPoll(pollOptionId, userId) {
  const { error } = await supabase
    .from('poll_votes')
    .insert({
      poll_option_id: pollOptionId,
      user_id: userId,
    })

  if (error) throw error
}

export async function removeVote(pollOptionId, userId) {
  const { error } = await supabase
    .from('poll_votes')
    .delete()
    .eq('poll_option_id', pollOptionId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getPollResults(pollId) {
  const { data, error } = await supabase
    .from('poll_options')
    .select(`
      id,
      option_text,
      position,
      poll_votes (
        id
      )
    `)
    .eq('poll_id', pollId)
    .order('position')

  if (error) throw error

  // Calculer les totaux
  const totalVotes = data.reduce((sum, option) => sum + option.poll_votes.length, 0)

  return data.map((option) => ({
    ...option,
    voteCount: option.poll_votes.length,
    percentage: totalVotes > 0 ? (option.poll_votes.length / totalVotes) * 100 : 0,
  }))
}

export function subscribeToPollVotes(pollId, callback) {
  const channel = supabase.channel(`poll_votes:${pollId}`)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'poll_votes',
      filter: `poll_option_id=in.(select id from poll_options where poll_id=eq.${pollId})`,
    },
    (payload) => {
      callback(payload)
    }
  )

  channel.subscribe()
  return channel
}
