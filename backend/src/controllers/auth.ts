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
    include: { role: true, site: true }
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
    utilisateur: {
      id: utilisateur.id,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      role: utilisateur.role,
      site: utilisateur.site
    }
  })
}
