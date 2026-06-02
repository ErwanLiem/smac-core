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
  lignes: { sn: string; accessoiresIds: number[]; accessoiresLabels: string[]; quantite?: number }[]
}

const CODES = {
  BL:           ['BL', 'RMA', 'BON_LIVRAISON', 'BON_DE_LIVRAISON'],
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
const CODES_TYPE_INV    = ['TYPE', 'TYPE_ARTICLE', 'TYPE_PRODUIT']

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
  const [quantite, setQuantite] = useState<number>(1)

  // Lots en attente de validation (tableau de droite)
  const [lotsEnAttente, setLotsEnAttente] = useState<LotPrepare[]>([])

  const [showModalReset, setShowModalReset] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [valide, setValide] = useState(false)

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

  function getTypeArticle(artId = articleId): string {
    const art = articles.find(a => a.id === artId)
    if (!art) return ''
    const champsTypeIds = champsArticles.filter(c => CODES_TYPE.includes(c.code.toUpperCase())).map(c => c.id)
    return art.valeurs.find(v => champsTypeIds.includes(v.champId))?.valeur?.toUpperCase() ?? ''
  }

  function isTPE(artId = articleId): boolean {
    return getTypeArticle(artId) === 'TPE'
  }

  function isPDA(artId = articleId): boolean {
    return getTypeArticle(artId) === 'PDA'
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
    if (isPDA()) {
      if (quantite < 1) { setErreur('La quantité doit être supérieure à 0'); return }
    } else {
      if (lignesSN.length === 0) { setErreur('Ajoutez au moins un S/N'); return }
    }
    setErreur(null)

    const art = articles.find(a => a.id === articleId)!
    const stockId = isTPE() ? getStatutStock() : null
    const statutLabel = statuts.find(s => s.id === stockId)?.label ?? null
    const typeValeur = getTypeArticle()

    const lignes = isPDA()
      ? [{ sn: '', accessoiresIds: [], accessoiresLabels: [], quantite }]
      : lignesSN.map(l => ({
          sn: l.sn,
          accessoiresIds: l.accessoires,
          accessoiresLabels: l.accessoires.map(id => getArticleLabelById(id)),
          quantite: 1
        }))

    const nouveauLot: LotPrepare = {
      articleId,
      articleLabel: getArticleLabel(art),
      bl, bt, dateCreationBL, dateReception, garantie,
      statut: statutLabel,
      statutId: stockId,
      lignes
    }

    setLotsEnAttente(prev => [...prev, nouveauLot])

    // Reset article et S/N mais garde BL/BT/dates
    setArticleId(0)
    setLignesSN([])
    setSnCurrent('')
    setQuantite(1)
  }

  // Étape 2 : Valider → envoie en BDD
  async function handleValider() {
    if (lotsEnAttente.length === 0) return
    setErreur(null)
    try {
      const idBL       = findChampId(champsInv, CODES.BL)
      const idBT       = findChampId(champsInv, CODES.BT)
      const idRMA      = findChampId(champsInv, CODES.RMA_CREATION)
      const idRIC      = findChampId(champsInv, CODES.DATE_RIC)
      const idGarantie = findChampId(champsInv, CODES.GARANTIE)
      const idSN       = findChampId(champsInv, CODES.SN)
      const idAcc      = findChampId(champsInv, CODES.ACCESSOIRES)
      const idPN       = findChampId(champsInv, CODES_PN)
      const idDesig    = findChampId(champsInv, CODES_DESIGNATION)
      const idQte      = findChampId(champsInv, ['QUANTITE', 'QTE', 'QUANTITY'])
      const idTypeInv  = findChampId(champsInv, CODES_TYPE_INV)

      // Charger l'inventaire existant pour trouver les lignes PDA à mettre à jour
      const inventaireExistant: any[] = await inventaireApi.getAll(siteId)

      for (const lot of lotsEnAttente) {
        const artSource   = [...articles, ...articlesAccessoires].find(a => a.id === lot.articleId)
        const pnValeur    = artSource?.valeurs.find(v => CODES_PN.includes(normalize(v.champ?.code ?? '')))?.valeur ?? ''
        const desigValeur = artSource?.valeurs.find(v => CODES_DESIGNATION.includes(normalize(v.champ?.code ?? '')))?.valeur ?? ''
        const typeValeur  = getTypeArticle(lot.articleId)
        const isPDALot    = isPDA(lot.articleId)

        if (isPDALot) {
          // Chercher une ligne existante pour cet article
          const ligneExistante = inventaireExistant.find(inv => inv.articleId === lot.articleId)
          const nouvelleQte = lot.lignes[0]?.quantite ?? 1

          if (ligneExistante) {
            // Additionner à la quantité existante
            const qteActuelle = Number(ligneExistante.valeurs.find((v: any) => v.champId === idQte)?.valeur ?? 0)
            const valeurs: { champId: number; valeur: string }[] = []

            // Reprendre toutes les valeurs existantes sauf quantité
            for (const v of ligneExistante.valeurs) {
              if (v.champId !== idQte) valeurs.push({ champId: v.champId, valeur: v.valeur ?? '' })
            }
            if (idQte) valeurs.push({ champId: idQte, valeur: String(qteActuelle + nouvelleQte) })

            await inventaireApi.update(ligneExistante.id, { statutId: ligneExistante.statutId, valeurs })
          } else {
            // Créer une nouvelle ligne
            const valeurs: { champId: number; valeur: string }[] = []
            if (idPN && pnValeur)        valeurs.push({ champId: idPN, valeur: pnValeur })
            if (idDesig && desigValeur)  valeurs.push({ champId: idDesig, valeur: desigValeur })
            if (idTypeInv && typeValeur) valeurs.push({ champId: idTypeInv, valeur: typeValeur })
            if (idBL && lot.bl)          valeurs.push({ champId: idBL, valeur: lot.bl })
            if (idBT && lot.bt)          valeurs.push({ champId: idBT, valeur: lot.bt })
            if (idQte)                   valeurs.push({ champId: idQte, valeur: String(nouvelleQte) })
            await inventaireApi.create(siteId, { articleId: lot.articleId, statutId: lot.statutId, valeurs })
          }
        } else {
          // TPE / autre : créer une ligne par S/N
          for (const ligne of lot.lignes) {
            const valeurs: { champId: number; valeur: string }[] = []
            if (idPN && pnValeur)              valeurs.push({ champId: idPN, valeur: pnValeur })
            if (idDesig && desigValeur)        valeurs.push({ champId: idDesig, valeur: desigValeur })
            if (idTypeInv && typeValeur)       valeurs.push({ champId: idTypeInv, valeur: typeValeur })
            if (idBL && lot.bl)               valeurs.push({ champId: idBL, valeur: lot.bl })
            if (idBT && lot.bt)               valeurs.push({ champId: idBT, valeur: lot.bt })
            if (idRMA && lot.dateCreationBL)  valeurs.push({ champId: idRMA, valeur: lot.dateCreationBL })
            if (idRIC && lot.dateReception)   valeurs.push({ champId: idRIC, valeur: lot.dateReception })
            if (idGarantie && lot.garantie)   valeurs.push({ champId: idGarantie, valeur: lot.garantie })
            if (idSN && ligne.sn)             valeurs.push({ champId: idSN, valeur: ligne.sn })
            if (idAcc && ligne.accessoiresLabels.length > 0)
              valeurs.push({ champId: idAcc, valeur: ligne.accessoiresLabels.join(', ') })
            await inventaireApi.create(siteId, { articleId: lot.articleId, statutId: lot.statutId, valeurs })
          }
        }
      }

      setLotsEnAttente([])
      setValide(true)
      setTimeout(() => setValide(false), 3000)
      setShowModalReset(true)
    } catch {
      setErreur('Erreur lors de l\'enregistrement')
    }
  }

  function handleGarderBL() {
    setArticleId(0)
    setGarantie('')
    setLignesSN([])
    setSnCurrent('')
    setQuantite(1)
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
    setQuantite(1)
    setLotsEnAttente([])
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
                <label className="form-label">Date réception</label>
                <input type="date" className="form-input" value={dateReception} onChange={e => setDateReception(e.target.value)} />
              </div>
              {!isPDA() && (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Date création BL</label>
                    <input type="date" className="form-input" value={dateCreationBL} onChange={e => setDateCreationBL(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                    <label className="form-label">Garantie</label>
                    <select className="form-input" value={garantie} onChange={e => setGarantie(e.target.value)}>
                      <option value="">— Choisir —</option>
                      <option value="Garantie">Garantie</option>
                      <option value="Hors garantie">Hors garantie</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '12px 0' }} />

            {isPDA() ? (
              <div className="form-group">
                <label className="form-label">Quantité *</label>
                <input type="number" min={1} required className="form-input" style={{ maxWidth: '120px' }}
                  value={quantite} onChange={e => setQuantite(Number(e.target.value))} />
              </div>
            ) : (
              <>
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
              </>
            )}

            {/* Tableau S/N compact */}
            {!isPDA() && lignesSN.length > 0 && (
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

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}
              disabled={isPDA() ? quantite < 1 : lignesSN.length === 0}>
              Préparer la réception {isPDA() ? `(${quantite} unité${quantite > 1 ? 's' : ''})` : lignesSN.length > 0 ? `(${lignesSN.length} S/N)` : ''}
            </button>
          </form>
        </div>

        {/* Panneau de droite — liste cumulative + validation */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
              À valider — {lotsEnAttente.reduce((acc, l) => acc + (isPDA(l.articleId) ? (l.lignes[0]?.quantite ?? 0) : l.lignes.length), 0)} produit{lotsEnAttente.reduce((acc, l) => acc + l.lignes.length, 0) !== 1 ? 's' : ''}
            </h2>
            {lotsEnAttente.length > 0 && (
              <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => setLotsEnAttente([])}>
                <Trash2 size={13} /> Vider
              </button>
            )}
          </div>

          {valide && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', color: '#16a34a', fontSize: '14px', marginBottom: '16px' }}>
              <CheckCircle size={18} /> Réception validée et enregistrée dans l'inventaire !
            </div>
          )}

          {lotsEnAttente.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '48px 0' }}>
              Préparez des articles pour les voir apparaître ici
            </p>
          ) : (
            <>
              {lotsEnAttente.map((lot, idx) => (
                <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden' }}>
                  <div style={{ background: '#f8faff', padding: '10px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{lot.articleLabel}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '10px' }}>
                        {lot.bl && `BL : ${lot.bl}`}{lot.bt && ` · BT : ${lot.bt}`}
                        {lot.dateReception && ` · ${new Date(lot.dateReception).toLocaleDateString('fr-FR')}`}
                        {lot.garantie && ` · ${lot.garantie}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', padding: '2px 8px' }}>
                        {isPDA(lot.articleId) ? `${lot.lignes[0]?.quantite} unité${(lot.lignes[0]?.quantite ?? 0) > 1 ? 's' : ''}` : `${lot.lignes.length} S/N`}
                      </span>
                      <button onClick={() => setLotsEnAttente(prev => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  {!isPDA(lot.articleId) && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <tbody>
                        {lot.lignes.map((l, i) => (
                          <tr key={l.sn} style={{ borderBottom: i < lot.lignes.length - 1 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '4px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8' }}>{l.sn}</td>
                            <td style={{ padding: '4px 14px', color: '#6b7280' }}>
                              {l.accessoiresLabels.length > 0 ? l.accessoiresLabels.join(', ') : <span style={{ color: '#d1d5db' }}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}

              {erreur && (
                <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '13px', marginBottom: '10px' }}>
                  {erreur}
                </div>
              )}

              <button className="btn btn-primary" style={{ width: '100%', fontSize: '15px', padding: '12px' }} onClick={handleValider}>
                <CheckCircle size={17} style={{ marginRight: '8px' }} />
                Valider la réception
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
