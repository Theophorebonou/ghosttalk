'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function ScheduleMessageModal({ onClose, onSchedule }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!date || !time) return

    const scheduledFor = new Date(`${date}T${time}`)
    if (scheduledFor <= new Date()) {
      alert('La date doit être dans le futur')
      return
    }

    onSchedule(scheduledFor.toISOString())
  }

  // Date minimum = maintenant
  const minDate = new Date().toISOString().split('T')[0]
  const minTime = new Date().toTimeString().slice(0, 5)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Programmer l'envoi</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDate}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Heure
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              Programmer
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
