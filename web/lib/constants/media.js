export const MAX_MEDIA_BYTES = 50 * 1024 * 1024

export const ACCEPTED_MEDIA =
  'image/*,video/*,audio/*,application/pdf,.doc,.docx,.zip,.txt'

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
