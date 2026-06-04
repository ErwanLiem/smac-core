import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import sitesRouter from './routes/sites'
import workflowRouter from './routes/workflow'
import articlesRouter from './routes/articles'
import clientsRouter from './routes/clients'
import plateformesRouter from './routes/plateformes'
import inventaireRouter from './routes/inventaire'
import attendusRouter from './routes/attendus'
import configAttendusRouter from './routes/configAttendus'
import utilisateursRouter from './routes/utilisateurs'
import authRouter from './routes/auth'
import { requireAuth } from './middleware/auth'
import { Prisma } from '@prisma/client'

const app = express()
const PORT = process.env.PORT || 5000

// CORS restreint au frontend local
app.use(cors({
  origin: [
    'http://localhost:5173',
    /^http:\/\/192\.168\.\d+\.\d+:5173$/  // accès réseau local (terminaux WiFi)
  ],
  credentials: true
}))

app.use(express.json())

// Route publique — login uniquement
app.use('/api/auth', authRouter)

// Toutes les autres routes nécessitent un token valide
app.use('/api/sites', requireAuth, sitesRouter)
app.use('/api/workflow', requireAuth, workflowRouter)
app.use('/api/articles', requireAuth, articlesRouter)
app.use('/api/clients', requireAuth, clientsRouter)
app.use('/api/plateformes', requireAuth, plateformesRouter)
app.use('/api/inventaire', requireAuth, inventaireRouter)
app.use('/api/attendus', requireAuth, attendusRouter)
app.use('/api/config-attendus', requireAuth, configAttendusRouter)
app.use('/api/gestion', requireAuth, utilisateursRouter)

// Middleware global de gestion des erreurs
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Un enregistrement avec ce code existe déjà.' })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Enregistrement introuvable.' })
    }
  }
  console.error(err)
  res.status(500).json({ error: 'Erreur serveur inattendue.' })
})

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})
