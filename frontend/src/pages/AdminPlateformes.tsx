import BaseAdmin from '../components/BaseAdmin'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

export default function AdminPlateformes({ embedded }: { embedded?: boolean } = {}) {
  return (
    <BaseAdmin
      titre="Admin Plateformes"
      sousTitre="Configurez les champs de votre base plateformes"
      baseUrl="/plateformes"
      siteId={getSiteId()}
      embedded={embedded}
    />
  )
}
