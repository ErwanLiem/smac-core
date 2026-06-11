import BaseAdmin from '../components/BaseAdmin'
import { getSiteId } from '../utils/permissions'

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
