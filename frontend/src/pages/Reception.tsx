import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Plus, Trash2, X } from 'lucide-react'
import { inventaireApi } from '../api/inventaire'
import { get } from '../api/client'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

interface Champ {
  id: number
  code: string
  label: string
  type: string
  options: string | null
  obligatoire: boolean
  actif: boolean
}

interface Article {
  id: number
  valeurs: { champId: number; valeur: string | null; champ: Champ }[]
}

interface Statut {
  id: number
  label: string
  couleur: string
}

interface LigneSN {
  sn: string
  accessoires: number[]
}

// Lot préparé, prêt à être validé
interface LotPrepare {
  articleId: number
  articleLabel: string
  bl: string
  bt: string
  dateCreationBL: string
  dateReception: string
  garantie: string
  statut: string | null
  statutId: number | null
  lignes: { sn: string; accessoiresIds: number[]; accessoiresLabels: string[] }[]
}

const CODES = {
  BL:           ['BL', 'BON_LIVRAISON', 'BON_DE_LIVRAISON'],
  BT:           ['BT', 'BT_RECEP', 'BON_TRANSPORT', 'BON_DE_TRANSPORT'],
  RMA_CREATION: ['RMA_CREATION', 'RMA_CREATION', 'DATE_CREATION_BL', 'DATE_BL', 'DATE_CREATION'],
  DATE_RIC:     ['DATE_RIC', 'DATE_RECEPTION', 'DATE_REC'],
  GARANTIE:     ['GARANTIE'],
  SN:           ['SN', 'S_N', 'SERIAL', 'NUMERO_SERIE', 'NUMERO DE SERIE', 'SERIAL_NUMBER'],
  ACCESSOIRES:  ['ACCESSOIRES', 'ACCESSOIRE', 'ACCESSORIES'],
}

const CODES_PN          = ['PN', 'P_N', 'PART_NUMBER', 'PART_NO']
const CODES_DESIGNATION = ['DESIGNATION', 'DESIG', 'NOM', 'LIBELLE', 'DESCRIPTION']
const CODES_TYPE        = ['TYPE', 'TYPE_PRODUIT', 'CATEGORIE']

function normalize(str: string): string {
  return str.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function findChampId(champs: Champ[], codes: string[]): number | null {
  const normalizedCodes = codes.map(normalize)
  const c = champs.find(ch => normalizedCodes.includes(normalize(ch.code)))
  return c ? c.id : null
}

export default function Reception() {
  const siteId = getSiteId()
  const snInputRef = useRef<HTMLInputElement>(null)

  const [champsArticles, setChampsArticles] = useState<Champ[]>([])
  const [champsInv, setChampsInv] = useState<Champ[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesAccessoires, setArticlesAccessoires] = useState<Article[]>([])
  const [statuts, setStatuts] = useState<Statut[]>([])

  // Formulaire
  const [articleId, setArticleId] = useState<number>(0)
  const [bl, setBl] = useState('')
  const [bt, setBt] = useState('')
  const [dateCreationBL, setDateCreationBL] = useState('')
  const [dateReception, setDateReception] = useState(new Date().toISOString().split('T')[0])
  const [garantie, setGarantie] = useState('')
  const [lignesSN, setLignesSN] = useState<LigneSN[]>([])
  const [snCurrent, setSnCurrent] = useState('')

  // Lot préparé (tableau de droite)
  const [lotPrepare, setLotPrepare] = useState<LotPrepare | null>(null)

  const [validation, setValidation] = useState(false)
  const [showModalReset, setShowModalReset] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [ca, ci, a, s] = await Promise.all([
      get<Champ[]>(`/articles/${siteId}/champs`),
      inventaireApi.getChamps(siteId),
      get<Article[]>(`/articles/${siteId}`),
      get<Statut[]>(`/workflow/${siteId}/statuts`)
    ])
    setChampsArticles(ca.filter(c => c.actif))
    setChampsInv(ci.filter(c => c.actif))
    setStatuts(s)

    const champsTypeIds = ca.filter(c => CODES_TYPE.includes(c.code.toUpperCase())).map(c => c.id)
    const acc = a.filter(art =>
      art.valeurs.some(v => champsTypeIds.includes(v.champId) && String(v.valeur ?? '').toUpperCase() === 'ACCESSOIRE')
    )
    const normaux = a.filter(art =>
      !art.valeurs.some(v => champsTypeIds.includes(v.champId) && String(v.valeur ?? '').toUpperCase() === 'ACCESSOIRE')
    )
    setArticles(normaux)
    setArticlesAccessoires(acc)
  }

  function getArticleLabel(art: Article): string {
    const pnVal = art.valeurs.find(v => CODES_PN.includes(v.champ?.code?.toUpperCase()))?.valeur
    const desigVal = art.valeurs.find(v => CODES_DESIGNATION.includes(v.champ?.code?.toUpperCase()))?.valeur
    const parts = [pnVal, desigVal].filter(Boolean)
    return parts.length > 0 ? parts.join(' — ') : `Article #${art.id}`
  }

  function getArticleLabelById(id: number): string {
    const art = [...articles, ...articlesAccessoires].find(a => a.id === id)
    return art ? getArticleLabel(art) : `#${id}`
  }

  function isTPE(artId = articleId): boolean {
    const art = articles.find(a => a.id === artId)
    if (!art) return false
    return art.valeurs.some(v => String(v.valeur ?? '').toUpperCase() === 'TPE')
  }

  function getStatutStock(): number | null {
    const s = statuts.find(s =>
      s.code?.toUpperCase().includes('STOCK') || s.label?.toUpperCase().includes('STOCK')
    )
    return s ? s.id : null
  }

  const articleSelectionne = articles.find(a => a.id === articleId)

  function addSN() {
    const sn = snCurrent.trim()
    if (!sn || lignesSN.some(l => l.sn === sn)) return
    setLignesSN(prev => [...prev, { sn, accessoires: [] }])
    setSnCurrent('')
    snInputRef.current?.focus()
  }

  function removeSN(sn: string) {
    setLignesSN(prev => prev.filter(l => l.sn !== sn))
  }

  function toggleAccessoire(sn: string, accId: number) {
    setLignesSN(prev => prev.map(l => {
      if (l.sn !== sn) return l
      const has = l.accessoires.includes(accId)
      return { ...l, accessoires: has ? l.accessoires.filter(id => id !== accId) : [...l.accessoires, accId] }
    }))
  }

  // Étape 1 : Préparer → affiche dans le tableau de droite
  function handlePreparer(e: React.FormEvent) {
    e.preventDefault()
    if (!articleId) return
    if (lignesSN.length === 0) { setErreur('Ajoutez au moins un S/N'); return }
    setErreur(null)

    const art = articles.find(a => a.id === articleId)!
    const stockId = isTPE() ? getStatutStock() : null
    const statutLabel = statuts.find(s => s.id === stockId)?.label ?? null

    setLotPrepare({
      articleId,
      articleLabel: getArticleLabel(art),
      bl, bt, dateCreationBL, dateReception, garantie,
      statut: statutLabel,
      statutId: stockId,
      lignes: lignesSN.map(l => ({
        sn: l.sn,
        accessoiresIds: l.accessoires,
        accessoiresLabels: l.accessoires.map(id => getArticleLabelById(id))
      }))
    })
  }

  // Étape 2 : Valider → envoie en BDD
  async function handleValider() {
    if (!lotPrepare) return
    setErreur(null)
    try {
      const idBL       = findChampId(champsInv, CODES.BL)
      const idBT       = findChampId(champsInv, CODES.BT)
      const idRMA      = findChampId(champsInv, CODES.RMA_CREATION)
      const idRIC      = findChampId(champsInv, CODES.DATE_RIC)
      const idGarantie = findChampId(champsInv, CODES.GARANTIE)
      const idSN       = findChampId(champsInv, CODES.SN)
      const idAcc      = findChampId(champsInv, CODES.ACCESSOIRES)

      for (const ligne of lotPrepare.lignes) {
        const valeurs: { champId: number; valeur: string }[] = []
        if (idBL && lotPrepare.bl)              valeurs.push({ champId: idBL, valeur: lotPrepare.bl })
        if (idBT && lotPrepare.bt)              valeurs.push({ champId: idBT, valeur: lotPrepare.bt })
        if (idRMA && lotPrepare.dateCreationBL) valeurs.push({ champId: idRMA, valeur: lotPrepare.dateCreationBL })
        if (idRIC && lotPrepare.dateReception)  valeurs.push({ champId: idRIC, valeur: lotPrepare.dateReception })
        if (idGarantie && lotPrepare.garantie)  valeurs.push({ champId: idGarantie, valeur: lotPrepare.garantie })
        if (idSN && ligne.sn)                   valeurs.push({ champId: idSN, valeur: ligne.sn })
        if (idAcc && ligne.accessoiresLabels.length > 0)
          valeurs.push({ champId: idAcc, valeur: ligne.accessoiresLabels.join(', ') })

        await inventaireApi.create(siteId, {
          articleId: lotPrepare.articleId,
          statutId: lotPrepare.statutId,
          valeurs
        })
      }

      setLotPrepare(null)
      setLignesSN([])
      setSnCurrent('')
      setValidation(true)
      setTimeout(() => setValidation(false), 3000)
      // Demander si on garde les infos BL
      setShowModalReset(true)
    } catch {
      setErreur('Erreur lors de l\'enregistrement')
    }
  }

  function handleGarderBL() {
    // Garde BL, BT, dates — reset article, garantie, SNs
    setArticleId(0)
    setGarantie('')
    setLignesSN([])
    setSnCurrent('')
    setShowModalReset(false)
  }

  function handleResetComplet() {
    setArticleId(0)
    setBl('')
    setBt('')
    setDateCreationBL('')
    setDateReception(new Date().toISOString().split('T')[0])
    setGarantie('')
    setLignesSN([])
    setSnCurrent('')
    setShowModalReset(false)
  }

  return (
    <>
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Réception</h1>
          <p className="page-subtitle">Saisie des produits réceptionnés</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* Formulaire */}
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>Saisie du lot</h2>
          <form onSubmit={handlePreparer}>

            <div className="form-group">
              <label className="form-label">Article *</label>
              <select required className="form-input" value={articleId}
                onChange={e => { setArticleId(Number(e.target.value)); setLotPrepare(null) }}>
                <option value={0}>— Choisir un article —</option>
                {articles.map(a => (
                  <option key={a.id} value={a.id}>{getArticleLabel(a)}</option>
                ))}
              </select>
            </div>

            {articleSelectionne && (
              <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px' }}>
                {champsArticles.map(c => {
                  const val = articleSelectionne.valeurs.find(v => v.champId === c.id)?.valeur
                  if (!val) return null
                  return (
                    <div key={c.id} style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ color: '#6b7280', minWidth: '80px' }}>{c.label} :</span>
                      <span style={{ fontWeight: 500 }}>{val}</span>
                    </div>
                  )
                })}
                {isTPE() && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '12px' }}>
                    <CheckCircle size={13} />
                    <span>TPE — statut : <strong>{statuts.find(s => s.id === getStatutStock())?.label ?? '⚠️ statut stock introuvable'}</strong></span>
                  </div>
                )}
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0 12px' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">BL</label>
                <input className="form-input" placeholder="N° bon de livraison" value={bl} onChange={e => setBl(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">BT</label>
                <input className="form-input" placeholder="N° bon de transport" value={bt} onChange={e => setBt(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Date création BL</label>
                <input type="date" className="form-input" value={dateCreationBL} onChange={e => setDateCreationBL(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Date réception</label>
                <input type="date" className="form-input" value={dateReception} onChange={e => setDateReception(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                <label className="form-label">Garantie</label>
                <select className="form-input" value={garantie} onChange={e => setGarantie(e.target.value)}>
                  <option value="">— Choisir —</option>
                  <option value="Garantie">Garantie</option>
                  <option value="Hors garantie">Hors garantie</option>
                </select>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '12px 0' }} />

            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label className="form-label">Saisie S/N <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Entrée pour ajouter)</span></label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={snInputRef}
                  className="form-input"
                  placeholder="Scanner ou saisir un S/N..."
                  value={snCurrent}
                  onChange={e => setSnCurrent(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSN() } }}
                />
                <button type="button" className="btn btn-secondary btn-icon" onClick={addSN}><Plus size={16} /></button>
              </div>
            </div>

            {/* Tableau S/N compact */}
            {lignesSN.length > 0 && (
              <div style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#eff6ff' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#2563eb', fontWeight: 600, borderBottom: '1px solid #bfdbfe' }}>
                        S/N ({lignesSN.length})
                      </th>
                      {articlesAccessoires.map(acc => (
                        <th key={acc.id} style={{ padding: '6px 8px', textAlign: 'center', color: '#2563eb', fontWeight: 600, borderBottom: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
                          {getArticleLabel(acc)}
                        </th>
                      ))}
                      <th style={{ padding: '6px 8px', borderBottom: '1px solid #bfdbfe', width: '32px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesSN.map((l, i) => (
                      <tr key={l.sn} style={{ borderBottom: i < lignesSN.length - 1 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8' }}>{l.sn}</td>
                        {articlesAccessoires.map(acc => (
                          <td key={acc.id} style={{ padding: '5px 8px', textAlign: 'center' }}>
                            <input type="checkbox" checked={l.accessoires.includes(acc.id)}
                              onChange={() => toggleAccessoire(l.sn, acc.id)} style={{ cursor: 'pointer' }} />
                          </td>
                        ))}
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <button type="button" onClick={() => removeSN(l.sn)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db' }}>
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {erreur && (
              <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '13px', marginBottom: '10px' }}>
                {erreur}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={lignesSN.length === 0}>
              Préparer la réception {lignesSN.length > 0 ? `(${lignesSN.length} produit${lignesSN.length > 1 ? 's' : ''})` : ''}
            </button>
          </form>
        </div>

        {/* Tableau de vérification */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Vérification avant validation</h2>
            {lotPrepare && (
              <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => setLotPrepare(null)}>
                <Trash2 size={13} /> Annuler
              </button>
            )}
          </div>

          {validation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', color: '#16a34a', fontSize: '14px', marginBottom: '16px' }}>
              <CheckCircle size={18} /> Réception validée et enregistrée dans l'inventaire !
            </div>
          )}

          {!lotPrepare ? (
            <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '48px 0' }}>
              Remplissez le formulaire et cliquez sur "Préparer la réception"
            </p>
          ) : (
            <>
              {/* Résumé lot */}
              <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>{lotPrepare.articleLabel}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  {lotPrepare.bl && <span><span style={{ color: '#6b7280' }}>BL :</span> {lotPrepare.bl}</span>}
                  {lotPrepare.bt && <span><span style={{ color: '#6b7280' }}>BT :</span> {lotPrepare.bt}</span>}
                  {lotPrepare.dateCreationBL && <span><span style={{ color: '#6b7280' }}>Date création BL :</span> {new Date(lotPrepare.dateCreationBL).toLocaleDateString('fr-FR')}</span>}
                  {lotPrepare.dateReception && <span><span style={{ color: '#6b7280' }}>Date réception :</span> {new Date(lotPrepare.dateReception).toLocaleDateString('fr-FR')}</span>}
                  {lotPrepare.garantie && <span><span style={{ color: '#6b7280' }}>Garantie :</span> {lotPrepare.garantie}</span>}
                  {lotPrepare.statut && <span><span style={{ color: '#6b7280' }}>Statut :</span> {lotPrepare.statut}</span>}
                </div>
              </div>

              {/* Tableau S/N */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#eff6ff' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#2563eb', fontWeight: 600, borderBottom: '1px solid #bfdbfe' }}>
                        S/N ({lotPrepare.lignes.length})
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#2563eb', fontWeight: 600, borderBottom: '1px solid #bfdbfe' }}>
                        Accessoires
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotPrepare.lignes.map((ligne, i) => (
                      <tr key={ligne.sn} style={{ borderBottom: i < lotPrepare.lignes.length - 1 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8' }}>{ligne.sn}</td>
                        <td style={{ padding: '6px 12px', color: '#6b7280' }}>
                          {ligne.accessoiresLabels.length > 0
                            ? ligne.accessoiresLabels.join(', ')
                            : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', fontSize: '15px', padding: '12px' }} onClick={handleValider}>
                <CheckCircle size={17} style={{ marginRight: '8px' }} />
                Valider la réception ({lotPrepare.lignes.length} produit{lotPrepare.lignes.length > 1 ? 's' : ''})
              </button>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Modal reset */}

    {showModalReset && (
      <div className="modal-overlay">
        <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Nouveau P/N sur le même BL ?</h3>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
            Voulez-vous garder les informations du BL pour saisir un autre article ?
          </p>
          <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '20px' }}>
            {bl && <div><span style={{ color: '#6b7280' }}>BL :</span> <strong>{bl}</strong></div>}
            {bt && <div><span style={{ color: '#6b7280' }}>BT :</span> <strong>{bt}</strong></div>}
            {dateCreationBL && <div><span style={{ color: '#6b7280' }}>Date création BL :</span> <strong>{new Date(dateCreationBL).toLocaleDateString('fr-FR')}</strong></div>}
            {dateReception && <div><span style={{ color: '#6b7280' }}>Date réception :</span> <strong>{new Date(dateReception).toLocaleDateString('fr-FR')}</strong></div>}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={handleResetComplet}>Non, tout vider</button>
            <button className="btn btn-primary" onClick={handleGarderBL}>Oui, garder le BL</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
