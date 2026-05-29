import BaseList from '../components/BaseList'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

export default function Articles() {
  return <BaseList titre="Articles" sousTitre="Base articles" baseUrl="/articles" siteId={getSiteId()} />
}
