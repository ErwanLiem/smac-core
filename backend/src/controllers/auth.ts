import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET!

export async function login(req: Request, res: Response) {
  const { login: loginInput, motDePasse, siteSlug } = req.body

  const utilisateur = await prisma.utilisateur.findFirst({
    where: { login: loginInput, actif: true, site: { slug: siteSlug } },
    include: { role: { include: { permissions: true } }, site: true }
  })

  if (!utilisateur) return res.status(401).json({ error: 'Identifiants invalides' })

  const valide = await bcrypt.compare(motDePasse, utilisateur.motDePasse)
  if (!valide) return res.status(401).json({ error: 'Identifiants invalides' })

  const token = jwt.sign(
    { id: utilisateur.id, roleCode: utilisateur.role.code, siteId: utilisateur.siteId },
    JWT_SECRET,
    { expiresIn: '8h' }
  )

  res.json({
    token,
    doitChangerMdp: utilisateur.doitChangerMdp,
    utilisateur: {
      id: utilisateur.id,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      role: utilisateur.role,
      site: utilisateur.site,
      permissions: utilisateur.role.permissions.map(p => p.page)
    }
  })
}

export async function changerMotDePasse(req: Request, res: Response) {
  const userId = req.user!.id
  const { ancienMdp, nouveauMdp } = req.body

  // Validation du nouveau mot de passe
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%&!]).{10,}$/
  if (!regex.test(nouveauMdp)) {
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial (@#$%&!).'
    })
  }

  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: userId } })
  if (!utilisateur) return res.status(404).json({ error: 'Utilisateur introuvable' })

  const valide = await bcrypt.compare(ancienMdp, utilisateur.motDePasse)
  if (!valide) return res.status(400).json({ error: 'Ancien mot de passe incorrect' })

  const hash = await bcrypt.hash(nouveauMdp, 12)
  await prisma.utilisateur.update({
    where: { id: userId },
    data: { motDePasse: hash, doitChangerMdp: false }
  })

  res.json({ ok: true })
}
