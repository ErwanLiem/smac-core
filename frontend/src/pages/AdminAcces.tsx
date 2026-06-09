import Tabs from '../components/Tabs'
import AdminRoles from './AdminRoles'
import AdminUtilisateurs from './AdminUtilisateurs'

export default function AdminAcces() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accès</h1>
          <p className="page-subtitle">Gérez les rôles, leurs permissions et les comptes utilisateurs</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'roles', label: 'Rôles', content: <AdminRoles embedded /> },
          { key: 'utilisateurs', label: 'Utilisateurs', content: <AdminUtilisateurs embedded /> },
        ]}
      />
    </div>
  )
}
