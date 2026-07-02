'use client'

import { useState, useEffect } from 'react'
import { voteOnPoll, removeVote, getPollResults, subscribeToPollVotes } from '@/lib/api/polls'
import { useAuth } from '@/hooks/useAuth'

export function PollMessage({ poll, isOwn, onVote }) {
  const { user } = useAuth()
  const [results, setResults] = useState(null)
  const [votedOptionIds, setVotedOptionIds] = useState(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Charger les résultats initiaux
    loadResults()

    // S'abonner aux votes en temps réel
    const channel = subscribeToPollVotes(poll.id, () => {
      loadResults()
    })

    return () => {
      channel?.unsubscribe?.()
    }
  }, [poll.id])

  // Charger les votes de l'utilisateur
  useEffect(() => {
    const userVotes = new Set()
    poll.poll_options?.forEach((option) => {
      option.poll_votes?.forEach((vote) => {
        if (vote.user_id === user?.id) {
          userVotes.add(option.id)
        }
      })
    })
    setVotedOptionIds(userVotes)
  }, [poll.poll_options, user?.id])

  async function loadResults() {
    try {
      const data = await getPollResults(poll.id)
      setResults(data)
    } catch (err) {
      console.error('Failed to load poll results', err)
    }
  }

  async function handleVote(optionId) {
    if (loading) return

    setLoading(true)
    try {
      if (votedOptionIds.has(optionId)) {
        // Retirer le vote
        await removeVote(optionId, user.id)
        setVotedOptionIds((prev) => {
          const next = new Set(prev)
          next.delete(optionId)
          return next
        })
      } else {
        // Ajouter le vote
        if (!poll.allow_multiple_choice && votedOptionIds.size > 0) {
          // Retirer le vote précédent si choix unique
          const previousVote = votedOptionIds.values().next().value
          await removeVote(previousVote, user.id)
          setVotedOptionIds(new Set())
        }
        await voteOnPoll(optionId, user.id)
        setVotedOptionIds((prev) => new Set(prev).add(optionId))
      }
      onVote?.()
    } catch (err) {
      console.error('Failed to vote', err)
    } finally {
      setLoading(false)
    }
  }

  const hasVoted = votedOptionIds.size > 0
  const totalVotes = results?.reduce((sum, r) => sum + r.voteCount, 0) || 0

  return (
    <div className="my-3 rounded-xl border border-border bg-black/50 p-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-text">{poll.question}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
          <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
          {poll.is_quiz && <span className="text-primary">• Quiz</span>}
          {poll.is_anonymous && <span>• Anonyme</span>}
        </div>
      </div>

      <div className="space-y-2">
        {(results || poll.poll_options)?.map((option) => {
          const optionId = option.id
          const voteCount = results?.find((r) => r.id === optionId)?.voteCount || 0
          const percentage = results?.find((r) => r.id === optionId)?.percentage || 0
          const isVoted = votedOptionIds.has(optionId)

          return (
            <button
              key={optionId}
              type="button"
              disabled={loading}
              onClick={() => handleVote(optionId)}
              className={`relative w-full rounded-lg border-2 p-3 text-left transition-all ${
                isVoted
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-surface-highlight/60 hover:border-border'
              }`}
            >
              {hasVoted && (
                <div
                  className="absolute inset-y-0 left-0 rounded-l-lg transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: isVoted ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.1)',
                  }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span className="text-sm text-text">{option.option_text}</span>
                <div className="flex items-center gap-2">
                  {hasVoted && (
                    <span className="text-xs font-medium text-text-muted">
                      {Math.round(percentage)}%
                    </span>
                  )}
                  {isVoted && (
                    <span className="text-primary">✓</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {poll.is_quiz && poll.correct_option_id && isOwn && (
        <div className="mt-3 text-xs text-text-muted">
          Réponse correcte: {poll.poll_options?.find((o) => o.id === poll.correct_option_id)?.option_text}
        </div>
      )}
    </div>
  )
}
