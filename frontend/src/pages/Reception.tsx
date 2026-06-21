import { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCircle, Plus, Trash2, X } from 'lucide-react'
import { inventaireApi } from '../api/inventaire'
import { get, post } from '../api/client'
import { getSiteId } from '../utils/permissions'
import { jouerSonAlerte } from '../utils/sons'
import { COLONNES_INVENTAIRE } from '../constants/colonnesInventaire'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalize(str: string): string {
  return str.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const CODES_PN          = ['PN', 'P_N', 'PART_NUMBER', 'PART_NO']
const CODES_DESIGNATION = ['DESIGNATION', 'DESIG', 'NOM', 'LIBELLE', 'DESCRIPTION']
const CODES_TYPE        = ['TYPE', 'TYPE_PRODUIT', 'CATEGORIE']
const CODES_SUIVI       = ['SUIVI', 'MODE_SUIVI', 'TRACKING']

// Fallback hardcodé pour réception SN (si config site pas encore renseignée)
const CHAMPS_RECEPTION_SN_DEFAULT = COLONNES_INVENTAIRE.filter(c => c.receptionSN && c.key !== 'serialNumber')

// ─── Types ───────────────────────────────────────────────────────────────────
interface ChampArticle {
  id: number; code: string; label: string; type: string; actif: boolean
}
interface Article {
  id: number
  valeurs: { champId: number; valeur: string | null; champ: ChampArticle }[]
}
interface Statut { id: number; label: string; couleur: string; code?: string }
interface Plateforme {
  id: number
  valeurs: { valeur: string | null; champ: { code: string; label: string } }[]
}
interface Emplacement { id: number; nom: string; capaciteMax: number; remplissage: number }
interface LigneSN { sn: string; accessoires: number[]; panneClient: string }
interface LotPrepare {
  id: number; articleId: number; articleLabel: string
  modesuivi: 'SN' | 'QTE' | 'AUTRE'
  champsCommuns: Record<string, string>
  lignes: { sn: string; accessoiresIds: number[]; accessoiresLabels: string[]; panneClient: string }[]
  quantite: number; statut: string | null; statutId: number | null
  caisse: string | null
  emplacementId: number | null
  // Champs dédiés réception QTE
  blQTE: string; plateformeIdQTE: number; commentaireQTE: string
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Reception() {
  const siteId = getSiteId()
  const snInputRef      = useRef<HTMLInputElement>(null)
  const searchRef       = useRef<HTMLDivElement>(null)
  const [articleSearch, setArticleSearch]             = useState('')
  const [articleDropdownOpen, setArticleDropdownOpen] = useState(false)
  const [articleDropdownIndex, setArticleDropdownIndex] = useState(0)

  const [chargement, setChargement] = useState(true)
  const [champsArticles, setChampsArticles] = useState<ChampArticle[]>([])
  const [articles, setArticles]             = useState<Article[]>([])
  const [articlesAccessoires, setArticlesAccessoires] = useState<Article[]>([])
  const [statuts, setStatuts]               = useState<Statut[]>([])

  const [configReceptionSN, setConfigReceptionSN] = useState<string[] | null>(null)
  const [plateformes, setPlateformes] = useState<Plateforme[]>([])

  // Champs spécifiques réception QTE
  const [blQTE,           setBlQTE]           = useState('')
  const [plateformeIdQTE, setPlateformeIdQTE] = useState<number>(0)
  const [commentaireQTE,  setCommentaireQTE]  = useState('')

  const [lotsEnAttente, setLotsEnAttente]   = useState<LotPrepare[]>([])
  const [erreur, setErreur]               = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const [infosValidees, setInfosValidees] = useState(false)
  const [articleId, setArticleId]         = useState<number>(0)
  const [champsCommuns, setChampsCommuns] = useState<Record<string, string>>({})
  const [lignesSN, setLignesSN]           = useState<LigneSN[]>([])
  const [snCurrent, setSnCurrent]         = useState('')
  const [caisseActive, setCaisseActive]   = useState('')
  const [emplacementId, setEmplacementId] = useState<number>(0)
  const [emplacements, setEmplacements]   = useState<Emplacement[]>([])
  const [quantite, setQuantite]           = useState<number>(1)
  const [alerteSN, setAlerteSN]           = useState<{ sn: string; statut: string | null; rma: string | null; contexte?: 'inventaire' | 'listeCours' | 'listeAttente' } | null>(null)

  useEffect(() => { reload() }, [siteId])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setArticleDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const articlesFiltrés = useCallback(() => {
    const q = articleSearch.toLowerCase().trim()
    if (!q) return articles.slice(0, 60)
    return articles.filter(a => getArticleLabel(a).toLowerCase().includes(q)).slice(0, 60)
  }, [articleSearch, articles])

  async function reload() {
    const [ca, a, s, cfg, plats, emps] = await Promise.all([
      get<ChampArticle[]>(`/articles/${siteId}/champs`),
      get<Article[]>(`/articles/${siteId}`),
      get<Statut[]>(`/workflow/${siteId}/statuts`),
      get<{ champsReceptionSN: string[] | null }>(`/production/config/${siteId}`),
      get<Plateforme[]>(`/plateformes/${siteId}`),
      get<Emplacement[]>(`/emplacements/${siteId}`)
    ])
    setConfigReceptionSN(cfg.champsReceptionSN)
    setPlateformes(plats)
    setEmplacements(emps)
    setChampsArticles(ca.filter(c => c.actif))
    setStatuts(s)

    const champsTypeIds = ca.filter(c => ['TYPE', 'TYPE_PRODUIT', 'CATEGORIE'].some(code => normalize(c.code) === code)).map(c => c.id)
    const estAccessoire = (art: Article) => art.valeurs.some(v => champsTypeIds.includes(v.champId) && normalize(String(v.valeur ?? '')) === 'ACCESSOIRE')
    setArticlesAccessoires(a.filter(estAccessoire))
    setArticles(a.filter(art => !estAccessoire(art)))
    setChargement(false)
  }

  // ─── Labels ───────────────────────────────────────────────────────────────
  function getArticleLabel(art: Article): string {
    const pn    = art.valeurs.find(v => CODES_PN.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur
    const desig = art.valeurs.find(v => CODES_DESIGNATION.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur
    return [pn, desig].filter(Boolean).join(' — ') || `Article #${art.id}`
  }

  function getArticleLabelById(id: number): string {
    const art = [...articles, ...articlesAccessoires].find(a => a.id === id)
    return art ? getArticleLabel(art) : `#${id}`
  }

  // ─── Mode suivi ───────────────────────────────────────────────────────────
  function getModesuivi(artId = articleId): 'SN' | 'QTE' | 'AUTRE' {
    const art = articles.find(a => a.id === artId)
    if (!art) return 'AUTRE'

    // Priorité 1 : champ SUIVI explicite
    const champsSuivi = champsArticles.filter(c => CODES_SUIVI.some(code => normalize(c.code) === normalize(code)))
    const val = normalize(art.valeurs.find(v => champsSuivi.some(c => c.id === v.champId))?.valeur ?? '')
    if (val === 'SN') return 'SN'
    if (val === 'QTE') return 'QTE'

    // Fallback : champ TYPE — PDA → QTE, TPE → SN
    const champsType = champsArticles.filter(c => CODES_TYPE.some(code => normalize(c.code) === normalize(code)))
    const typeVal = normalize(art.valeurs.find(v => champsType.some(c => c.id === v.champId))?.valeur ?? '')
    if (typeVal === 'PDA') return 'QTE'
    if (typeVal === 'TPE') return 'SN'

    return 'AUTRE'
  }

  function getPlatLabel(p: Plateforme): string {
    return p.valeurs.find(v => v.valeur)?.valeur ?? `Plateforme #${p.id}`
  }

  function getStatutStock(): number | null {
    return statuts.find(s => normalize(s.code ?? '').includes('STOCK') || normalize(s.label).includes('STOCK'))?.id ?? null
  }

  const articleSelectionne = articles.find(a => a.id === articleId)
  const modeSuivi = getModesuivi()

  const champsSN = configReceptionSN
    ? COLONNES_INVENTAIRE.filter(c => configReceptionSN.includes(c.key) && c.key !== 'serialNumber')
    : CHAMPS_RECEPTION_SN_DEFAULT
  const champsVisibles = champsSN // QTE a son propre formulaire dédié

  // ─── S/N ──────────────────────────────────────────────────────────────────
  async function addSN() {
    const sn = snCurrent.trim()
    if (!sn) return

    if (!caisseActive) {
      setErreur('Veuillez saisir un numéro de caisse avant de scanner un S/N')
      return
    }

    if (lignesSN.some(l => l.sn === sn)) {
      jouerSonAlerte()
      setAlerteSN({ sn, statut: null, rma: null, contexte: 'listeCours' })
      setSnCurrent('')
      return
    }

    if (lotsEnAttente.some(lot => lot.lignes.some(l => l.sn === sn))) {
      jouerSonAlerte()
      setAlerteSN({ sn, statut: null, rma: null, contexte: 'listeAttente' })
      setSnCurrent('')
      return
    }

    try {
      const check = await get<any>(`/inventaire/${siteId}/check-sn/${encodeURIComponent(sn)}`)
      if (check.existe && !check.estFinal) {
        jouerSonAlerte()
        setAlerteSN({ sn, statut: check.statut, rma: check.rma, contexte: 'inventaire' })
        setSnCurrent('')
        return
      }
    } catch {}
    setLignesSN(prev => [...prev, { sn, accessoires: [], panneClient: '' }])
    setSnCurrent('')
    snInputRef.current?.focus()
  }

  function removeSN(sn: string) { setLignesSN(prev => prev.filter(l => l.sn !== sn)) }

  function toggleAccessoire(sn: string, accId: number) {
    setLignesSN(prev => prev.map(l => {
      if (l.sn !== sn) return l
      const has = l.accessoires.includes(accId)
      return { ...l, accessoires: has ? l.accessoires.filter(id => id !== accId) : [...l.accessoires, accId] }
    }))
  }

  function updatePanneClient(sn: string, val: string) {
    setLignesSN(prev => prev.map(l => l.sn === sn ? { ...l, panneClient: val } : l))
  }

  // ─── Préparer ─────────────────────────────────────────────────────────────
  async function handlePreparer(e: React.FormEvent) {
    e.preventDefault()
    if (!articleId) return
    if (modeSuivi === 'SN' && !caisseActive) { setErreur('Veuillez saisir un numéro de caisse'); return }
    // Flush du SN en cours si l'utilisateur clique sans presser Entrée
    if (modeSuivi === 'SN' && snCurrent.trim()) await addSN()
    if (modeSuivi === 'SN' && lignesSN.length === 0) { setErreur('Ajoutez au moins un S/N'); return }
    if (modeSuivi === 'QTE' && quantite < 1) { setErreur('La quantité doit être supérieure à 0'); return }
    setErreur(null)

    const art = articles.find(a => a.id === articleId)!
    const statutId = modeSuivi === 'SN' ? getStatutStock() : null

    setLotsEnAttente(prev => [...prev, {
      id: Date.now(),
      articleId,
      articleLabel: getArticleLabel(art),
      modesuivi: modeSuivi,
      champsCommuns,
      lignes: modeSuivi === 'SN'
        ? lignesSN.map(l => ({ sn: l.sn, accessoiresIds: l.accessoires, accessoiresLabels: l.accessoires.map(id => getArticleLabelById(id)), panneClient: l.panneClient }))
        : [{ sn: '', accessoiresIds: [], accessoiresLabels: [], panneClient: '' }],
      quantite,
      statut: statuts.find(s => s.id === statutId)?.label ?? null,
      statutId,
      caisse: caisseActive || null,
      emplacementId: emplacementId || null,
      blQTE, plateformeIdQTE, commentaireQTE,
    }])

    // Toujours : reset article + quantité + champs SN
    setArticleId(0); setArticleSearch(''); setInfosValidees(false); setChampsCommuns({})
    setLignesSN([]); setQuantite(1); setSnCurrent(''); setCaisseActive(''); setEmplacementId(0)
    // BL / Plateforme / Commentaire : conservés pour saisie en série
  }

  // ─── Valider ──────────────────────────────────────────────────────────────
  async function handleValider() {
    if (lotsEnAttente.length === 0) return
    setErreur(null)
    try {
      for (const lot of lotsEnAttente) {
        const artSource = [...articles, ...articlesAccessoires].find(a => a.id === lot.articleId)

        // Extraire les valeurs de l'article (PN, désignation) depuis les champs articles
        const pnValeur = artSource?.valeurs.find(v => CODES_PN.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur ?? ''

        // Champs communs du formulaire (champsCommuns keyed par nom de colonne)
        const baseData: Record<string, any> = {
          articleId: lot.articleId,
          statutId: lot.statutId,
          partNumber: pnValeur || lot.champsCommuns.partNumber || null,
        }

        // Merge les champs communs (tous sauf partNumber déjà géré)
        for (const [key, val] of Object.entries(lot.champsCommuns)) {
          if (key !== 'partNumber' && val) baseData[key] = val
        }

        if (lot.modesuivi === 'QTE') {
          await post(`/production/mouvement-qte/${siteId}`, {
            articleId:   lot.articleId,
            type:        'RECEPTION',
            quantite:    lot.quantite,
            bl:          lot.blQTE          || null,
            plateformeId: lot.plateformeIdQTE || null,
            commentaire: lot.commentaireQTE  || null,
          })
        } else {
          for (const ligne of lot.lignes) {
            const lineData: Record<string, any> = { ...baseData, serialNumber: ligne.sn || null }
            if (ligne.panneClient) lineData.defectFromCustomer = ligne.panneClient
            if (lot.caisse) lineData.caisse = lot.caisse
            if (lot.emplacementId) lineData.emplacementId = lot.emplacementId
            if (ligne.accessoiresLabels.length > 0) lineData.genericNotes = ligne.accessoiresLabels.join(', ')
            await inventaireApi.create(siteId, lineData)
          }
        }
      }

      setLotsEnAttente([])
    } catch { setErreur("Erreur lors de l'enregistrement") }
  }

  async function handleConfirmerReception() {
    await handleValider()
    setArticleId(0); setChampsCommuns({}); setLignesSN([]); setSnCurrent('')
    setQuantite(1); setLotsEnAttente([]); setInfosValidees(false); setShowConfirmation(false)
    setBlQTE(''); setPlateformeIdQTE(0); setCommentaireQTE('')
  }

  function handleAnnulerConfirmation() { setShowConfirmation(false) }

  function handleValiderInfos(e: React.FormEvent) {
    e.preventDefault()
    setInfosValidees(true)
  }

  function handleModifierInfos() { setInfosValidees(false) }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Réception</h1>
          <p className="page-subtitle">Saisie des produits réceptionnés</p>
        </div>
      </div>

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Formulaire gauche ── */}
        <div className="card">
          <form onSubmit={(modeSuivi === 'QTE' || infosValidees) ? handlePreparer : handleValiderInfos}>

            {/* Article */}
            <div className="form-group" style={{ marginBottom: '12px' }} ref={searchRef}>
              <label className="form-label">Article *</label>

              {/* Article sélectionné → affichage + bouton clear */}
              {articleId > 0 && !articleDropdownOpen ? (
                <div className="form-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getArticleLabelById(articleId)}
                  </span>
                  <button type="button"
                    onClick={() => { setArticleId(0); setArticleSearch(''); setInfosValidees(false); setChampsCommuns({}); setLignesSN([]); setQuantite(1); setSnCurrent('') }}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0 }}>
                    ×
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    placeholder="Rechercher par désignation, P/N…"
                    value={articleSearch}
                    autoComplete="off"
                    onChange={e => { setArticleSearch(e.target.value); setArticleDropdownOpen(true); setArticleDropdownIndex(0) }}
                    onFocus={() => setArticleDropdownOpen(true)}
                    onKeyDown={e => {
                      const liste = articlesFiltrés()
                      if (e.key === 'ArrowDown') { e.preventDefault(); setArticleDropdownIndex(i => Math.min(i + 1, liste.length - 1)) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setArticleDropdownIndex(i => Math.max(i - 1, 0)) }
                      else if (e.key === 'Enter') {
                        e.preventDefault()
                        const a = liste[articleDropdownIndex] ?? liste[0]
                        if (a) { setArticleId(a.id); setArticleSearch(''); setArticleDropdownOpen(false); setLignesSN([]); setQuantite(1); setSnCurrent(''); setInfosValidees(false); setChampsCommuns({}) }
                      } else if (e.key === 'Escape') { setArticleDropdownOpen(false) }
                    }}
                  />
                  {articleDropdownOpen && (
                    <div style={{
                      position: 'absolute', zIndex: 100, top: 'calc(100% + 4px)', left: 0, right: 0,
                      background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '8px',
                      maxHeight: '260px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                    }}>
                      {articlesFiltrés().length === 0 ? (
                        <div style={{ padding: '12px 14px', color: '#6b7280', fontSize: '13px' }}>Aucun article trouvé</div>
                      ) : articlesFiltrés().map((a, idx) => (
                        <div key={a.id}
                          onMouseDown={() => {
                            setArticleId(a.id); setArticleSearch(''); setArticleDropdownOpen(false)
                            setLignesSN([]); setQuantite(1); setSnCurrent(''); setInfosValidees(false); setChampsCommuns({})
                          }}
                          style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #1e2130', background: idx === articleDropdownIndex ? '#1e2130' : 'transparent' }}
                          onMouseEnter={() => setArticleDropdownIndex(idx)}>
                          {getArticleLabel(a)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Infos article */}
            {articleSelectionne && (
              <div style={{ background: '#141720', border: '1px solid #2d3148', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px' }}>
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
                {modeSuivi === 'QTE' && <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>📦 Suivi par quantité</div>}
              </div>
            )}

            {articleId > 0 && <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0 12px' }} />}

            {/* ── Formulaire QTE dédié (PDA / Accessoires) ── */}
            {(modeSuivi === 'QTE' || blQTE || plateformeIdQTE > 0 || commentaireQTE) && (
              <>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label">BL</label>
                  <input type="text" className="form-input" placeholder="N° bon de livraison…"
                    value={blQTE} onChange={e => setBlQTE(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }} />
                </div>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label">Plateforme</label>
                  <select className="form-input" value={plateformeIdQTE}
                    onChange={e => setPlateformeIdQTE(Number(e.target.value))}>
                    <option value={0}>— Choisir —</option>
                    {plateformes.map(p => (
                      <option key={p.id} value={p.id}>{getPlatLabel(p)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label">Commentaire</label>
                  <input type="text" className="form-input" placeholder="Optionnel"
                    value={commentaireQTE} onChange={e => setCommentaireQTE(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }} />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Quantité *</label>
                  <input type="number" min={1} required className="form-input" style={{ maxWidth: '120px' }}
                    value={quantite} onChange={e => setQuantite(Number(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }} />
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0 0 12px' }} />
              </>
            )}

            {/* ── Champs communs SN (réception classique) ── */}
            {articleId > 0 && modeSuivi !== 'QTE' && champsVisibles.length > 0 && (infosValidees ? (
              <div style={{ background: '#1e3a1e', border: '1px solid #86efac', borderRadius: '8px', padding: '12px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>✓ Informations validées</span>
                  <button type="button" onClick={handleModifierInfos}
                    style={{ fontSize: '12px', background: 'none', border: '1px solid #86efac', borderRadius: '4px', color: '#16a34a', cursor: 'pointer', padding: '2px 8px' }}>
                    Modifier
                  </button>
                </div>
                {champsVisibles.map(c => champsCommuns[c.key] ? (
                  <div key={c.key} style={{ display: 'flex', gap: '8px', fontSize: '12px', marginBottom: '2px' }}>
                    <span style={{ color: '#6b7280', minWidth: '100px' }}>{c.label} :</span>
                    <span style={{ fontWeight: 500 }}>{champsCommuns[c.key]}</span>
                  </div>
                ) : null)}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {champsVisibles.map(c => (
                  <div key={c.key} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{c.label}</label>
                    {c.type === 'date' ? (
                      <input type="date" className="form-input"
                        value={champsCommuns[c.key] ?? ''}
                        onChange={e => setChampsCommuns(f => ({ ...f, [c.key]: e.target.value }))} />
                    ) : (
                      <input type="text" className="form-input"
                        value={champsCommuns[c.key] ?? ''}
                        onChange={e => setChampsCommuns(f => ({ ...f, [c.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
            ))}

            {articleId > 0 && modeSuivi !== 'QTE' && <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '12px 0' }} />}

            {/* Bouton valider infos (SN uniquement) */}
            {articleId > 0 && modeSuivi !== 'QTE' && !infosValidees && (
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '4px' }}>
                ✓ Valider les informations
              </button>
            )}

            {/* SN */}
            {infosValidees && articleId > 0 && (modeSuivi === 'SN' || modeSuivi === 'AUTRE') && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '8px 12px', background: caisseActive ? '#1c2a1c' : '#1a1d27', border: `1px solid ${caisseActive ? '#4ade80' : '#374151'}`, borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>📦 Caisse <span style={{ color: '#dc2626' }}>*</span> :</span>
                  <input
                    className="form-input"
                    placeholder="Scanner ou saisir le n° de caisse..."
                    value={caisseActive}
                    onChange={e => setCaisseActive(e.target.value.trim())}
                    style={{ flex: 1, padding: '4px 8px', fontSize: '13px', fontWeight: caisseActive ? 700 : 400, color: caisseActive ? '#4ade80' : '#9ca3af', background: 'transparent', border: 'none', outline: 'none' }}
                  />
                  {caisseActive && (
                    <button type="button" onClick={() => setCaisseActive('')}
                      style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>×</button>
                  )}
                </div>

                {emplacements.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 12px', background: emplacementId ? '#1c2838' : '#1a1d27', border: `1px solid ${emplacementId ? '#60a5fa' : '#374151'}`, borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>📍 Emplacement :</span>
                    <select
                      value={emplacementId}
                      onChange={e => setEmplacementId(Number(e.target.value))}
                      style={{ flex: 1, padding: '4px 8px', fontSize: '13px', fontWeight: emplacementId ? 700 : 400, color: emplacementId ? '#60a5fa' : '#9ca3af', background: 'transparent', border: 'none', outline: 'none' }}
                    >
                      <option value={0}>— Choisir un emplacement —</option>
                      {emplacements.map(e => (
                        <option key={e.id} value={e.id}>{e.nom} ({e.remplissage}/{e.capaciteMax})</option>
                      ))}
                    </select>
                    {emplacementId > 0 && (
                      <button type="button" onClick={() => setEmplacementId(0)}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>×</button>
                    )}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label className="form-label">Saisie S/N <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Entrée pour ajouter)</span></label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input ref={snInputRef} className="form-input" placeholder="Scanner ou saisir un S/N..."
                      value={snCurrent} onChange={e => setSnCurrent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSN() } }} />
                    <button type="button" className="btn btn-secondary btn-icon" onClick={addSN}><Plus size={16} /></button>
                  </div>
                </div>
                {lignesSN.length > 0 && (
                  <div style={{ border: '1px solid #2d3148', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
                    <table className="table">
                      <thead>
                        <tr style={{ background: '#1e3a5f' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', color: '#2563eb', fontWeight: 600, borderBottom: '1px solid #bfdbfe' }}>S/N ({lignesSN.length})</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', color: '#2563eb', fontWeight: 600, borderBottom: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>Panne client</th>
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
                          <tr key={l.sn} style={{ borderBottom: i < lignesSN.length - 1 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? '#1a1d27' : '#141720' }}>
                            <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8' }}>{l.sn}</td>
                            <td style={{ padding: '3px 6px' }}>
                              <input className="form-input" placeholder="Panne déclarée..."
                                value={l.panneClient} onChange={e => updatePanneClient(l.sn, e.target.value)}
                                style={{ fontSize: '12px', padding: '3px 6px', minWidth: '120px' }} />
                            </td>
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

            {(infosValidees || modeSuivi === 'QTE' || blQTE || plateformeIdQTE > 0 || commentaireQTE) && (
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}
                disabled={!articleId || (modeSuivi === 'SN' && (!caisseActive || lignesSN.length === 0)) || (modeSuivi === 'QTE' && quantite < 1)}>
                Préparer {modeSuivi === 'QTE' ? `(${quantite} unité${quantite > 1 ? 's' : ''})` : lignesSN.length > 0 ? `(${lignesSN.length} S/N)` : ''}
              </button>
            )}
          </form>
        </div>

        {/* ── Panneau de droite ── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
              À valider — {lotsEnAttente.length} lot{lotsEnAttente.length !== 1 ? 's' : ''}
            </h2>
            {lotsEnAttente.length > 0 && (
              <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => setLotsEnAttente([])}>
                <Trash2 size={13} /> Vider
              </button>
            )}
          </div>

          {lotsEnAttente.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '48px 0' }}>
              Préparez des articles pour les voir apparaître ici
            </p>
          ) : (
            <>
              {lotsEnAttente.map((lot, idx) => (
                <div key={lot.id} style={{ border: '1px solid #2d3148', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden' }}>
                  <div style={{ background: '#141720', padding: '10px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{lot.articleLabel}</span>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {champsSN.filter(c => lot.champsCommuns[c.key]).map(c => `${c.label} : ${lot.champsCommuns[c.key]}`).join(' · ')}
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
                    <table className="table">
                      <tbody>
                        {lot.lignes.map((l, i) => (
                          <tr key={l.sn} style={{ borderBottom: i < lot.lignes.length - 1 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? '#1a1d27' : '#141720' }}>
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
              <button className="btn btn-primary" style={{ width: '100%', fontSize: '15px', padding: '12px' }} onClick={() => setShowConfirmation(true)}>
                <CheckCircle size={17} style={{ marginRight: '8px' }} />
                Valider la réception
              </button>
            </>
          )}
        </div>
      </div>
      )}
    </div>

    {/* Modal alerte S/N doublon */}
    {alerteSN && (
      <div className="modal-overlay" onClick={() => { setAlerteSN(null); snInputRef.current?.focus() }}>
        <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center', border: '3px solid #dc2626' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>
            {alerteSN.contexte === 'listeCours'    ? 'S/N déjà en cours de saisie !'
            : alerteSN.contexte === 'listeAttente' ? 'S/N déjà préparé !'
            : 'S/N déjà en inventaire !'}
          </h3>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
            {alerteSN.contexte === 'listeCours'    ? 'Ce S/N est déjà dans la liste en cours de saisie.'
            : alerteSN.contexte === 'listeAttente' ? 'Ce S/N est déjà dans un lot en attente de validation.'
            : 'Ce S/N est actuellement en cours de traitement dans l\'inventaire.'}
          </p>
          <code style={{ display: 'block', background: '#fee2e2', color: '#dc2626', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>
            {alerteSN.sn}
          </code>
          {alerteSN.statut && <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Statut actuel : <strong>{alerteSN.statut}</strong></p>}
          {alerteSN.rma && <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>RMA : <strong>{alerteSN.rma}</strong></p>}
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>Ce S/N n'a pas été ajouté à la réception en cours.</p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setAlerteSN(null); snInputRef.current?.focus() }}>
            OK — Continuer
          </button>
        </div>
      </div>
    )}

    {/* Modal confirmation */}
    {showConfirmation && (
      <div className="modal-overlay">
        <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la réception en stock ?</h3>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
            <strong>{lotsEnAttente.reduce((acc, l) => acc + (l.modesuivi === 'QTE' ? l.quantite : l.lignes.length), 0)} produit{lotsEnAttente.reduce((acc, l) => acc + l.lignes.length, 0) !== 1 ? 's' : ''}</strong> vont être enregistrés dans l'inventaire.
          </p>
          <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
            Si vous confirmez, tous les formulaires seront vidés.
          </p>
          {erreur && <div style={{ padding: '8px', background: '#fee2e2', borderRadius: '6px', color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{erreur}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={handleAnnulerConfirmation}>Non, continuer la saisie</button>
            <button className="btn btn-primary" onClick={handleConfirmerReception}>
              <CheckCircle size={15} style={{ marginRight: '6px' }} /> Oui, confirmer
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
