import BaseAdmin from '../components/BaseAdmin'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

export default function AdminClients({ embedded }: { embedded?: boolean } = {}) {
  return (
    <BaseAdmin
      titre="Admin Clients"
      sousTitre="Configurez les champs de votre base clients"
      baseUrl="/clients"
      siteId={getSiteId()}
      embedded={embedded}
    />
  )
}
