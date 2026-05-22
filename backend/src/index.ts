import express from 'express'
import cors from 'cors'
import sitesRouter from './routes/sites'
import workflowRouter from './routes/workflow'
import articlesRouter from './routes/articles'
import authRouter from './routes/auth'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/sites', sitesRouter)
app.use('/api/workflow', workflowRouter)
app.use('/api/articles', articlesRouter)

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})
