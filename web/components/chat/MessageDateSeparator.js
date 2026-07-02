'use client'

import { formatMessageDayLabel } from '@/lib/utils/messageDates'

export function MessageDateSeparator({ date }) {
  if (!date) return null

  return (
    <div className="flex justify-center px-4 py-3" role="separator" aria-label={formatMessageDayLabel(date)}>
      <span className="rounded-lg bg-surface px-3 py-[5px] text-[12.5px] uppercase text-text-muted shadow-sm">
        {formatMessageDayLabel(date)}
      </span>
    </div>
  )
}
