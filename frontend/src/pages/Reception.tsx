import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Plus, Trash2, X } from 'lucide-react'
import { inventaireApi } from '../api/inventaire'
import { get } from '../api/client'
import { getSiteId } from '../utils/permissions'
import { jouerSonAlerte } from '../utils/sons'
import EmplacementSelect from '../components/EmplacementSelect'

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// ─── Constantes ───────────────────────────────────────────────────────────────
const CODES_PN          = ['PN', 'P_N', 'PART_NUMBER', 'PART_NO']
const CODES_DESIGNATION = ['DESIGNATION', 'DESIG', 'NOM', 'LIBELLE', 'DESCRIPTION']
const CODES_TYPE        = ['TYPE', 'TYPE_PRODUIT', 'CATEGORIE']  // articles ET inventaire
const CODES_SUIVI       = ['SUIVI', 'MODE_SUIVI', 'TRACKING']
const CODES_CLIENT      = ['CLIENT', 'CLIENTS']
const CODES_PLATEFORME  = ['PLATEFORME', 'PLATEFORMES']
const CODES_EMPLACEMENT = ['EMPLACEMENT']
const CODES_NOM         = ['NOM', 'NAME', 'LIBELLE', 'RAISON_SOCIALE']

// ─── Types ───────────────────────────────────────────────────────────────────
interface Champ {
  id: number; code: string; label: string; type: string
  options: string | null; obligatoire: boolean
  visibleReceptionSN: boolean; visibleReceptionQTE: boolean; actif: boolean
}
interface Article {
  id: number
  valeurs: { champId: number; valeur: string | null; champ: Champ }[]
}
interface Statut { id: number; label: string; couleur: string; code?: string }
interface LigneSN { sn: string; accessoires: number[]; panneClient: string }
interface LotPrepare {
  id: number; articleId: number; articleLabel: string
  modesuivi: 'SN' | 'QTE' | 'AUTRE'
  champsCommuns: Record<number, string>
  lignes: { sn: string; accessoiresIds: number[]; accessoiresLabels: string[]; panneClient: string }[]
  quantite: number; statut: string | null; statutId: number | null
  caisse: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Reception() {
  const siteId = getSiteId()
  const snInputRef = useRef<HTMLInputElement>(null)

  const [chargement, setChargement] = useState(true)
  const [champsArticles, setChampsArticles] = useState<Champ[]>([])
  const [champsInv, setChampsInv]           = useState<Champ[]>([])
  const [champsClients, setChampsClients]   = useState<Champ[]>([])
  const [champsPlateformes, setChampsPlateformes] = useState<Champ[]>([])
  const [articles, setArticles]             = useState<Article[]>([])
  const [articlesAccessoires, setArticlesAccessoires] = useState<Article[]>([])
  const [clients, setClients]               = useState<any[]>([])
  const [plateformes, setPlateformes]       = useState<any[]>([])
  const [statuts, setStatuts]               = useState<Statut[]>([])

  const [lotsEnAttente, setLotsEnAttente]   = useState<LotPrepare[]>([])
  const [erreur, setErreur]               = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const [infosValidees, setInfosValidees] = useState(false)
  const [articleId, setArticleId]         = useState<number>(0)
  const [champsCommuns, setChampsCommuns] = useState<Record<number, string>>({})
  const [lignesSN, setLignesSN]           = useState<LigneSN[]>([])
  const [snCurrent, setSnCurrent]         = useState('')
  const [caisseActive, setCaisseActive]   = useState('')
  const [quantite, setQuantite]           = useState<number>(1)
  const [alerteSN, setAlerteSN]           = useState<{ sn: string; statut: string | null; rma: string | null; contexte?: 'inventaire' | 'listeCours' | 'listeAttente' } | null>(null)

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
    setClients(cl); setPlateformes(pl); setStatuts(s)

    const champsActifs = ci.filter(c => c.actif)
    setChampsInv(champsActifs)

    // Pré-remplir DATE_TODAY
    const today = new Date().toISOString().split('T')[0]
    const preRemplis: Record<number, string> = {}
    champsActifs.forEach(c => { if (c.type === 'DATE_TODAY') preRemplis[c.id] = today })
    if (Object.keys(preRemplis).length > 0) setChampsCommuns(f => ({ ...preRemplis, ...f }))

    // Séparer articles normaux et accessoires
    const champsTypeIds = ca.filter(c => CODES_TYPE.some(code => normalize(c.code) === normalize(code))).map(c => c.id)
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

  function getEntiteLabel(entite: any, champs: Champ[]): string {
    const champNom = champs.find(c => CODES_NOM.includes(normalize(c.code)))
    const val = champNom ? entite.valeurs?.find((v: any) => v.champId === champNom.id)?.valeur : null
    return val || champs.map(c => entite.valeurs?.find((v: any) => v.champId === c.id)?.valeur).filter(Boolean)[0] || `#${entite.id}`
  }

  // ─── Mode suivi ───────────────────────────────────────────────────────────
  function getModesuivi(artId = articleId): 'SN' | 'QTE' | 'AUTRE' {
    const art = articles.find(a => a.id === artId)
    if (!art) return 'AUTRE'
    const champsSuivi = champsArticles.filter(c => CODES_SUIVI.some(code => normalize(c.code) === normalize(code)))
    const val = normalize(art.valeurs.find(v => champsSuivi.some(c => c.id === v.champId))?.valeur ?? '')
    if (val === 'SN') return 'SN'
    if (val === 'QTE') return 'QTE'
    return 'AUTRE'
  }

  function getStatutStock(): number | null {
    return statuts.find(s => normalize(s.code ?? '').includes('STOCK') || normalize(s.label).includes('STOCK'))?.id ?? null
  }

  const articleSelectionne = articles.find(a => a.id === articleId)
  const modeSuivi = getModesuivi()

  // ─── Champs visibles en réception ─────────────────────────────────────────
  const champsVisibles = champsInv.filter(c => modeSuivi === 'QTE' ? c.visibleReceptionQTE : c.visibleReceptionSN)

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
  function handlePreparer(e: React.FormEvent) {
    e.preventDefault()
    if (!articleId) return
    if (modeSuivi === 'SN' && !caisseActive) { setErreur('Veuillez saisir un numéro de caisse'); return }
    if (modeSuivi === 'SN' && lignesSN.length === 0) { setErreur('Ajoutez au moins un S/N'); return }
    if (modeSuivi === 'QTE' && quantite < 1) { setErreur('La quantité doit être supérieure à 0'); return }
    setErreur(null)

    // Assurer DATE_TODAY
    const today = new Date().toISOString().split('T')[0]
    const champsAvecDateToday = { ...champsCommuns }
    champsInv.forEach(c => { if (c.type === 'DATE_TODAY' && !champsAvecDateToday[c.id]) champsAvecDateToday[c.id] = today })

    const art = articles.find(a => a.id === articleId)!
    const statutId = modeSuivi === 'SN' ? getStatutStock() : null

    setLotsEnAttente(prev => [...prev, {
      id: Date.now(),
      articleId,
      articleLabel: getArticleLabel(art),
      modesuivi: modeSuivi,
      champsCommuns: champsAvecDateToday,
      lignes: modeSuivi === 'SN'
        ? lignesSN.map(l => ({ sn: l.sn, accessoiresIds: l.accessoires, accessoiresLabels: l.accessoires.map(id => getArticleLabelById(id)), panneClient: l.panneClient }))
        : [{ sn: '', accessoiresIds: [], accessoiresLabels: [], panneClient: '' }],
      quantite,
      statut: statuts.find(s => s.id === statutId)?.label ?? null,
      statutId,
      caisse: caisseActive || null
    }])

    // Garder l'article sélectionné et les infos communes : l'utilisateur peut
    // enchaîner une nouvelle saisie (autre quantité ou nouveaux S/N) sans tout ressaisir.
    setLignesSN([])
    setQuantite(1)
    setSnCurrent('')
    setCaisseActive('')
  }

  // ─── Valider ──────────────────────────────────────────────────────────────
  async function handleValider() {
    if (lotsEnAttente.length === 0) return
    setErreur(null)
    try {
      const idPN     = findChampId(champsInv, CODES_PN)
      const idDesig  = findChampId(champsInv, CODES_DESIGNATION)
      const idType   = findChampId(champsInv, CODES_TYPE)
      const idSN     = findChampId(champsInv, ['SN', 'S_N', 'NUMERO_SERIE', 'NUMÉRO DE SÉRIE'])
      const idAcc    = findChampId(champsInv, ['ACCESSOIRES', 'ACCESSOIRE'])
      const idPanne  = findChampId(champsInv, ['PANNE_CLIENT', 'PANNE', 'PANNE_DECLARE', 'PANNE_DECLAREE'])
      const idQte    = findChampId(champsInv, ['QUANTITE', 'QTE', 'QUANTITY'])
      const idCaisse = findChampId(champsInv, ['CAISSE'])

      const inventaireExistant: any[] = await inventaireApi.getAll(siteId)

      for (const lot of lotsEnAttente) {
        const artSource = [...articles, ...articlesAccessoires].find(a => a.id === lot.articleId)
        const pnValeur    = artSource?.valeurs.find(v => CODES_PN.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur ?? ''
        const desigValeur = artSource?.valeurs.find(v => CODES_DESIGNATION.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur ?? ''
        const typeValeur  = artSource?.valeurs.find(v => CODES_TYPE.some(c => normalize(v.champ?.code ?? '') === normalize(c)))?.valeur ?? ''

        const valeursCommunes: { champId: number; valeur: string }[] = []
        if (idPN && pnValeur)       valeursCommunes.push({ champId: idPN, valeur: pnValeur })
        if (idDesig && desigValeur) valeursCommunes.push({ champId: idDesig, valeur: desigValeur })
        if (idType && typeValeur)   valeursCommunes.push({ champId: idType, valeur: typeValeur })
        for (const [champId, valeur] of Object.entries(lot.champsCommuns)) {
          if (valeur) valeursCommunes.push({ champId: Number(champId), valeur })
        }

        if (lot.modesuivi === 'QTE') {
          const ligneExistante = inventaireExistant.find(inv => inv.articleId === lot.articleId)
          if (ligneExistante) {
            if (idQte) await inventaireApi.receptionQte(ligneExistante.id, { champId: idQte, quantite: lot.quantite })
          } else {
            const valeurs = [...valeursCommunes, ...(idQte ? [{ champId: idQte, valeur: String(lot.quantite) }] : [])]
            await inventaireApi.create(siteId, { articleId: lot.articleId, statutId: lot.statutId, valeurs })
          }
        } else {
          for (const ligne of lot.lignes) {
            const valeurs = [...valeursCommunes]
            if (idSN && ligne.sn)                            valeurs.push({ champId: idSN,    valeur: ligne.sn })
            if (idAcc && ligne.accessoiresLabels.length > 0) valeurs.push({ champId: idAcc,   valeur: ligne.accessoiresLabels.join(', ') })
            if (idPanne && ligne.panneClient)                valeurs.push({ champId: idPanne, valeur: ligne.panneClient })
            if (idCaisse && lot.caisse)                      valeurs.push({ champId: idCaisse, valeur: lot.caisse })
            await inventaireApi.create(siteId, { articleId: lot.articleId, statutId: lot.statutId, valeurs })
          }
        }
      }

      setLotsEnAttente([])
    } catch { setErreur("Erreur lors de l'enregistrement") }
  }

  async function handleConfirmerReception() {
    await handleValider()
    // Reset complet
    setArticleId(0); setChampsCommuns({}); setLignesSN([]); setSnCurrent('')
    setQuantite(1); setLotsEnAttente([]); setInfosValidees(false); setShowConfirmation(false)
  }

  function handleAnnulerConfirmation() {
    setShowConfirmation(false)
  }

  function handleValiderInfos(e: React.FormEvent) {
    e.preventDefault()
    setInfosValidees(true)
  }

  function handleModifierInfos() {
    setInfosValidees(false)
  }

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
          <form onSubmit={infosValidees ? handlePreparer : handleValiderInfos}>

            {/* ── Étape 1 : choix de l'article ── */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Article *</label>
              <select
                required
                className="form-input"
                value={articleId}
                onChange={e => {
                  const id = Number(e.target.value)
                  setArticleId(id)
                  setLignesSN([])
                  setQuantite(1)
                  setSnCurrent('')
                  // Si on revient à "— Choisir —" : reset complet
                  // Si on change juste d'article : garder les infos communes et l'état de validation
                  if (id === 0) { setInfosValidees(false); setChampsCommuns({}) }
                }}
              >
                <option value={0}>— Choisir un article —</option>
                {articles.map(a => <option key={a.id} value={a.id}>{getArticleLabel(a)}</option>)}
              </select>
            </div>

            {/* Infos article sélectionné */}
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

            {/* ── Étape 2 : champs de réception (affichés une fois l'article choisi) ── */}
            {articleId > 0 && <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0 12px' }} />}

            {articleId > 0 && champsVisibles.length === 0 && (
              <p style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '12px' }}>
                ⚠️ Aucun champ de réception configuré. Allez dans Configuration → Structure inventaire.
              </p>
            )}
            {articleId > 0 && champsVisibles.length > 0 && (infosValidees ? (
              /* Mode lecture seule */
              <div style={{ background: '#1e3a1e', border: '1px solid #86efac', borderRadius: '8px', padding: '12px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>✓ Informations validées</span>
                  <button type="button" onClick={handleModifierInfos}
                    style={{ fontSize: '12px', background: 'none', border: '1px solid #86efac', borderRadius: '4px', color: '#16a34a', cursor: 'pointer', padding: '2px 8px' }}>
                    Modifier
                  </button>
                </div>
                {champsVisibles.map(c => champsCommuns[c.id] ? (
                  <div key={c.id} style={{ display: 'flex', gap: '8px', fontSize: '12px', marginBottom: '2px' }}>
                    <span style={{ color: '#6b7280', minWidth: '100px' }}>{c.label} :</span>
                    <span style={{ fontWeight: 500 }}>{champsCommuns[c.id]}</span>
                  </div>
                ) : null)}
              </div>
            ) : (
              /* Mode saisie */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {champsVisibles.map(c => {
                  const opts = parseOptions(c.options)
                  return (
                    <div key={c.id} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{c.label} <span style={{ color: '#dc2626' }}>*</span></label>
                      {CODES_EMPLACEMENT.includes(normalize(c.code)) ? (
                        <EmplacementSelect required value={champsCommuns[c.id] ?? ''} onChange={val => setChampsCommuns(f => ({ ...f, [c.id]: val }))} />
                      ) : CODES_CLIENT.includes(normalize(c.code)) ? (
                        <select required className="form-input" value={champsCommuns[c.id] ?? ''} onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))}>
                          <option value="">— Choisir un client —</option>
                          {clients.map(cl => <option key={cl.id} value={getEntiteLabel(cl, champsClients)}>{getEntiteLabel(cl, champsClients)}</option>)}
                        </select>
                      ) : CODES_PLATEFORME.includes(normalize(c.code)) ? (
                        <select required className="form-input" value={champsCommuns[c.id] ?? ''} onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))}>
                          <option value="">— Choisir une plateforme —</option>
                          {plateformes.map(pl => <option key={pl.id} value={getEntiteLabel(pl, champsPlateformes)}>{getEntiteLabel(pl, champsPlateformes)}</option>)}
                        </select>
                      ) : c.type === 'SELECT' ? (
                        <select required className="form-input" value={champsCommuns[c.id] ?? ''} onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))}>
                          <option value="">— Choisir —</option>
                          {opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (c.type === 'DATE' || c.type === 'DATE_TODAY') ? (
                        <input type="date" required className="form-input"
                          value={champsCommuns[c.id] ?? (c.type === 'DATE_TODAY' ? new Date().toISOString().split('T')[0] : '')}
                          onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))} />
                      ) : c.type === 'NUMBER' ? (
                        <input type="number" required className="form-input" value={champsCommuns[c.id] ?? ''} onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))} />
                      ) : (
                        <input type="text" required className="form-input" value={champsCommuns[c.id] ?? ''} onChange={e => setChampsCommuns(f => ({ ...f, [c.id]: e.target.value }))} />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {articleId > 0 && <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '12px 0' }} />}

            {/* Bouton valider infos — avant validation */}
            {articleId > 0 && !infosValidees && (
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '4px' }}>
                ✓ Valider les informations
              </button>
            )}

            {/* Mode QTE — seulement si infos validées */}
            {infosValidees && articleId > 0 && modeSuivi === 'QTE' && (
              <div className="form-group">
                <label className="form-label">Quantité *</label>
                <input type="number" min={1} required className="form-input" style={{ maxWidth: '120px' }}
                  value={quantite} onChange={e => setQuantite(Number(e.target.value))} />
              </div>
            )}

            {/* Mode SN — seulement si infos validées */}
            {infosValidees && articleId > 0 && (modeSuivi === 'SN' || modeSuivi === 'AUTRE') && (
              <>
                {/* Caisse active */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 12px', background: caisseActive ? '#1c2a1c' : '#1a1d27', border: `1px solid ${caisseActive ? '#4ade80' : '#374151'}`, borderRadius: '8px' }}>
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

            {/* Sélection article + bouton préparer — seulement si infos validées */}
            {infosValidees && (
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}
                disabled={!articleId || (modeSuivi === 'SN' && lignesSN.length === 0) || (modeSuivi === 'QTE' && quantite < 1)}>
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
                        {champsInv.filter(c => lot.champsCommuns[c.id]).map(c => `${c.label} : ${lot.champsCommuns[c.id]}`).join(' · ')}
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

    {/* Modal confirmation réception */}
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
