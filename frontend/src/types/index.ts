export interface Site {
  id: number
  nom: string
  slug: string
  actif: boolean
}

export interface Statut {
  id: number
  siteId: number
  code: string
  label: string
  couleur: string
  icone?: string
  ordre: number
  roles: string[]   // ex. ['estStock'], ['estTransfert'], ['estFinal'], ['estReparation', ...] — libre
}

export interface Transition {
  id: number
  siteId: number
  statutFromId: number
  statutToId: number
  labelBouton: string
  couleurBouton: string
  ordre: number
  statutFrom?: Statut
  statutTo?: Statut
}

export interface Article {
  id: number
  siteId: number
  reference: string
  designation: string
  serialNumber?: string
  statutId: number
  statut: Statut
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface HistoriqueStatut {
  id: number
  articleId: number
  statut: Statut
  commentaire?: string
  createdAt: string
}

export interface Role {
  id: number
  code: string
  label: string
}

export interface Utilisateur {
  id: number
  nom: string
  prenom: string
  login: string
  role: Role
  site: Site
}
