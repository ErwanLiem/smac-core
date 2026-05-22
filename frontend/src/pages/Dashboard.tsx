import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Tableau de bord</h1>
      <nav style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <Link to="/suivi">Suivi articles</Link>
        <Link to="/admin/workflow">Admin workflow</Link>
      </nav>
    </div>
  )
}
