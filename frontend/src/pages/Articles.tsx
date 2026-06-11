import BaseList from '../components/BaseList'
import { getSiteId } from '../utils/permissions'

export default function Articles() {
  return <BaseList titre="Articles" sousTitre="Base articles" baseUrl="/articles" siteId={getSiteId()} pagePath="/articles" />
}
