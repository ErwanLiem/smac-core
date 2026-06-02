import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

const PAGES_DISPONIBLES = [
  { path: '/articles',           label: 'Catalogue — Articles',               actions: ['view', 'edit', 'delete'] },
  { path: '/clients',            label: 'Catalogue — Clients',                actions: ['view', 'edit', 'delete'] },
  { path: '/plateformes',        label: 'Catalogue — Plateformes',            actions: ['view', 'edit', 'delete'] },
  { path: '/inventaire',         label: 'Logistique — Inventaire',            actions: ['view', 'edit', 'delete'] },
  { path: '/suivi',              label: 'Production — Suivi',                 actions: ['view'] },
  { path: '/admin/articles',     label: 'Configuration — Structure articles', actions: ['view'] },
  { path: '/admin/clients',      label: 'Configuration — Structure clients',  actions: ['view'] },
  { path: '/admin/plateformes',  label: 'Configuration — Structure plateformes', actions: ['view'] },
  { path: '/admin/inventaire',   label: 'Configuration — Structure inventaire', actions: ['view'] },
  { path: '/admin/workflow',     label: 'Configuration — Workflow',           actions: ['view'] },
  { path: '/admin/roles',        label: 'Configuration — Rôles',             actions: ['view'] },
  { path: '/admin/utilisateurs', label: 'Configuration — Utilisateurs',      actions: ['view'] },
]

function genererMotDePasse(): string {
  const majuscules = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const minuscules = 'abcdefghjkmnpqrstuvwxyz'
  const chiffres = '23456789'
  const speciaux = '@#$%&!'
  const tous = majuscules + minuscules + chiffres + speciaux

  // Garantir au moins 1 de chaque catégorie
  const mdp = [
    majuscules[crypto.randomInt(majuscules.length)],
    minuscules[crypto.randomInt(minuscules.length)],
    chiffres[crypto.randomInt(chiffres.length)],
    speciaux[crypto.randomInt(speciaux.length)],
    ...Array.from({ length: 8 }, () => tous[crypto.randomInt(tous.length)])
  ]

  // Mélanger
  for (let i = mdp.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [mdp[i], mdp[j]] = [mdp[j], mdp[i]]
  }

  return mdp.join('')
}

// --- ROLES ---

export async function getRoles(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const roles = await prisma.role.findMany({
    where: { siteId },
    include: { permissions: true },
    orderBy: { label: 'asc' }
  })
  res.json(roles)
}

export async function createRole(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const { code, label, permissions } = req.body
  const role = await prisma.role.create({
    data: {
      siteId, code, label,
      permissions: { create: (permissions ?? []).map((p: { page: string; action: string }) => ({ page: p.page, action: p.action })) }
    },
    include: { permissions: true }
  })
  res.json(role)
}

export async function updateRole(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { label, permissions } = req.body

  await prisma.permissionRole.deleteMany({ where: { roleId: id } })
  const role = await prisma.role.update({
    where: { id },
    data: {
      label,
      permissions: { create: (permissions ?? []).map((p: { page: string; action: string }) => ({ page: p.page, action: p.action })) }
    },
    include: { permissions: true }
  })
  res.json(role)
}

export async function deleteRole(req: Request, res: Response) {
  const id = Number(req.params.id)
  await prisma.permissionRole.deleteMany({ where: { roleId: id } })
  await prisma.role.delete({ where: { id } })
  res.json({ ok: true })
}

export async function getPagesDisponibles(_req: Request, res: Response) {
  res.json(PAGES_DISPONIBLES)
}

// --- UTILISATEURS ---

export async function getUtilisateurs(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const utilisateurs = await prisma.utilisateur.findMany({
    where: { siteId },
    include: { role: true },
    orderBy: { nom: 'asc' }
  })
  // Ne jamais retourner le mot de passe
  res.json(utilisateurs.map(u => ({ ...u, motDePasse: undefined })))
}

export async function createUtilisateur(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const { nom, prenom, login, roleId } = req.body

  const mdpGenere = genererMotDePasse()
  const mdpHash = await bcrypt.hash(mdpGenere, 12)

  const utilisateur = await prisma.utilisateur.create({
    data: { siteId, nom, prenom, login, motDePasse: mdpHash, roleId, doitChangerMdp: true },
    include: { role: true }
  })

  // On retourne le mot de passe en clair UNE SEULE FOIS à la création
  res.json({ ...utilisateur, motDePasse: undefined, mdpGenere })
}

export async function updateUtilisateur(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { nom, prenom, login, roleId, actif } = req.body
  const utilisateur = await prisma.utilisateur.update({
    where: { id },
    data: { nom, prenom, login, roleId, actif },
    include: { role: true }
  })
  res.json({ ...utilisateur, motDePasse: undefined })
}

export async function deleteUtilisateur(req: Request, res: Response) {
  const id = Number(req.params.id)
  await prisma.utilisateur.delete({ where: { id } })
  res.json({ ok: true })
}

export async function reinitialiserMdp(req: Request, res: Response) {
  const id = Number(req.params.id)
  const mdpGenere = genererMotDePasse()
  const mdpHash = await bcrypt.hash(mdpGenere, 12)
  await prisma.utilisateur.update({
    where: { id },
    data: { motDePasse: mdpHash, doitChangerMdp: true }
  })
  res.json({ mdpGenere })
}
