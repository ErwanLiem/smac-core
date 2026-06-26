import BaseAdmin from '../components/BaseAdmin'
import { getSiteId } from '../utils/permissions'

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
