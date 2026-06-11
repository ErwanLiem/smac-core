import BaseList from '../components/BaseList'
import { getSiteId } from '../utils/permissions'

export default function Plateformes() {
  return <BaseList titre="Plateformes" sousTitre="Base plateformes" baseUrl="/plateformes" siteId={getSiteId()} pagePath="/plateformes" />
}
