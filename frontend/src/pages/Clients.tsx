import BaseList from '../components/BaseList'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

export default function Clients() {
  return <BaseList titre="Clients" sousTitre="Base clients" baseUrl="/clients" siteId={getSiteId()} />
}
