import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET!

export interface TokenPayload {
  id: number
  roleCode: string
  siteId: number
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.roleCode !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  }
  next()
}

// Vérifie que le rôle de l'utilisateur dispose de la permission `${page}:${action}`
// (les administrateurs ont toujours tous les droits)
export function requirePermission(page: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.roleCode === 'ADMIN') return next()

    const role = await prisma.role.findFirst({
      where: { siteId: req.user!.siteId, code: req.user!.roleCode },
      include: { permissions: true }
    })
    const autorise = role?.permissions.some(p => p.page === page && p.action === action) ?? false
    if (!autorise) {
      return res.status(403).json({ error: 'Permission insuffisante' })
    }
    next()
  }
}
