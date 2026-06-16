/** Formate une date ISO (YYYY-MM-DD ou timestamp) en DD/MM/YYYY */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString('fr-FR')
}

/** Formate un timestamp en DD/MM/YYYY HH:mm */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Compte les jours ouvrés (lun-ven) entre dateDebut et aujourd'hui */
export function joursOuvresDepuis(dateDebut: Date): number {
  const debut = new Date(dateDebut)
  debut.setHours(0, 0, 0, 0)
  const fin = new Date()
  fin.setHours(0, 0, 0, 0)
  if (fin <= debut) return 0
  let count = 0
  const cur = new Date(debut)
  while (cur < fin) {
    cur.setDate(cur.getDate() + 1)
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

/** Retourne le nombre de jours ouvrés restants avant la fin du SLA (négatif = dépassé) */
export function joursOuvresRestants(dateDebut: Date, slaDays: number): number {
  return slaDays - joursOuvresDepuis(dateDebut)
}
