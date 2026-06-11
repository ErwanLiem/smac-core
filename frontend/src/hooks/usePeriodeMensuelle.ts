import { useState } from 'react'

export interface Periode { annee: number; mois: number }

export const MOIS_COURANT: Periode = (() => {
  const now = new Date()
  return { annee: now.getFullYear(), mois: now.getMonth() + 1 }
})()

// Navigation mois précédent/suivant pour les tableaux récapitulatifs mensuels (Suivi PDA / Suivi PDA Labo)
export function usePeriodeMensuelle(estMoisCourantData?: boolean) {
  const [periode, setPeriode] = useState<Periode>(MOIS_COURANT)

  function moisPrecedent() {
    setPeriode(p => p.mois === 1 ? { annee: p.annee - 1, mois: 12 } : { annee: p.annee, mois: p.mois - 1 })
  }

  function moisSuivant() {
    setPeriode(p => p.mois === 12 ? { annee: p.annee + 1, mois: 1 } : { annee: p.annee, mois: p.mois + 1 })
  }

  const moisLabel = (() => {
    const label = new Date(periode.annee, periode.mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  })()

  const estMoisCourant = estMoisCourantData ?? (periode.annee === MOIS_COURANT.annee && periode.mois === MOIS_COURANT.mois)

  return { periode, setPeriode, moisPrecedent, moisSuivant, moisLabel, estMoisCourant }
}
