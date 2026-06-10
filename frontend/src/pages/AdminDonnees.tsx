import Tabs from '../components/Tabs'
import AdminArticles from './AdminArticles'
import AdminClients from './AdminClients'
import AdminPlateformes from './AdminPlateformes'
import AdminInventaire from './AdminInventaire'
import AdminReglesAlerte from './AdminReglesAlerte'

export default function AdminDonnees() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Données</h1>
          <p className="page-subtitle">Configurez la structure des champs de vos catalogues et de votre inventaire</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'articles', label: 'Articles', content: <AdminArticles embedded /> },
          { key: 'clients', label: 'Clients', content: <AdminClients embedded /> },
          { key: 'plateformes', label: 'Plateformes', content: <AdminPlateformes embedded /> },
          {
            key: 'inventaire',
            label: 'Inventaire',
            content: (
              <div>
                <AdminInventaire embedded />
                <div style={{ marginTop: '20px' }}>
                  <AdminReglesAlerte embedded />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
