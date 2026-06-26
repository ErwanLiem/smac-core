import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // --- Site ---
  const site = await prisma.site.upsert({
    where: { slug: 'smac-vallery' },
    update: {},
    create: { nom: 'SMAC Vallery', slug: 'smac-vallery' }
  })
  console.log('Site créé :', site.nom)

  // --- Statuts ---
  const statutsData = [
    { code: 'RECEPTION',       label: 'Réception',        couleur: '#6b7280', ordre: 1 },
    { code: 'DIAGNOSTIC',      label: 'Diagnostic',       couleur: '#f59e0b', ordre: 2 },
    { code: 'EN_REPARATION',   label: 'En réparation',    couleur: '#3b82f6', ordre: 3 },
    { code: 'ATTENTE_PIECES',  label: 'Attente pièces',   couleur: '#8b5cf6', ordre: 4 },
    { code: 'CONTROLE',        label: 'Contrôle qualité', couleur: '#f97316', ordre: 5 },
    { code: 'TERMINE',         label: 'Terminé',          couleur: '#22c55e', ordre: 6, estFinal: true },
    { code: 'IRREPARABLE',     label: 'Irréparable',      couleur: '#ef4444', ordre: 7, estFinal: true },
  ]

  const statuts: Record<string, { id: number }> = {}
  for (const s of statutsData) {
    const statut = await prisma.statut.upsert({
      where: { siteId_code: { siteId: site.id, code: s.code } },
      update: {},
      create: { siteId: site.id, ...s, estFinal: s.estFinal ?? false }
    })
    statuts[s.code] = statut
  }
  console.log('Statuts créés :', Object.keys(statuts).length)

  // --- Transitions ---
  const transitionsData = [
    { from: 'RECEPTION',      to: 'DIAGNOSTIC',     label: '🔍 Diagnostiquer',   couleur: '#f59e0b' },
    { from: 'DIAGNOSTIC',     to: 'EN_REPARATION',  label: '🔧 Réparer',          couleur: '#3b82f6' },
    { from: 'DIAGNOSTIC',     to: 'IRREPARABLE',    label: '❌ Irréparable',      couleur: '#ef4444' },
    { from: 'EN_REPARATION',  to: 'ATTENTE_PIECES', label: '⏳ Attente pièces',   couleur: '#8b5cf6' },
    { from: 'EN_REPARATION',  to: 'CONTROLE',       label: '✅ Envoyer contrôle', couleur: '#f97316' },
    { from: 'ATTENTE_PIECES', to: 'EN_REPARATION',  label: '🔧 Pièces reçues',    couleur: '#3b82f6' },
    { from: 'CONTROLE',       to: 'TERMINE',        label: '✔ Valider',           couleur: '#22c55e' },
    { from: 'CONTROLE',       to: 'EN_REPARATION',  label: '↩ Retour atelier',   couleur: '#f59e0b' },
  ]

  for (const t of transitionsData) {
    await prisma.transition.create({
      data: {
        siteId: site.id,
        statutFromId: statuts[t.from].id,
        statutToId: statuts[t.to].id,
        labelBouton: t.label,
        couleurBouton: t.couleur
      }
    }).catch(() => {}) // ignore si déjà existant
  }
  console.log('Transitions créées :', transitionsData.length)

  // --- Rôle admin ---
  const role = await prisma.role.upsert({
    where: { siteId_code: { siteId: site.id, code: 'ADMIN' } },
    update: {},
    create: { siteId: site.id, code: 'ADMIN', label: 'Administrateur' }
  })

  // --- Utilisateur admin ---
  const hash = await bcrypt.hash('admin123', 10)
  await prisma.utilisateur.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      siteId: site.id,
      nom: 'Admin',
      prenom: 'SMAC',
      login: 'admin',
      motDePasse: hash,
      roleId: role.id
    }
  })
  console.log('Utilisateur créé : admin / admin123')

  // --- Articles de test ---
  const articles = [
    { reference: 'CT40-001', designation: 'Honeywell CT40', serialNumber: 'SN123456' },
    { reference: 'CT40-002', designation: 'Honeywell CT40', serialNumber: 'SN789012' },
    { reference: 'MC33-001', designation: 'Zebra MC3300',   serialNumber: 'SN345678' },
  ]

  for (const a of articles) {
    await prisma.article.create({
      data: { siteId: site.id, statutId: statuts['RECEPTION'].id, ...a }
    }).catch(() => {})
  }
  console.log('Articles de test créés :', articles.length)
}

main()
  .then(() => { console.log('\n✅ Seed terminé'); prisma.$disconnect() })
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
