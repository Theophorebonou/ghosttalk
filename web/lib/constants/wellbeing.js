/** Préférences locales — bien-être pendant les conversations */

export const STORAGE_HIDE_READ_RECEIPTS = 'ghosttalk_hide_read_receipts'

export function getHideReadReceipts() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_HIDE_READ_RECEIPTS) === '1'
}

export function setHideReadReceipts(hide) {
  if (typeof window === 'undefined') return
  if (hide) {
    localStorage.setItem(STORAGE_HIDE_READ_RECEIPTS, '1')
  } else {
    localStorage.removeItem(STORAGE_HIDE_READ_RECEIPTS)
  }
}

/** Durées pour messages sans trace (timer) */
export const EPHEMERAL_TIMER_OPTIONS = [
  { id: '30s', label: '30 s', seconds: 30 },
  { id: '1m', label: '1 min', seconds: 60 },
  { id: '5m', label: '5 min', seconds: 300 },
  { id: '1h', label: '1 h', seconds: 3600 },
]

export const EPHEMERAL_AFTER_READ = {
  id: 'after_read',
  label: 'Après lecture',
  description: 'Disparaît quand tout le monde a lu',
  kind: 'after_read',
}
