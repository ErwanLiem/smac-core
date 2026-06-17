export interface ColonneInventaire {
  key: string
  label: string
  type: 'text' | 'date'
  receptionSN?: boolean
  receptionQTE?: boolean
}

export const COLONNES_INVENTAIRE: ColonneInventaire[] = [
  { key: 'serialNumber',      label: 'N° de série',        type: 'text' },
  { key: 'partNumber',        label: 'P/N',                type: 'text',  receptionSN: true, receptionQTE: true },
  { key: 'rma',               label: 'RMA',                type: 'text',  receptionSN: true, receptionQTE: true },
  { key: 'customer',          label: 'Client',             type: 'text',  receptionSN: true, receptionQTE: true },
  { key: 'productFamily',     label: 'Famille produit',    type: 'text',  receptionSN: true },
  { key: 'mercurySn',         label: 'Mercury SN',         type: 'text' },
  { key: 'warranty',          label: 'Garantie',           type: 'text',  receptionSN: true },
  { key: 'rmaCreationDate',   label: 'Date création RMA',  type: 'date',  receptionSN: true },
  { key: 'dateRic',           label: 'Date RIC',           type: 'date',  receptionSN: true },
  { key: 'defectFromCustomer',label: 'Défaut client',      type: 'text',  receptionSN: true },
  { key: 'descrCode',         label: 'Code défaut',        type: 'text' },
  { key: 'repaireNotes',      label: 'Notes réparation',   type: 'text' },
  { key: 'genericNotes',      label: 'Notes génériques',   type: 'text',  receptionSN: true },
  { key: 'dateRip',           label: 'Date RIP',           type: 'date' },
  { key: 'techLabo',          label: 'Tech. labo',         type: 'text' },
  { key: 'livelloRiparazione',label: 'Niveau réparation',  type: 'text' },
  { key: 'dateLav',           label: 'Date LAV',           type: 'date' },
  { key: 'dateMaj',           label: 'Date MAJ',           type: 'date' },
  { key: 'dateTest',          label: 'Date TEST',          type: 'date' },
  { key: 'datePack',          label: 'Date PACK',          type: 'date' },
  { key: 'dateCls',           label: 'Date CLS',           type: 'date' },
  { key: 'dateSHP',           label: 'Date SHP',           type: 'date' },
]

export const COLONNES_DATE = COLONNES_INVENTAIRE.filter(c => c.type === 'date')

export function getLabelColonne(key: string): string {
  return COLONNES_INVENTAIRE.find(c => c.key === key)?.label ?? key
}
