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
  visibleReceptionSN: boolean
  visibleReceptionQTE: boolean
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
  code?: string
}

interface LigneSN {
  sn: string
  accessoires: number[]
}

interface LotPrepare {
  id: number
  articleId: number
  articleLabel: string
  modesuivi: 'SN' | 'QTE' | 'AUTRE'
  champsCommuns: Record<number, string>
  lignes: { sn: string; accessoiresIds: number[]; accessoiresLabels: string[] }[]
  quantite: number
  statut: string | null
  statutId: number | null
}

const CODES_PN          = ['PN', 'P_N', 'PART_NUMBER', 'PART_NO']
const CODES_DESIGNATION = ['DESIGNATION', 'DESIG', 'NOM', 'LIBELLE', 'DESCRIPTION']
const CODES_TYPE_ART    = ['TYPE', 'TYPE_PRODUIT', 'CATEGORIE']
const CODES_SUIVI       = ['SUIVI', 'MODE_SUIVI', 'TRACKING']
const CODES_TYPE_INV    = ['TYPE', 'TYPE_ARTICLE', 'TYPE_PRODUIT']
const CODES_ACCESSOIRE  = ['TYPE', 'TYPE_PRODUIT', 'CATEGORIE']

function normalize(str: string): string {
  return str.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function parseOptions(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function findChampId(champs: Champ[], codes: string[]): number | null {
  const norm = codes.map(normalize)
  const c = champs.find(ch => norm.includes(normalize(ch.code)))
  return c ? c.id : null
}

export default function Reception() {
  const siteId = getSiteId()
  const snInputRef = useRef<HTMLInputElement>(null)

  const [champsArticles, setChampsArticles] = useState<Champ[]>([])
  const [champsInv, setChampsInv] = useState<Champ[]>([])
  const [champsReception, setChampsReception] = useState<Champ[]>([])
  const [champsClients, setChampsClients] = useState<Champ[]>([])
  const [champsPlateformes, setChampsPlateformes] = useState<Champ[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesAccessoires, setArticlesAccessoires] = useState<Article[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [plateformes, setPlateformes] = useState<any[]>([])
  const [statuts, setStatuts] = useState<Statut[]>([])

  const CODES_CLIENT     = ['CLIENT', 'CLIENTS']
  const CODES_PLATEFORME = ['PLATEFORME', 'PLATEFORMES']
  const [lotsEnAttente, setLotsEnAttente] = useState<LotPrepare[]>([])
  const [valide, setValide] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [showModalReset, setShowModalReset] = useState(false)

  // Formulaire
  const [articleId, setArticleId] = useState<number>(0)
  const [champsCommuns, setChampsCommuns] = useState<Record<number, string>>({})
  const [lignesSN, setLignesSN] = useState<LigneSN[]>([])
  const [snCurrent, setSnCurrent] = useState('')
  const [quantite, setQuantite] = useState<number>(1)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [ca, ci, cc, cp, a, cl, pl, s] = await Promise.all([
      get<Champ[]>(`/articles/${siteId}/champs`),
      inventaireApi.getChamps(siteId),
      get<Champ[]>(`/clients/${siteId}/champs`),
      get<Champ[]>(`/plateformes/${siteId}/champs`),
      get<Article[]>(`/articles/${siteId}`),
      get<any[]>(`/clients/${siteId}`),
      get<any[]>(`/plateformes/${siteId}`),
      get<Statut[]>(`/workflow/${siteId}/statuts`)
    ])
    setChampsArticles(ca.filter(c => c.actif))
    setChampsClients(cc.filter(c => c.actif))
    setChampsPlateformes(cp.filter(c => c.actif))
    setClients(cl)
    setPlateformes(pl)
    setStatuts(s)

    const champsInvActifs = ci.filter(c => c.actif)
    setChampsInv(champsInvActifs)
    setChampsReception(champsInvActifs)

    // Pré-remplir les champs DATE_TODAY avec la date du jour
    const today = new Date().toISOString().split('T')[0]
    const preRemplis: Record<number, string> = {}
    champsInvActifs.forEach(c => {
      if (c.type === 'DATE_TODAY') preRemplis[c.id] = today
    })
    if (Object.keys(preRemplis).length > 0) {
      setChampsCommuns(f => ({ ...preRemplis, ...f }))
    }

    // Séparer articles normaux et accessoires
    const champsTypeIds = ca.filter(c => CODES_ACCESSOIRE.some(code => normalize(c.code) === normalize(code))).map(c => c.id)
    const acc = a.filter(art => art.valeurs.some(v => champsTypeIds.includes(v.champId) && normalize(String(v.valeur ?? '')) === 'ACCESSOIRE'))
    const normaux = a.filter(art => !art.valeurs.some(v => champsTypeIds.includes(v.champId) && normalize(String(v.valeur ?? '')) === 'ACCESSOIRE'))
    setArticles(normaux)
    setArticlesAccessoires(acc)
  }

  function getArticleLabel(art: Article): string {
    const pn = art.valeurs.find(v => CODES_PN.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur
    const desig = art.valeurs.find(v => CODES_DESIGNATION.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur
    return [pn, desig].filter(Boolean).join(' — ') || `Article #${art.id}`
  }

  function getArticleLabelById(id: number): string {
    const art = [...articles, ...articlesAccessoires].find(a => a.id === id)
    return art ? getArticleLabel(art) : `#${id}`
  }

  const CODES_NOM = ['NOM', 'NAME', 'LIBELLE', 'RAISON_SOCIALE']

  function getEntiteLabel(entite: any, champs: Champ[]): string {
    // Chercher d'abord un champ NOM
    const champNom = champs.find(c => CODES_NOM.includes(normalize(c.code)))
    if (champNom) {
      const val = entite.valeurs?.find((v: any) => v.champId === champNom.id)?.valeur
      if (val) return val
    }
    // Sinon premier champ non vide
    return champs.map(c => entite.valeurs?.find((v: any) => v.champId === c.id)?.valeur).filter(Boolean)[0] || `#${entite.id}`
  }

  function isChampClient(c: Champ): boolean {
    return CODES_CLIENT.includes(normalize(c.code))
  }

  function isChampPlateforme(c: Champ): boolean {
    return CODES_PLATEFORME.includes(normalize(c.code))
  }

  function getModesuivi(artId = articleId): 'SN' | 'QTE' | 'AUTRE' {
    const art = articles.find(a => a.id === artId)
    if (!art) return 'AUTRE'
    const champsSuivi = champsArticles.filter(c => CODES_SUIVI.some(code => normalize(c.code) === normalize(code)))
    const val = art.valeurs.find(v => champsSuivi.some(c => c.id === v.champId))?.valeur
    if (!val) return 'AUTRE'
    const norm = normalize(val)
    if (norm === 'SN') return 'SN'
    if (norm === 'QTE') return 'QTE'
    return 'AUTRE'
  }

  function getStatutStock(): number | null {
    const s = statuts.find(s => normalize(s.code ?? '') === normalize('EN_STOCK') || normalize(s.label).includes('STOCK'))
    return s ? s.id : null
  }

  const articleSelectionne = articles.find(a => a.id === articleId)
  const modeSuivi = getModesuivi()

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

  function handlePreparer(e: React.FormEvent) {
    e.preventDefault()
    if (!articleId) return
    if (modeSuivi === 'SN' && lignesSN.length === 0) { setErreur('Ajoutez au moins un S/N'); return }
    if (modeSuivi === 'QTE' && quantite < 1) { setErreur('La quantité doit être supérieure à 0'); return }
    setErreur(null)

    const art = articles.find(a => a.id === articleId)!
    const statutId = modeSuivi === 'SN' ? getStatutStock() : null
    const statutLabel = statuts.find(s => s.id === statutId)?.label ?? null

    const lignes = modeSuivi === 'SN'
      ? lignesSN.map(l => ({ sn: l.sn, accessoiresIds: l.accessoires, accessoiresLabels: l.accessoires.map(id => getArticleLabelById(id)) }))
      : [{ sn: '', accessoiresIds: [], accessoiresLabels: [] }]

    setLotsEnAttente(prev => [...prev, {
      id: Date.now(),
      articleId,
      articleLabel: getArticleLabel(art),
      modesuivi: modeSuivi,
      champsCommuns: { ...champsCommuns },
      lignes,
      quantite,
      statut: statutLabel,
      statutId
    }])

    // Reset article et S/N, garde les champs communs
    setArticleId(0)
    setLignesSN([])
    setSnCurrent('')
    setQuantite(1)
  }

  async function handleValider() {
    if (lotsEnAttente.length === 0) return
    setErreur(null)
    try {
      const idPN      = findChampId(champsInv, CODES_PN)
      const idDesig   = findChampId(champsInv, CODES_DESIGNATION)
      const idTypeInv = findChampId(champsInv, CODES_TYPE_INV)
      const idSN      = findChampId(champsInv, ['SN', 'S_N', 'NUMERO_SERIE', 'NUMÉRO DE SÉRIE'])
      const idAcc     = findChampId(champsInv, ['ACCESSOIRES', 'ACCESSOIRE'])
      const idQte     = findChampId(champsInv, ['QUANTITE', 'QTE', 'QUANTITY'])

      const inventaireExistant: any[] = await inventaireApi.getAll(siteId)

      for (const lot of lotsEnAttente) {
        const artSource = [...articles, ...articlesAccessoires].find(a => a.id === lot.articleId)
        const pnValeur    = artSource?.valeurs.find(v => CODES_PN.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur ?? ''
        const desigValeur = artSource?.valeurs.find(v => CODES_DESIGNATION.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur ?? ''
        const typeValeur  = artSource?.valeurs.find(v => CODES_TYPE_ART.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur ?? ''

        // Champs communs de réception
        const valeursCommunes: { champId: number; valeur: string }[] = []
        if (idPN && pnValeur)      valeursCommunes.push({ champId: idPN, valeur: pnValeur })
        if (idDesig && desigValeur) valeursCommunes.push({ champId: idDesig, valeur: desigValeur })
        if (idTypeInv && typeValeur) valeursCommunes.push({ champId: idTypeInv, valeur: typeValeur })
        // Champs configurés visibles à la réception
        for (const [champId, valeur] of Object.entries(lot.champsCommuns)) {
          if (valeur) valeursCommunes.push({ champId: Number(champId), valeur })
        }

        if (lot.modesuivi === 'QTE') {
          const ligneExistante = inventaireExistant.find(inv => inv.articleId === lot.articleId)
          const nouvelleQte = lot.quantite

          if (ligneExistante) {
            const qteActuelle = Number(ligneExistante.valeurs.find((v: any) => v.champId === idQte)?.valeur ?? 0)
            const valeurs = ligneExistante.valeurs
              .filter((v: any) => v.champId !== idQte)
              .map((v: any) => ({ champId: v.champId, valeur: v.valeur ?? '' }))
            if (idQte) valeurs.push({ champId: idQte, valeur: String(qteActuelle + nouvelleQte) })
            await inventaireApi.update(ligneExistante.id, { statutId: ligneExistante.statutId, valeurs })
          } else {
            const valeurs = [...valeursCommunes]
            if (idQte) valeurs.push({ champId: idQte, valeur: String(nouvelleQte) })
            await inventaireApi.create(siteId, { articleId: lot.articleId, statutId: lot.statutId, valeurs })
          }
        } else {
          for (const ligne of lot.lignes) {
            const valeurs = [...valeursCommunes]
            if (idSN && ligne.sn) valeurs.push({ champId: idSN, valeur: ligne.sn })
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
      setErreur("Erreur lors de l'enregistrement")
    }
  }

  function handleGarderChamps() {
    setArticleId(0)
    setLignesSN([])
    setSnCurrent('')
    setQuantite(1)
    setShowModalReset(false)
  }

  function handleResetComplet() {
    setArticleId(0)
    setChampsCommuns({})
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

            {/* Article */}
            <div className="form-group">
              <label className="form-label">Article *</label>
              <select required className="form-input" value={articleId}
                onChange={e => { setArticleId(Number(e.target.value)); setLignesSN([]); setQuantite(1) }}>
                <option value={0}>— Choisir un article —</option>
                {articles.map(a => (
                  <option key={a.id} value={a.id}>{getArticleLabel(a)}</option>
                ))}
              </select>
            </div>

            {/* Infos article */}
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
                {modeSuivi === 'SN' && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '12px' }}>
                    <CheckCircle size={13} />
                    <span>Suivi par S/N — statut : <strong>{statuts.find(s => s.id === getStatutStock())?.label ?? '⚠️ statut stock introuvable'}</strong></span>
                  </div>
                )}
                {modeSuivi === 'QTE' && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
                    📦 Suivi par quantité
                  </div>
                )}
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0 12px' }} />

            {/* Champs configurés visibles à la réception — uniquement après sélection article */}
            {articleId > 0 && (() => {
              const champsVisibles = champsReception.filter(c =>
                modeSuivi === 'QTE' ? c.visibleReceptionQTE : c.visibleReceptionSN
              )
              return champsVisibles.length === 0 ? (
              <p style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '12px' }}>
                ⚠️ Aucun champ de réception configuré. Allez dans Configuration → Structure inventaire.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {champsVisibles.map(c => {
                  const opts = Array.isArray(parseOptions(c.options)) ? parseOptions(c.options) : []
                  return (
                    <div key={c.id} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        {c.label} <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      {isChampClient(c) ? (
                        <select required className="form-input"
                          value={champsCommuns[c.id] ?? ''}
                          onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))}>
                          <option value="">— Choisir un client —</option>
                          {clients.map(cl => (
                            <option key={cl.id} value={getEntiteLabel(cl, champsClients)}>
                              {getEntiteLabel(cl, champsClients)}
                            </option>
                          ))}
                        </select>
                      ) : isChampPlateforme(c) ? (
                        <select required className="form-input"
                          value={champsCommuns[c.id] ?? ''}
                          onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))}>
                          <option value="">— Choisir une plateforme —</option>
                          {plateformes.map(pl => (
                            <option key={pl.id} value={getEntiteLabel(pl, champsPlateformes)}>
                              {getEntiteLabel(pl, champsPlateformes)}
                            </option>
                          ))}
                        </select>
                      ) : c.type === 'SELECT' ? (
                        <select required className="form-input"
                          value={champsCommuns[c.id] ?? ''}
                          onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))}>
                          <option value="">— Choisir —</option>
                          {opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (c.type === 'DATE' || c.type === 'DATE_TODAY') ? (
                        <input type="date" required className="form-input"
                          value={champsCommuns[c.id] ?? (c.type === 'DATE_TODAY' ? new Date().toISOString().split('T')[0] : '')}
                          onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))} />
                      ) : c.type === 'NUMBER' ? (
                        <input type="number" required className="form-input"
                          value={champsCommuns[c.id] ?? ''}
                          onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))} />
                      ) : (
                        <input type="text" required className="form-input"
                          value={champsCommuns[c.id] ?? ''}
                          onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))} />
                      )}
                    </div>
                  )
                })}
              </div>
            )})()}

            {articleId > 0 && <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '12px 0' }} />}

            {/* Mode QTE */}
            {articleId > 0 && modeSuivi === 'QTE' && (
              <div className="form-group">
                <label className="form-label">Quantité *</label>
                <input type="number" min={1} required className="form-input" style={{ maxWidth: '120px' }}
                  value={quantite} onChange={e => setQuantite(Number(e.target.value))} />
              </div>
            )}

            {/* Mode SN */}
            {articleId > 0 && (modeSuivi === 'SN' || modeSuivi === 'AUTRE') && (
              <>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label">Saisie S/N <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Entrée pour ajouter)</span></label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input ref={snInputRef} className="form-input"
                      placeholder="Scanner ou saisir un S/N..."
                      value={snCurrent}
                      onChange={e => setSnCurrent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSN() } }} />
                    <button type="button" className="btn btn-secondary btn-icon" onClick={addSN}><Plus size={16} /></button>
                  </div>
                </div>

                {lignesSN.length > 0 && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
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
                          <th style={{ borderBottom: '1px solid #bfdbfe', width: '32px' }}></th>
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
              </>
            )}

            {erreur && (
              <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '13px', marginBottom: '10px' }}>
                {erreur}
              </div>
            )}

            {articleId > 0 && <button type="submit" className="btn btn-primary" style={{ width: '100%' }}
              disabled={!articleId || (modeSuivi === 'SN' && lignesSN.length === 0) || (modeSuivi === 'QTE' && quantite < 1)}>
              Préparer {modeSuivi === 'QTE' ? `(${quantite} unité${quantite > 1 ? 's' : ''})` : lignesSN.length > 0 ? `(${lignesSN.length} S/N)` : ''}
            </button>}
          </form>
        </div>

        {/* Panneau de droite */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
              À valider — {lotsEnAttente.length} lot{lotsEnAttente.length !== 1 ? 's' : ''}
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
                <div key={lot.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden' }}>
                  <div style={{ background: '#f8faff', padding: '10px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{lot.articleLabel}</span>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {champsReception.map(c => lot.champsCommuns[c.id] ? `${c.label} : ${lot.champsCommuns[c.id]}` : null).filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', padding: '2px 8px' }}>
                        {lot.modesuivi === 'QTE' ? `${lot.quantite} unité${lot.quantite > 1 ? 's' : ''}` : `${lot.lignes.length} S/N`}
                      </span>
                      <button onClick={() => setLotsEnAttente(prev => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  {lot.modesuivi !== 'QTE' && lot.lignes.length > 0 && (
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
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Continuer la réception ?</h3>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
            Voulez-vous garder les informations communes pour continuer à saisir ?
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={handleResetComplet}>Non, tout vider</button>
            <button className="btn btn-primary" onClick={handleGarderChamps}>Oui, continuer</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
