import express from 'express'
import cors from 'cors'
import sitesRouter from './routes/sites'
import workflowRouter from './routes/workflow'
import articlesRouter from './routes/articles'
import clientsRouter from './routes/clients'
import plateformesRouter from './routes/plateformes'
import utilisateursRouter from './routes/utilisateurs'
import authRouter from './routes/auth'
import { requireAuth } from './middleware/auth'

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
app.use('/api/gestion', requireAuth, utilisateursRouter)

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})
