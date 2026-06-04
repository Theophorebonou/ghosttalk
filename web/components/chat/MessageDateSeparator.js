'use client'

import { formatMessageDayLabel } from '@/lib/utils/messageDates'

export function MessageDateSeparator({ date }) {
  if (!date) return null

  return (
    <div className="flex justify-center px-4 py-3" role="separator" aria-label={formatMessageDayLabel(date)}>
      <span className="rounded-full border border-border bg-surface/90 px-3 py-1 text-xs font-medium text-text-muted shadow-sm backdrop-blur-sm">
        {formatMessageDayLabel(date)}
      </span>
    </div>
  )
}
