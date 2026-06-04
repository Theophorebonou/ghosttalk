const PREFIX = 'ghosttalk_draft_'

export function getDraft(conversationId) {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(`${PREFIX}${conversationId}`) ?? ''
}

export function setDraft(conversationId, text) {
  if (typeof window === 'undefined') return
  const key = `${PREFIX}${conversationId}`
  if (!text?.trim()) localStorage.removeItem(key)
  else localStorage.setItem(key, text)
}
