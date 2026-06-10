import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ScanLine, PackageCheck, AlertTriangle, Boxes, Truck, Printer, ArrowLeft } from 'lucide-react'
import { get, post } from '../api/client'
import Tabs from '../components/Tabs'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

function jouerSonAlerte() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

function jouerSonSucces() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.setValueAtTime(990, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25)
  } catch {}
}

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

function EmballageTab() {
  const siteId = getSiteId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [sn, setSn] = useState('')
  const [cartes, setCartes] = useState<CarteEmballage[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [dernier, setDernier] = useState<ScanResult | null>(null)

  useEffect(() => { reload() }, [siteId])
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

      {/* Cartes regroupées par RMA × P/N */}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {cartes.map((carte, idx) => (
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
      )}
    </div>
  )
}

// ─── Onglet Master Box ───────────────────────────────────────────────────────

interface ArticleDisponible {
  id: number
  sn: string
  pnValeur: string
  rmaValeur: string
  designationValeur: string
  clientValeur: string
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

interface MasterBoxResume {
  id: number
  numero: string
  clientValeur: string | null
  statut: string
  createdAt: string
  quantite: number
}

const labelChamp: CSSProperties = { fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }

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

        {/* Liste des terminaux prêts à expédier */}
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '12px' }}>
          Liste des terminaux — {detail.numero}{detail.clientValeur && ` (${detail.clientValeur})`}
        </h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>#</th><th>S/N</th><th>P/N</th><th>RMA</th><th>Désignation</th></tr>
            </thead>
            <tbody>
              {detail.articles.map((a, i) => (
                <tr key={a.inventaireId}>
                  <td>{i + 1}</td>
                  <td style={{ fontFamily: 'monospace' }}>{a.sn || '—'}</td>
                  <td>{a.pnValeur || '—'}</td>
                  <td>{a.rmaValeur || '—'}</td>
                  <td>{a.designationValeur || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Section d'un client : cartes d'articles disponibles (groupées par RMA × P/N) + bouton de génération */
function ClientSection({
  client, articles, selection, onToggle, onToggleGroupe, onGenerer, generation
}: {
  client: string
  articles: ArticleDisponible[]
  selection: Set<number>
  onToggle: (id: number) => void
  onToggleGroupe: (ids: number[], coches: boolean) => void
  onGenerer: (ids: number[]) => void
  generation: boolean
}) {
  const groupes = new Map<string, ArticleDisponible[]>()
  for (const a of articles) {
    const key = `${a.pnValeur}__${a.rmaValeur}`
    if (!groupes.has(key)) groupes.set(key, [])
    groupes.get(key)!.push(a)
  }

  const idsClient = articles.map(a => a.id)
  const selectionnes = idsClient.filter(id => selection.has(id))

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{client}</h3>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{selectionnes.length} / {idsClient.length} sélectionné(s)</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        {Array.from(groupes.entries()).map(([key, arts]) => {
          const ids = arts.map(a => a.id)
          const tousCoches = ids.every(id => selection.has(id))
          return (
            <div key={key} style={{ background: '#1a1d27', border: '1px solid #2d3748', borderRadius: '8px', padding: '12px 14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={tousCoches} onChange={() => onToggleGroupe(ids, tousCoches)} />
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>{arts[0].pnValeur || '—'}</span>
              </label>
              {arts[0].designationValeur && (
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>{arts[0].designationValeur}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                <span style={labelChamp}>RMA</span>
                <span style={{ fontWeight: 500, fontSize: '12px', color: '#e2e8f0' }}>{arts[0].rmaValeur || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #2d3748' }}>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>Quantité</span>
                <span style={{ fontWeight: 700, fontSize: '16px', color: '#60a5fa' }}>{arts.length}</span>
              </div>
              <details style={{ marginTop: '8px' }}>
                <summary style={{ fontSize: '11px', color: '#6b7280', cursor: 'pointer' }}>Voir les S/N</summary>
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {arts.map(a => (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selection.has(a.id)} onChange={() => onToggle(a.id)} />
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }}>{a.sn || '—'}</span>
                    </label>
                  ))}
                </div>
              </details>
            </div>
          )
        })}
      </div>

      <button
        className="btn btn-primary"
        disabled={selectionnes.length === 0 || generation}
        onClick={() => onGenerer(selectionnes)}
      >
        <Boxes size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
        Générer la Master Box ({selectionnes.length})
      </button>
    </div>
  )
}

function MasterBoxTab() {
  const siteId = getSiteId()

  const [disponibles, setDisponibles] = useState<ArticleDisponible[]>([])
  const [historique, setHistorique] = useState<MasterBoxResume[]>([])
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [chargement, setChargement] = useState(true)
  const [generation, setGeneration] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [detail, setDetail] = useState<MasterBoxDetail | null>(null)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    setChargement(true)
    try {
      const [disp, hist] = await Promise.all([
        get<ArticleDisponible[]>(`/expeditions/${siteId}/masterbox/disponibles`),
        get<MasterBoxResume[]>(`/expeditions/${siteId}/masterbox`)
      ])
      setDisponibles(disp)
      setHistorique(hist)
    } finally {
      setChargement(false)
    }
  }

  function toggle(id: number) {
    setSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroupe(ids: number[], coches: boolean) {
    setSelection(prev => {
      const next = new Set(prev)
      ids.forEach(id => coches ? next.delete(id) : next.add(id))
      return next
    })
  }

  async function genererMasterBox(ids: number[]) {
    setGeneration(true)
    setErreur(null)
    try {
      const created = await post<MasterBoxDetail>(`/expeditions/${siteId}/masterbox`, { inventaireIds: ids })
      setSelection(new Set())
      setDetail(created)
      await reload()
    } catch (e: any) {
      setErreur(e.message || 'Erreur lors de la création de la Master Box')
    } finally {
      setGeneration(false)
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

  const parClient = new Map<string, ArticleDisponible[]>()
  for (const a of disponibles) {
    const client = a.clientValeur || 'Sans client'
    if (!parClient.has(client)) parClient.set(client, [])
    parClient.get(client)!.push(a)
  }

  return (
    <div>
      {erreur && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '8px 12px', background: '#3b0d0d', border: '1px solid #dc2626', borderRadius: '6px', color: '#fca5a5', fontSize: '13px' }}>
          <AlertTriangle size={15} />
          {erreur}
        </div>
      )}

      <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '12px' }}>
        Articles emballés en attente de Master Box {disponibles.length > 0 && `(${disponibles.length} S/N)`}
      </h2>

      {parClient.size === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px', color: '#6b7280', marginBottom: '24px' }}>
          <Boxes size={36} style={{ marginBottom: '14px', color: '#374151' }} />
          <p style={{ fontWeight: 500, fontSize: '15px' }}>Aucun article disponible pour une Master Box</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Les articles emballés (onglet Emballage) apparaîtront ici, regroupés par client.</p>
        </div>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          {Array.from(parClient.entries()).map(([client, articles]) => (
            <ClientSection
              key={client}
              client={client}
              articles={articles}
              selection={selection}
              onToggle={toggle}
              onToggleGroupe={toggleGroupe}
              onGenerer={genererMasterBox}
              generation={generation}
            />
          ))}
        </div>
      )}

      <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '12px' }}>
        Master Box générées
      </h2>
      {historique.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <p style={{ fontSize: '13px' }}>Aucune Master Box générée pour le moment.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Numéro</th><th>Client</th><th>Date</th><th>Articles</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {historique.map(mb => (
                <tr key={mb.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc' }}>{mb.numero}</td>
                  <td>{mb.clientValeur || '—'}</td>
                  <td>{formatDate(mb.createdAt)}</td>
                  <td>{mb.quantite}</td>
                  <td>{mb.statut === 'EN_ATTENTE' ? 'En attente d\'envoi' : mb.statut}</td>
                  <td>
                    <button className="btn btn-secondary btn-icon" title="Voir / Imprimer" onClick={() => voirDetail(mb.id)}>
                      <Printer size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Onglets à venir ────────────────────────────────────────────────────────

function OngletAVenir({ icon: Icon, titre, description }: { icon: any; titre: string; description: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '56px', color: '#6b7280' }}>
      <Icon size={36} style={{ marginBottom: '14px', color: '#374151' }} />
      <p style={{ fontWeight: 500, fontSize: '15px' }}>{titre}</p>
      <p style={{ fontSize: '13px', marginTop: '6px' }}>{description}</p>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Expeditions() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Expéditions</h1>
          <p className="page-subtitle">Emballage, regroupement et envoi des articles</p>
        </div>
      </div>

      <Tabs tabs={[
        { key: 'emballage', label: 'Emballage', content: <EmballageTab /> },
        { key: 'masterbox', label: 'Master Box', content: <MasterBoxTab /> },
        { key: 'envoi', label: 'Envoi', content: <OngletAVenir icon={Truck} titre="Envoi — à venir" description="Préparation et expédition des Master Box." /> },
      ]} />
    </div>
  )
}
