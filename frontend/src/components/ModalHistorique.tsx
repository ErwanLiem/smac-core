import { useEffect, useState } from 'react'
import { X, Clock } from 'lucide-react'
import { get } from '../api/client'

interface HistoriqueEntry {
  id: number
  type: string
  createdAt: string
  details: { label?: string; couleur?: string; commentaire?: string } | null
  operateur: { login: string; nom: string; prenom: string } | null
}

const LABELS: Record<string, string> = {
  RECEPTION:         'Réception',
  TRANSFERT:         'Transfert',
  MODIFICATION:      'Modification',
  SUPPRESSION:       'Suppression',
  CREATION:          'Création',
  TRANSITION_STATUT: 'Changement de statut',
}

interface Props {
  inventaireId: number
  titre?: string
  onClose: () => void
}

export default function ModalHistorique({ inventaireId, titre, onClose }: Props) {
  const [entries, setEntries] = useState<HistoriqueEntry[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    get<HistoriqueEntry[]>(`/inventaire/${inventaireId}/historique`)
      .then(data => setEntries(data))
      .finally(() => setChargement(false))
  }, [inventaireId])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1d27', borderRadius: '12px', width: '620px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={16} style={{ color: '#6b7280' }} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
              {titre ?? `Historique #${inventaireId}`}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {chargement ? (
            <div className="loading-container" style={{ minHeight: '120px' }}><div className="loading-spinner" /></div>
          ) : entries.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '32px' }}>Aucun mouvement enregistré.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {entries.map((h, i) => {
                const couleur = h.details?.couleur ?? '#6b7280'
                const label   = h.details?.label ?? LABELS[h.type] ?? h.type
                const operateur = h.operateur
                  ? `${h.operateur.prenom} ${h.operateur.nom} (${h.operateur.login})`
                  : null
                return (
                  <div key={h.id} style={{ display: 'flex', gap: '12px', paddingBottom: '16px', position: 'relative' }}>
                    {i < entries.length - 1 && (
                      <div style={{ position: 'absolute', left: '8px', top: '18px', bottom: '0', width: '1px', background: '#1f2937' }} />
                    )}
                    <div style={{ flexShrink: 0, width: '17px', height: '17px', borderRadius: '50%', background: couleur + '30', border: `2px solid ${couleur}`, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {h.type === 'TRANSITION_STATUT' && label.includes(' → ') ? (() => {
                        const [avant, apres] = label.split(' → ')
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151' }}>{avant}</span>
                            <span style={{ color: '#4b5563', fontSize: '13px' }}>→</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: couleur + '1F', color: couleur, border: `1px solid ${couleur}44` }}>{apres}</span>
                          </div>
                        )
                      })() : (
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{label}</div>
                      )}
                      {h.details?.commentaire && (
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px', fontStyle: 'italic' }}>
                          {h.details.commentaire}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>
                          {new Date(h.createdAt).toLocaleString('fr-FR')}
                        </span>
                        {operateur && (
                          <span style={{ fontSize: '11px', color: '#4b5563' }}>· {operateur}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
