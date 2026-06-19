import BaseList from '../components/BaseList'
import { getSiteId } from '../utils/permissions'

const ONGLETS = [
  { label: 'TPE',        champCode: 'TYPE', valeur: 'TPE' },
  { label: 'PDA',        champCode: 'TYPE', valeur: 'PDA' },
  { label: 'Accessoire', champCode: 'TYPE', valeur: 'Accessoire' },
]

export default function Articles() {
  return <BaseList titre="Articles" sousTitre="Base articles" baseUrl="/articles" siteId={getSiteId()} pagePath="/articles" onglets={ONGLETS} />
}
