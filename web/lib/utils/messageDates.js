/** Compare deux timestamps sur le jour calendaire local. */
export function isSameCalendarDay(isoA, isoB) {
  const a = new Date(isoA)
  const b = new Date(isoB)
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dayOffsetFromToday(iso) {
  const d = new Date(iso)
  const today = startOfLocalDay(new Date())
  const day = startOfLocalDay(d)
  return Math.round((today - day) / 86400000)
}

/** Libellé pour un séparateur dans le fil (Aujourd'hui, Hier, 1 juin…). */
export function formatMessageDayLabel(iso) {
  const d = new Date(iso)
  const offset = dayOffsetFromToday(iso)

  if (offset === 0) return "Aujourd'hui"
  if (offset === 1) return 'Hier'

  const now = new Date()
  if (offset < 7) {
    const label = d.toLocaleDateString('fr-FR', { weekday: 'long' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  if (d.getFullYear() === now.getFullYear()) {
    const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  const label = d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Heure affichée dans la liste des conversations. */
export function formatConversationListTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const offset = dayOffsetFromToday(iso)

  if (offset === 0) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  if (offset === 1) return 'Hier'
  if (offset < 7) {
    return d.toLocaleDateString('fr-FR', { weekday: 'short' })
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}
