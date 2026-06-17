import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ScanLine, PackageCheck, AlertTriangle, Boxes, Truck, Printer, ArrowLeft, Send, Save, X, Trash2, FileText } from 'lucide-react'
import { get, post, put } from '../api/client'
import { genererHTMLBL, type ConfigSite as ConfigSiteType, type PlateformeAdresse, type ArticleBL, type ColisBL } from '../utils/generateBL'
import Tabs from '../components/Tabs'
import ExportExcelButton, { type ExportColumn } from '../components/ExportExcelButton'
import { getSiteId } from '../utils/permissions'
import { jouerSonAlerte, jouerSonSucces } from '../utils/sons'

// ─── Onglet Emballage ────────────────────────────────────────────────────────

interface CarteEmballage {
  pnValeur: string
  rmaValeur: string
  designationValeur: string
  clientValeur: string
  quantite: number
  sns: string[]
}

interface ScanResult {
  ok: boolean
  sn: string
  pnValeur: string
  rmaValeur: string
  designationValeur: string
  clientValeur: string
  statut: string
}

function EmballageTab({ active }: { active: boolean }) {
  const siteId = getSiteId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [sn, setSn] = useState('')
  const [cartes, setCartes] = useState<CarteEmballage[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [dernier, setDernier] = useState<ScanResult | null>(null)

  useEffect(() => { if (active) reload() }, [siteId, active])
  useEffect(() => { inputRef.current?.focus() }, [chargement])

  async function reload() {
    setChargement(true)
    try {
      const data = await get<CarteEmballage[]>(`/expeditions/${siteId}/emballage`)
      setCartes(data)
    } finally {
      setChargement(false)
    }
  }

  async function scanner() {
    const valeur = sn.trim()
    if (!valeur) return

    try {
      const res = await post<ScanResult>(`/expeditions/${siteId}/emballage/scan`, { sn: valeur })
      jouerSonSucces()
      setDernier(res)
      setErreur(null)
      setSn('')
      await reload()
    } catch (e: any) {
      jouerSonAlerte()
      setErreur(e.message || 'Erreur lors du scan')
      setDernier(null)
      setSn('')
    }
    inputRef.current?.focus()
  }

  return (
    <div>
      {/* Zone de scan */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            <ScanLine size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Scanner un S/N en sortie de contrôle qualité
          </label>
          <input
            ref={inputRef}
            className="form-input"
            placeholder="Scanner ou saisir un S/N..."
            value={sn}
            onChange={e => setSn(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); scanner() } }}
            autoFocus
          />
        </div>

        {erreur && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '8px 12px', background: '#3b0d0d', border: '1px solid #dc2626', borderRadius: '6px', color: '#fca5a5', fontSize: '13px' }}>
            <AlertTriangle size={15} />
            {erreur}
          </div>
        )}

        {dernier && !erreur && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '8px 12px', background: '#052e16', border: '1px solid #16a34a', borderRadius: '6px', color: '#4ade80', fontSize: '13px' }}>
            <PackageCheck size={15} />
            <span>
              <strong>{dernier.sn}</strong> emballé avec succès
              {dernier.rmaValeur && <> — RMA <strong>{dernier.rmaValeur}</strong></>}
              {dernier.pnValeur && <> · P/N <strong>{dernier.pnValeur}</strong></>}
              {dernier.clientValeur && <> · Client <strong>{dernier.clientValeur}</strong></>}
            </span>
          </div>
        )}
      </div>

      {/* Cartes regroupées par RMA × P/N, sous-onglets par client */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '12px' }}>
        Articles emballés — en attente de Master Box {cartes.length > 0 && `(${cartes.reduce((s, c) => s + c.quantite, 0)} S/N)`}
      </h2>

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : cartes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px', color: '#6b7280' }}>
          <PackageCheck size={36} style={{ marginBottom: '14px', color: '#374151' }} />
          <p style={{ fontWeight: 500, fontSize: '15px' }}>Aucun article emballé pour le moment</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Scannez un S/N en statut "Contrôle qualité" pour le faire apparaître ici.</p>
        </div>
      ) : (
        (() => {
          const clients = [...new Set(cartes.map(c => c.clientValeur || 'Sans client'))].sort()
          const sousOnglets = [
            { key: '__tous__', label: `Tous (${cartes.reduce((s, c) => s + c.quantite, 0)})` },
            ...clients.map(client => ({
              key: client,
              label: `${client} (${cartes.filter(c => (c.clientValeur || 'Sans client') === client).reduce((s, c) => s + c.quantite, 0)})`
            }))
          ]
          return (
            <Tabs
              tabs={sousOnglets.map(o => ({
                key: o.key,
                label: o.label,
                content: (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {cartes
                      .filter(carte => o.key === '__tous__' || (carte.clientValeur || 'Sans client') === o.key)
                      .map((carte, idx) => (
                        <div key={idx} style={{ background: '#1a1d27', border: '1px solid #2d3748', borderRadius: '8px', padding: '12px 14px' }}>
                          {carte.clientValeur && (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
                              <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Client</span>
                              <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc', lineHeight: 1.2 }}>{carte.clientValeur}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>RMA</span>
                            <span style={{ fontWeight: carte.clientValeur ? 500 : 700, fontSize: carte.clientValeur ? '12px' : '14px', color: carte.clientValeur ? '#e2e8f0' : '#f8fafc', lineHeight: 1.2 }}>{carte.rmaValeur || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: carte.designationValeur ? '2px' : '8px' }}>
                            <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>P/N</span>
                            <span style={{ fontWeight: 500, fontSize: '12px', color: '#e2e8f0' }}>{carte.pnValeur || '—'}</span>
                          </div>
                          {carte.designationValeur && (
                            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>{carte.designationValeur}</div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #2d3748' }}>
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>Quantité</span>
                            <span style={{ fontWeight: 700, fontSize: '16px', color: '#60a5fa' }}>{carte.quantite}</span>
                          </div>
                          {carte.sns.length > 0 && (
                            <details style={{ marginTop: '8px' }}>
                              <summary style={{ fontSize: '11px', color: '#6b7280', cursor: 'pointer' }}>Voir les S/N</summary>
                              <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {carte.sns.map(s => (
                                  <span key={s} style={{ fontFamily: 'monospace', fontSize: '11px', background: '#141720', border: '1px solid #2d3748', borderRadius: '4px', padding: '2px 6px', color: '#cbd5e1' }}>{s}</span>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                  </div>
                )
              }))}
            />
          )
        })()
      )}
    </div>
  )
}

// ─── Onglet Master Box ───────────────────────────────────────────────────────

interface ScanMasterBoxResult {
  ok: boolean
  sn: string
  pnValeur: string
  rmaValeur: string
  designationValeur: string
  clientValeur: string | null
  masterBox: { id: number; numero: string }
}

interface BoxEnCours {
  id: number
  numero: string
  quantite: number
  createdAt: string
}

interface GroupeEnCours {
  pnValeur: string
  rmaValeur: string
  designationValeur: string
  quantite: number
}

interface ClientEnCours {
  clientValeur: string
  totalQuantite: number
  boxes: BoxEnCours[]
  groupes: GroupeEnCours[]
}

interface ArticleMasterBox {
  inventaireId: number
  sn: string
  pnValeur: string
  rmaValeur: string
  designationValeur: string
  modelValeur: string
  clientValeur: string
}

interface GroupeMasterBox {
  pnValeur: string
  rmaValeur: string
  designationValeur: string
  modelValeur: string
  quantite: number
}

interface MasterBoxDetail {
  id: number
  numero: string
  clientValeur: string | null
  zone: string | null
  statut: string
  createdAt: string
  quantite: number
  articles: ArticleMasterBox[]
  groupes: GroupeMasterBox[]
}

interface ArticleExport {
  id: number
  serialNumber: string
  partNumber: string
  rma: string
  customer: string
  productFamily: string
  livelloRiparazione: string
  warranty: string
  statut: { label: string } | null
}

const ARTICLE_EXPORT_COLUMNS = [
  { key: 'statut', label: 'Statut' },
  { key: 'serialNumber', label: 'N° de série' },
  { key: 'partNumber', label: 'P/N' },
  { key: 'rma', label: 'RMA' },
  { key: 'customer', label: 'Client' },
  { key: 'productFamily', label: 'Famille produit' },
  { key: 'livelloRiparazione', label: 'Niveau réparation' },
  { key: 'warranty', label: 'Garantie' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Numéro de carton à afficher sur l'étiquette : "MB-0001" -> "1" */
function numeroBox(numero: string): string {
  const m = numero.match(/(\d+)\s*$/)
  if (!m) return numero
  return String(parseInt(m[1], 10))
}

const sectionTitre: CSSProperties = {
  textAlign: 'center', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', borderTop: '1px solid #9ca3af', borderBottom: '1px solid #9ca3af',
  padding: '4px 0', margin: '12px 0 10px'
}

/** Bandeau "logo" Castles Technology (pas d'image fournie : rendu typographique) */
function CastlesLogo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: '14px' }}>
      <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '0.06em', color: '#111827' }}>CASTLES</span>{' '}
      <span style={{ fontSize: '22px', fontWeight: 300, letterSpacing: '0.18em', color: '#111827' }}>TECHNOLOGY</span>
    </div>
  )
}

/** Étiquette zone A3F : Box / Customer, quantité globale, table N°/Model/P-N/S-N/Barcode (P/N par ligne) */
function EtiquetteA3F({ detail }: { detail: MasterBoxDetail }) {
  return (
    <div className="label-paper" style={{ maxWidth: '520px', marginBottom: '32px' }}>
      <CastlesLogo />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
        <span>Box : {numeroBox(detail.numero)}</span>
        <span>Customer : {detail.clientValeur || '—'}</span>
      </div>
      <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 800, margin: '12px 0' }}>
        QUANTITY : {detail.quantite}
      </div>
      <div style={sectionTitre}>Serial Number</div>
      <table className="table">
        <thead>
          <tr>
            <th>N°</th><th>MODEL</th><th>P/N</th><th>S/N</th><th>BARCODE</th>
          </tr>
        </thead>
        <tbody>
          {detail.articles.map((a, i) => (
            <tr key={a.inventaireId}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{a.modelValeur || '—'}</td>
              <td>{a.pnValeur || '—'}</td>
              <td style={{ fontFamily: 'monospace' }}>{a.sn || '—'}</td>
              <td><span className="barcode">*{a.sn || '—'}*</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Étiquette zone Adyen : Box, Part Number unique + RMA_xxx, quantité, table N°/Model/S-N/Barcode (sans P/N) */
function EtiquetteAdyen({ detail }: { detail: MasterBoxDetail }) {
  const rma = detail.groupes[0]?.rmaValeur || ''
  return (
    <div className="label-paper" style={{ maxWidth: '520px', marginBottom: '32px' }}>
      <CastlesLogo />
      <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
        Box : {numeroBox(detail.numero)}
      </div>
      <div style={sectionTitre}>Part Number</div>
      {detail.groupes.map((g, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
          <span>{g.modelValeur || '—'}</span>
          <span>{g.pnValeur || '—'}</span>
          <span className="barcode">*{g.pnValeur || '—'}*</span>
        </div>
      ))}
      <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 800, margin: '10px 0' }}>
        RMA_{rma || '—'}
      </div>
      <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 800, margin: '12px 0' }}>
        QUANTITY : {detail.quantite}
      </div>
      <div style={sectionTitre}>Serial Number</div>
      <table className="table">
        <thead>
          <tr>
            <th>N°</th><th>MODEL</th><th>S/N</th><th>BARCODE</th>
          </tr>
        </thead>
        <tbody>
          {detail.articles.map((a, i) => (
            <tr key={a.inventaireId}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{a.modelValeur || '—'}</td>
              <td style={{ fontFamily: 'monospace' }}>{a.sn || '—'}</td>
              <td><span className="barcode">*{a.sn || '—'}*</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Vue imprimable : étiquette de carton (gabarit selon la zone du client) + liste des terminaux d'une Master Box */
function MasterBoxImpression({ detail, onFermer }: { detail: MasterBoxDetail; onFermer: () => void }) {
  return (
    <div>
      <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className="btn btn-secondary" onClick={onFermer}>
          <ArrowLeft size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Retour
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Imprimer
        </button>
      </div>

      <div className="print-zone">
        {/* Étiquette à coller sur le carton — gabarit selon la zone du client */}
        {detail.zone === 'Adyen' ? <EtiquetteAdyen detail={detail} /> : <EtiquetteA3F detail={detail} />}

        <div className="no-print" style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
          Master Box {detail.numero} — généré le {formatDate(detail.createdAt)}
          {detail.zone && ` — zone ${detail.zone}`}
        </div>
      </div>
    </div>
  )
}

function MasterBoxTab() {
  const siteId = getSiteId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [sn, setSn] = useState('')
  const [enCours, setEnCours] = useState<MasterBoxDetail[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [dernier, setDernier] = useState<ScanMasterBoxResult | null>(null)
  const [detail, setDetail] = useState<MasterBoxDetail | null>(null)
  const [actionEnCours, setActionEnCours] = useState<number | null>(null)

  useEffect(() => { reload() }, [siteId])
  useEffect(() => { inputRef.current?.focus() }, [chargement, detail])

  async function reload() {
    setChargement(true)
    try {
      const ec = await get<MasterBoxDetail[]>(`/expeditions/${siteId}/masterbox/en-cours`)
      setEnCours(ec)
    } finally {
      setChargement(false)
    }
  }

  async function scanner() {
    const valeur = sn.trim()
    if (!valeur) return

    try {
      const res = await post<ScanMasterBoxResult>(`/expeditions/${siteId}/masterbox/scan`, { sn: valeur })
      jouerSonSucces()
      setDernier(res)
      setErreur(null)
      setSn('')
      await reload()
    } catch (e: any) {
      jouerSonAlerte()
      setErreur(e.message || 'Erreur lors du scan')
      setDernier(null)
      setSn('')
    }
    inputRef.current?.focus()
  }

  async function enregistrer(id: number) {
    setActionEnCours(id)
    setErreur(null)
    try {
      await post(`/expeditions/${siteId}/masterbox/${id}/enregistrer`, {})
      await reload()
    } catch (e: any) {
      setErreur(e.message || 'Erreur lors de l\'enregistrement de la Master Box')
    } finally {
      setActionEnCours(null)
    }
  }

  async function voirDetail(id: number) {
    setErreur(null)
    try {
      const d = await get<MasterBoxDetail>(`/expeditions/${siteId}/masterbox/${id}`)
      setDetail(d)
    } catch (e: any) {
      setErreur(e.message || 'Erreur lors du chargement de la Master Box')
    }
  }

  if (detail) {
    return <MasterBoxImpression detail={detail} onFermer={() => { setDetail(null); reload() }} />
  }

  if (chargement) {
    return <div className="loading-container"><div className="loading-spinner" /></div>
  }

  return (
    <div>
      {/* Zone de scan */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            <ScanLine size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Scanner un S/N emballé pour l'ajouter à la Master Box en cours
          </label>
          <input
            ref={inputRef}
            className="form-input"
            placeholder="Scanner ou saisir un S/N..."
            value={sn}
            onChange={e => setSn(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); scanner() } }}
            autoFocus
          />
        </div>

        {erreur && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '8px 12px', background: '#3b0d0d', border: '1px solid #dc2626', borderRadius: '6px', color: '#fca5a5', fontSize: '13px' }}>
            <AlertTriangle size={15} />
            {erreur}
          </div>
        )}

        {dernier && !erreur && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '8px 12px', background: '#052e16', border: '1px solid #16a34a', borderRadius: '6px', color: '#4ade80', fontSize: '13px' }}>
            <PackageCheck size={15} />
            <span>
              <strong>{dernier.sn}</strong> ajouté à la Master Box <strong>{dernier.masterBox.numero}</strong>
              {dernier.clientValeur && <> — Client <strong>{dernier.clientValeur}</strong></>}
              {dernier.rmaValeur && <> · RMA <strong>{dernier.rmaValeur}</strong></>}
              {dernier.pnValeur && <> · P/N <strong>{dernier.pnValeur}</strong></>}
            </span>
          </div>
        )}
      </div>

      {/* Master Box en cours de remplissage */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '12px' }}>
        Master Box en cours
      </h2>

      {enCours.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px', color: '#6b7280', marginBottom: '24px' }}>
          <Boxes size={36} style={{ marginBottom: '14px', color: '#374151' }} />
          <p style={{ fontWeight: 500, fontSize: '15px' }}>Aucune Master Box en cours</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Scannez un S/N emballé pour démarrer une Master Box.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {enCours.map(box => (
            <div key={box.id} className="card" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0, fontFamily: 'monospace' }}>{box.numero}</h3>
                <span style={{ fontWeight: 700, fontSize: '16px', color: '#60a5fa' }}>{box.quantite}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>
                {box.clientValeur || 'Sans client'}{box.zone && ` · zone ${box.zone}`}
              </div>

              <div style={{ marginBottom: '10px' }}>
                {box.groupes.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#e2e8f0', marginBottom: '2px' }}>
                    <span>{g.pnValeur || '—'} {g.rmaValeur && `· RMA ${g.rmaValeur}`}</span>
                    <span style={{ fontWeight: 700 }}>{g.quantite}</span>
                  </div>
                ))}
              </div>

              {box.articles.length > 0 && (
                <details style={{ marginBottom: '12px' }}>
                  <summary style={{ fontSize: '11px', color: '#6b7280', cursor: 'pointer' }}>Voir les S/N</summary>
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {box.articles.map(a => (
                      <span key={a.inventaireId} style={{ fontFamily: 'monospace', fontSize: '11px', background: '#141720', border: '1px solid #2d3748', borderRadius: '4px', padding: '2px 6px', color: '#cbd5e1' }}>{a.sn}</span>
                    ))}
                  </div>
                </details>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => voirDetail(box.id)}>
                  <Printer size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Imprimer
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={actionEnCours === box.id}
                  onClick={() => enregistrer(box.id)}
                >
                  <Save size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Enregistrer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Onglet Envoi ────────────────────────────────────────────────────────────

function EnvoiTab() {
  const siteId = getSiteId()

  const [enCours, setEnCours] = useState<ClientEnCours[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [envoiEnCours, setEnvoiEnCours] = useState<string | null>(null)
  const [modalClient, setModalClient] = useState<string | null>(null)
  const [mbDetailId, setMbDetailId] = useState<number | null>(null)
  const [mbDetail, setMbDetail] = useState<MasterBoxDetail | null>(null)
  const [detail, setDetail] = useState<MasterBoxDetail | null>(null)
  const [confirmEnvoi, setConfirmEnvoi] = useState<ClientEnCours | null>(null)
  const [bonEnvoi, setBonEnvoi] = useState('')
  const [bonLivraison, setBonLivraison] = useState('')
  const [confirmRetrait, setConfirmRetrait] = useState<{ inventaireId: number; sn: string; masterBoxId: number } | null>(null)
  const [retraitEnCours, setRetraitEnCours] = useState(false)
  const [exportData, setExportData] = useState<{ articles: ArticleExport[] } | null>(null)
  const [plateformes, setPlateformes] = useState<any[]>([])
  const [champsPlateforme, setChampsPlateforme] = useState<any[]>([])
  const [plateformeSelectionnee, setPlateformeSelectionnee] = useState<number | ''>('')
  const [configSite, setConfigSite] = useState<ConfigSiteType | null>(null)
  const [genBLenCours, setGenBLenCours] = useState(false)
  const [eta, setEta] = useState('')
  const [colis, setColis] = useState<ColisBL[]>([{ type: 'Carton', longueur: '', largeur: '', hauteur: '', poids: '' }])
  const [blParClient, setBlParClient] = useState<Record<string, { numero: string; eta: string; colis: ColisBL[] }>>({})

  useEffect(() => { reload() }, [siteId])

  useEffect(() => {
    Promise.all([
      get<any[]>(`/plateformes/${siteId}`),
      get<any[]>(`/plateformes/${siteId}/champs`),
      get<ConfigSiteType>(`/config-site/${siteId}`)
    ]).then(([pl, cp, cs]) => {
      setPlateformes(pl)
      setChampsPlateforme(cp.filter((c: any) => c.actif))
      setConfigSite(cs)
    }).catch(() => {})
  }, [siteId])

  useEffect(() => {
    if (!modalClient) { setExportData(null); return }
    get<{ articles: ArticleExport[] }>(`/expeditions/${siteId}/masterbox/enregistrees-articles?clientValeur=${encodeURIComponent(modalClient)}`)
      .then(setExportData)
      .catch(() => setExportData(null))
  }, [modalClient, siteId])

  async function reload() {
    setChargement(true)
    try {
      const data = await get<ClientEnCours[]>(`/expeditions/${siteId}/masterbox/enregistrees`)
      setEnCours(data)
      return data
    } finally {
      setChargement(false)
    }
  }

  function getPlateformeAdresse(pl: any): PlateformeAdresse {
    function val(code: string): string {
      const champ = champsPlateforme.find((c: any) => c.code.toUpperCase() === code)
      if (!champ) return ''
      return pl.valeurs?.find((v: any) => v.champId === champ.id)?.valeur ?? ''
    }
    return {
      nom: val('NOM'),
      adresse: val('ADRESSE'),
      codePostal: val('CODE_POSTALE'),
      ville: val('VILLE'),
      pays: val('PAYS'),
      tel: val('TEL'),
      mail: val('MAIL'),
      contact: val('CONTACT')
    }
  }

  async function handleGenererBL() {
    if (!configSite) return
    setGenBLenCours(true)
    try {
      const clientValeur = confirmEnvoi?.clientValeur === 'Sans client' ? '' : (confirmEnvoi?.clientValeur ?? '')
      const clientKey = confirmEnvoi?.clientValeur ?? ''

      // Récupère un nouveau numéro seulement si aucun n'existe encore pour ce client
      let numero = blParClient[clientKey]?.numero ?? ''
      const [numeroResult, { articles: articlesRaw }] = await Promise.all([
        numero ? Promise.resolve({ numero }) : post<{ numero: string }>(`/config-site/${siteId}/next-bl`, {}),
        get<{ articles: ArticleBL[] }>(`/expeditions/${siteId}/masterbox/bl-articles?clientValeur=${encodeURIComponent(clientValeur)}`)
      ])
      numero = numeroResult.numero

      // Mémorise en mémoire et en base pour partage multi-postes
      setBlParClient(prev => ({ ...prev, [clientKey]: { numero, eta, colis } }))
      const clientParam = clientKey === 'Sans client' ? '' : clientKey
      await put(`/expeditions/${siteId}/brouillon-bl?clientValeur=${encodeURIComponent(clientParam)}`, {
        numeroBL: numero,
        bonTransport: bonEnvoi.trim() || null,
        eta,
        colisJson: JSON.stringify(colis),
        plateformeId: plateformeSelectionnee || null
      }).catch(() => {})

      const pl = plateformes.find((p: any) => p.id === plateformeSelectionnee)
      const destinataire: PlateformeAdresse = pl
        ? getPlateformeAdresse(pl)
        : { nom: '', adresse: '', codePostal: '', ville: '', pays: '', tel: '', mail: '', contact: '' }

      const now = new Date()
      const date = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
      const etaFormate = eta ? new Date(eta).toLocaleDateString('en-GB') : ''
      const html = genererHTMLBL({ numero, bonTransport: bonEnvoi, date, eta: etaFormate, expediteur: configSite, destinataire, articles: articlesRaw, colis })

      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    } catch (e: any) {
      setErreur(e.message || 'Erreur lors de la génération du BL')
    } finally {
      setGenBLenCours(false)
    }
  }

  function handleConfirmerEnvoi() {
    envoyer(confirmEnvoi!)
  }

  async function envoyer(client: ClientEnCours) {
    setEnvoiEnCours(client.clientValeur)
    setErreur(null)
    setSucces(null)
    try {
      const clientValeur = client.clientValeur === 'Sans client' ? null : client.clientValeur
      const numeroBL = bonLivraison.trim() || blParClient[client.clientValeur]?.numero || undefined
      const res = await post<{ ok: boolean; nbBoxes: number; nbArticles: number }>(`/expeditions/${siteId}/masterbox/envoyer`, {
        clientValeur,
        bonEnvoi: bonEnvoi.trim() || undefined,
        bonLivraison: numeroBL
      })
      setSucces(`${res.nbArticles} article(s) expédié(s) dans ${res.nbBoxes} Master Box pour ${client.clientValeur}`)
      setConfirmEnvoi(null)
      setBonEnvoi('')
      setBonLivraison('')
      setEta('')
      setColis([{ type: 'Carton', longueur: '', largeur: '', hauteur: '', poids: '' }])
      setBlParClient(prev => { const next = { ...prev }; delete next[client.clientValeur]; return next })
      try { localStorage.removeItem(`bl_par_client_${siteId}`) } catch {}
      fermerModalClient()
      await reload()
    } catch (e: any) {
      setErreur(e.message || 'Erreur lors de l\'envoi')
    } finally {
      setEnvoiEnCours(null)
    }
  }

  async function retirer() {
    if (!confirmRetrait) return
    setRetraitEnCours(true)
    setErreur(null)
    try {
      const res = await post<{ ok: boolean; masterBoxSupprimee: boolean }>(`/expeditions/${siteId}/masterbox/retirer`, { inventaireId: confirmRetrait.inventaireId })
      const data = await reload()
      if (res.masterBoxSupprimee) {
        setMbDetailId(null)
        setMbDetail(null)
      } else {
        const d = await get<MasterBoxDetail>(`/expeditions/${siteId}/masterbox/${confirmRetrait.masterBoxId}`)
        setMbDetail(d)
      }
      if (modalClient && data && !data.some(c => c.clientValeur === modalClient)) {
        fermerModalClient()
      }
      setConfirmRetrait(null)
    } catch (e: any) {
      setErreur(e.message || 'Erreur lors du retrait')
    } finally {
      setRetraitEnCours(false)
    }
  }

  async function voirDetail(id: number) {
    setErreur(null)
    try {
      const d = await get<MasterBoxDetail>(`/expeditions/${siteId}/masterbox/${id}`)
      setDetail(d)
    } catch (e: any) {
      setErreur(e.message || 'Erreur lors du chargement de la Master Box')
    }
  }

  async function toggleDetailLigne(id: number) {
    if (mbDetailId === id) {
      setMbDetailId(null)
      setMbDetail(null)
      return
    }
    setErreur(null)
    try {
      const d = await get<MasterBoxDetail>(`/expeditions/${siteId}/masterbox/${id}`)
      setMbDetailId(id)
      setMbDetail(d)
    } catch (e: any) {
      setErreur(e.message || 'Erreur lors du chargement de la Master Box')
    }
  }

  function fermerModalClient() {
    setModalClient(null)
    setMbDetailId(null)
    setMbDetail(null)
  }

  if (detail) {
    return <MasterBoxImpression detail={detail} onFermer={() => setDetail(null)} />
  }

  if (chargement) {
    return <div className="loading-container"><div className="loading-spinner" /></div>
  }

  const clientModal = enCours.find(c => c.clientValeur === modalClient)

  return (
    <div>
      {erreur && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '8px 12px', background: '#3b0d0d', border: '1px solid #dc2626', borderRadius: '6px', color: '#fca5a5', fontSize: '13px' }}>
          <AlertTriangle size={15} />
          {erreur}
        </div>
      )}

      {succes && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '8px 12px', background: '#052e16', border: '1px solid #16a34a', borderRadius: '6px', color: '#4ade80', fontSize: '13px' }}>
          <PackageCheck size={15} />
          {succes}
        </div>
      )}

      {enCours.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px', color: '#6b7280' }}>
          <Truck size={36} style={{ marginBottom: '14px', color: '#374151' }} />
          <p style={{ fontWeight: 500, fontSize: '15px' }}>Aucune Master Box en attente d'envoi</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Enregistrez des Master Box dans l'onglet "Master Box" pour préparer un envoi.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {enCours.map(c => (
            <div
              key={c.clientValeur}
              className="card"
              style={{ margin: 0, cursor: 'pointer' }}
              onClick={() => setModalClient(c.clientValeur)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{c.clientValeur}</h3>
                <span style={{ fontWeight: 700, fontSize: '16px', color: '#60a5fa' }}>{c.totalQuantite}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                {c.boxes.length} Master Box prête{c.boxes.length > 1 ? 's' : ''} à expédier
              </div>
              <div style={{ borderTop: '1px solid #2d3748', paddingTop: '8px' }}>
                {c.groupes.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1', marginBottom: '2px' }}>
                    <span>{g.pnValeur || '—'}{g.rmaValeur && ` · RMA ${g.rmaValeur}`}</span>
                    <span style={{ fontWeight: 700 }}>{g.quantite}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de détail / envoi pour un client */}
      {clientModal && (
        <div className="modal-overlay" onClick={fermerModalClient}>
          <div
            style={{ background: '#1a1d27', borderRadius: '12px', padding: '24px', maxWidth: '720px', width: '100%', maxHeight: '80vh', overflow: 'auto', border: '1px solid #2d3748' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Master Box prêtes à expédier — {clientModal.clientValeur}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {exportData && exportData.articles.length > 0 && (
                  <ExportExcelButton
                    columns={ARTICLE_EXPORT_COLUMNS as ExportColumn[]}
                    rows={exportData.articles}
                    getValue={(row: ArticleExport, key: string) => key === 'statut' ? (row.statut?.label ?? '') : ((row as any)[key] ?? '')}
                    filename={`expedition_${clientModal.clientValeur}_${new Date().toISOString().slice(0, 10)}.xlsx`}
                    sheetName="Expédition"
                  />
                )}
                <button className="btn btn-secondary btn-icon" onClick={fermerModalClient}>
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="table-container" style={{ marginBottom: '16px' }}>
              <table className="table">
                <thead>
                  <tr><th>Master Box</th><th>Articles</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {clientModal.boxes.map(b => (
                    <tr
                      key={b.id}
                      style={{ cursor: 'pointer', background: mbDetailId === b.id ? '#141d2e' : undefined }}
                      onClick={() => toggleDetailLigne(b.id)}
                    >
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc' }}>{b.numero}</td>
                      <td>{b.quantite}</td>
                      <td>{formatDate(b.createdAt)}</td>
                      <td>
                        <button className="btn btn-secondary btn-icon" title="Voir / Imprimer" onClick={e => { e.stopPropagation(); voirDetail(b.id) }}>
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {mbDetail && (
              <div style={{ marginBottom: '16px', padding: '12px', background: '#141720', borderRadius: '8px', border: '1px solid #2d3748' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px' }}>
                  Détail {mbDetail.numero} — {mbDetail.quantite} article(s)
                </h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr><th>#</th><th>S/N</th><th>P/N</th><th>RMA</th><th>Désignation</th><th></th></tr>
                    </thead>
                    <tbody>
                      {mbDetail.articles.map((a, i) => (
                        <tr key={a.inventaireId}>
                          <td>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace' }}>{a.sn || '—'}</td>
                          <td>{a.pnValeur || '—'}</td>
                          <td>{a.rmaValeur || '—'}</td>
                          <td>{a.designationValeur || '—'}</td>
                          <td>
                            <button
                              className="btn btn-secondary btn-icon"
                              title="Retirer de la Master Box"
                              onClick={() => setConfirmRetrait({ inventaireId: a.inventaireId, sn: a.sn || '—', masterBoxId: mbDetail.id })}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              disabled={envoiEnCours === clientModal.clientValeur}
              onClick={async () => {
                setBonLivraison('')
                setConfirmEnvoi(clientModal)
                try {
                  const clientParam = clientModal.clientValeur === 'Sans client' ? '' : clientModal.clientValeur
                  const brouillon = await get<{ numeroBL: string; bonTransport: string | null; eta: string | null; colisJson: string | null; plateformeId: number | null } | null>(
                    `/expeditions/${siteId}/brouillon-bl?clientValeur=${encodeURIComponent(clientParam)}`
                  )
                  if (brouillon) {
                    const colisStored: ColisBL[] = brouillon.colisJson ? JSON.parse(brouillon.colisJson) : [{ type: 'Carton', longueur: '', largeur: '', hauteur: '', poids: '' }]
                    setBlParClient(prev => ({ ...prev, [clientModal.clientValeur]: { numero: brouillon.numeroBL, eta: brouillon.eta ?? '', colis: colisStored } }))
                    setBonEnvoi(brouillon.bonTransport ?? '')
                    setEta(brouillon.eta ?? '')
                    setColis(colisStored)
                    if (brouillon.plateformeId) setPlateformeSelectionnee(brouillon.plateformeId)
                  } else {
                    setBonEnvoi('')
                    setEta('')
                    setColis([{ type: 'Carton', longueur: '', largeur: '', hauteur: '', poids: '' }])
                    setPlateformeSelectionnee('')
                  }
                } catch {}
              }}
            >
              <Send size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Envoyer les articles ({clientModal.totalQuantite})
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmation d'envoi */}
      {confirmEnvoi && (
        <div className="modal-overlay" onClick={() => { setConfirmEnvoi(null); setBonEnvoi('') }}>
          <div
            style={{ background: '#1a1d27', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '100%', border: '1px solid #2d3748' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: '0 0 12px' }}>
              Confirmer l'expédition
            </h3>
            <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '16px' }}>
              Expédition de <strong>{confirmEnvoi.totalQuantite} article(s)</strong> pour <strong>{confirmEnvoi.clientValeur}</strong>
            </p>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">N° de transport (BT)</label>
              <input
                className="form-input"
                value={bonEnvoi}
                onChange={e => setBonEnvoi(e.target.value)}
                placeholder="Ex: BT-123456"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">
                N° BL
                <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: '6px', fontSize: '11px' }}>
                  (fourni par le client — laisser vide pour en générer un)
                </span>
              </label>
              <input
                className="form-input"
                value={bonLivraison}
                onChange={e => setBonLivraison(e.target.value)}
                placeholder="Ex: BL-2026-0001"
              />
            </div>

            {!bonLivraison.trim() && (
              <div style={{ background: '#141720', borderRadius: '8px', padding: '14px', marginBottom: '16px', border: '1px solid #2d3748' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Générer mon BL
                </div>

                {blParClient[confirmEnvoi.clientValeur]?.numero && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '6px 10px', background: '#1e3a5f', borderRadius: '6px', border: '1px solid #2563eb' }}>
                    <FileText size={13} color="#60a5fa" />
                    <span style={{ fontSize: '12px', color: '#93c5fd' }}>N° généré : </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc', fontSize: '13px' }}>{blParClient[confirmEnvoi.clientValeur].numero}</span>
                  </div>
                )}

                {plateformes.length > 0 && (
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>Plateforme destinataire</label>
                    <select
                      className="form-input"
                      value={plateformeSelectionnee}
                      onChange={e => setPlateformeSelectionnee(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <option value="">— Choisir une plateforme —</option>
                      {plateformes.map(pl => {
                        const champNom = champsPlateforme.find((c: any) => c.code.toUpperCase() === 'NOM')
                        const nom = champNom ? pl.valeurs?.find((v: any) => v.champId === champNom.id)?.valeur ?? `Plateforme #${pl.id}` : `Plateforme #${pl.id}`
                        return <option key={pl.id} value={pl.id}>{nom}</option>
                      })}
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>ETA (date de livraison estimée)</label>
                  <input type="date" className="form-input" value={eta} onChange={e => setEta(e.target.value)} />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontSize: '12px', margin: 0 }}>Colis</label>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '2px 8px', height: 'auto' }}
                      onClick={() => setColis(c => [...c, { type: 'Carton', longueur: '', largeur: '', hauteur: '', poids: '' }])}
                    >
                      + Ajouter un colis
                    </button>
                  </div>
                  {colis.map((c, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 70px auto', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                      <select
                        className="form-input"
                        style={{ fontSize: '11px', padding: '4px 6px' }}
                        value={c.type}
                        onChange={e => setColis(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                      >
                        <option>Carton</option>
                        <option>Palette</option>
                        <option>Caisse</option>
                        <option>Autre</option>
                      </select>
                      <input className="form-input" style={{ fontSize: '11px', padding: '4px 6px' }} placeholder="L (cm)" value={c.longueur}
                        onChange={e => setColis(prev => prev.map((x, j) => j === i ? { ...x, longueur: e.target.value } : x))} />
                      <input className="form-input" style={{ fontSize: '11px', padding: '4px 6px' }} placeholder="l (cm)" value={c.largeur}
                        onChange={e => setColis(prev => prev.map((x, j) => j === i ? { ...x, largeur: e.target.value } : x))} />
                      <input className="form-input" style={{ fontSize: '11px', padding: '4px 6px' }} placeholder="H (cm)" value={c.hauteur}
                        onChange={e => setColis(prev => prev.map((x, j) => j === i ? { ...x, hauteur: e.target.value } : x))} />
                      <input className="form-input" style={{ fontSize: '11px', padding: '4px 6px' }} placeholder="kg" value={c.poids}
                        onChange={e => setColis(prev => prev.map((x, j) => j === i ? { ...x, poids: e.target.value } : x))} />
                      <button
                        type="button"
                        className="btn btn-danger btn-icon"
                        style={{ padding: '4px', opacity: colis.length === 1 ? 0.3 : 1 }}
                        disabled={colis.length === 1}
                        onClick={() => setColis(prev => prev.filter((_, j) => j !== i))}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>L × l × H en cm, poids en kg</div>
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={genBLenCours || !configSite}
                  onClick={handleGenererBL}
                >
                  <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  {genBLenCours ? 'En cours...' : blParClient[confirmEnvoi.clientValeur]?.numero ? 'Réimprimer le BL (articles mis à jour)' : 'Générer et imprimer mon BL'}
                </button>
              </div>
            )}

            {(() => {
              const aBL = !!(bonLivraison.trim() || blParClient[confirmEnvoi.clientValeur]?.numero)
              return (
                <div>
                  {!aBL && (
                    <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={13} />
                      Un numéro de BL est requis pour confirmer l'expédition.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={() => { setConfirmEnvoi(null); setBonEnvoi('') }}>
                      Annuler
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={envoiEnCours === confirmEnvoi.clientValeur || !aBL}
                      onClick={handleConfirmerEnvoi}
                    >
                      <Send size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                      Confirmer l'envoi
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Avertissement BL manquant */}

      {/* Modal de confirmation de retrait d'un article */}
      {confirmRetrait && (
        <div className="modal-overlay" onClick={() => setConfirmRetrait(null)}>
          <div
            style={{ background: '#1a1d27', borderRadius: '12px', padding: '24px', maxWidth: '420px', width: '100%', border: '1px solid #2d3748' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: '0 0 12px' }}>
              Retirer cet article ?
            </h3>
            <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '20px' }}>
              Le S/N <strong style={{ fontFamily: 'monospace' }}>{confirmRetrait.sn}</strong> sera retiré de la Master Box et redeviendra disponible pour un nouvel emballage.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmRetrait(null)}>
                Annuler
              </button>
              <button
                className="btn btn-danger"
                style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }}
                disabled={retraitEnCours}
                onClick={retirer}
              >
                <Trash2 size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Retirer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Expeditions() {
  const [active, setActive] = useState('emballage')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expéditions</h1>
          <p className="page-subtitle">Emballage, regroupement et envoi des articles</p>
        </div>
      </div>

      <Tabs
        active={active}
        onChange={setActive}
        tabs={[
          { key: 'emballage', label: 'Emballage', content: <EmballageTab active={active === 'emballage'} /> },
          { key: 'masterbox', label: 'Master Box', content: <MasterBoxTab /> },
          { key: 'envoi', label: 'Envoi', content: <EnvoiTab /> },
        ]}
      />
    </div>
  )
}
