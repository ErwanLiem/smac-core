import BaseList from '../components/BaseList'
import { getSiteId } from '../utils/permissions'

export default function Clients() {
  return <BaseList titre="Clients" sousTitre="Base clients" baseUrl="/clients" siteId={getSiteId()} pagePath="/clients" />
}
