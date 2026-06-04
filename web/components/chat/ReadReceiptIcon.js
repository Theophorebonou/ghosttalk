'use client'

/**
 * Accusés de lecture style messageries (✓ envoyé, ✓✓ lu).
 * @param {'sent'|'delivered'|'read'} status
 */
export function ReadReceiptIcon({ status, className = '' }) {
  const isRead = status === 'read'
  const isDouble = status === 'delivered' || status === 'read'

  return (
    <span
      className={`inline-flex items-center gap-0.5 align-middle ${className}`}
      title={
        status === 'read'
          ? 'Lu'
          : status === 'delivered'
            ? 'Distribué'
            : 'Envoyé'
      }
      aria-label={
        status === 'read' ? 'Message lu' : status === 'delivered' ? 'Message distribué' : 'Message envoyé'
      }
    >
      <CheckIcon className={isRead ? 'text-sky-300' : 'text-white/70'} />
      {isDouble && (
        <CheckIcon className={`-ml-2 ${isRead ? 'text-sky-300' : 'text-white/70'}`} />
      )}
    </span>
  )
}

function CheckIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`h-3.5 w-3.5 ${className}`}
    >
      <path
        fillRule="evenodd"
        d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

/**
 * Statut pour un message envoyé par l'utilisateur courant.
 */
export function getReadStatusForMessage(message, currentUserId, otherParticipantIds) {
  const reads = message.message_reads || []
  const others = otherParticipantIds.filter((id) => id !== currentUserId)

  if (others.length === 0) return 'sent'

  const readByOthers = reads.filter((r) => others.includes(r.user_id))
  if (readByOthers.length >= others.length) return 'read'
  if (readByOthers.length > 0) return 'delivered'
  return 'sent'
}
