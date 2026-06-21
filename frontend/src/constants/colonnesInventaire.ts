export interface ColonneInventaire {
  key: string
  label: string
  type: 'text' | 'date'
  receptionSN?: boolean
  receptionQTE?: boolean
}

export const COLONNES_INVENTAIRE: ColonneInventaire[] = [
  // Ordre calqué sur le fichier Excel client
  { key: 'serialNumber',       label: 'N° de série',        type: 'text' },
  { key: 'rma',                label: 'RMA',                type: 'text',  receptionSN: true, receptionQTE: true },
  { key: 'warranty',           label: 'Garantie',           type: 'text',  receptionSN: true },
  { key: 'techLabo',           label: 'Tech. labo',         type: 'text' },
  { key: 'rmaCreationDate',    label: 'Date création RMA',  type: 'date',  receptionSN: true },
  { key: 'dateRic',            label: 'Date RIC',           type: 'date',  receptionSN: true },
  { key: 'dateLav',            label: 'Date LAV',           type: 'date' },
  { key: 'dateAsp',            label: 'Date ASP',           type: 'date' },
  { key: 'dateLab',            label: 'Date LAB',           type: 'date' },
  { key: 'datePrv',            label: 'Date PRV',           type: 'date' },
  { key: 'datePrr',            label: 'Date PRR',           type: 'date' },
  { key: 'datePrf',            label: 'Date PRF',           type: 'date' },
  { key: 'datePra',            label: 'Date PRA',           type: 'date' },
  { key: 'dateEng',            label: 'Date ENG',           type: 'date' },
  { key: 'dateAsw',            label: 'Date ASW',           type: 'date' },
  { key: 'dateRip',            label: 'Date RIP',           type: 'date' },
  { key: 'dateTest',           label: 'Date TEST',          type: 'date' },
  { key: 'dateMaj',            label: 'Date MAJ',           type: 'date' },
  { key: 'dateInjection',      label: 'Date Injection',     type: 'date' },
  { key: 'datePack',           label: 'Date PACK',          type: 'date' },
  { key: 'dateCls',            label: 'Date CLS',           type: 'date' },
  { key: 'dateBsf',            label: 'Date BSF',           type: 'date' },
  { key: 'dateBsfn',           label: 'Date BSFN',          type: 'date' },
  { key: 'dateNlv',            label: 'Date NLV',           type: 'date' },
  { key: 'dateSHP',            label: 'Date SHP',           type: 'date' },
  { key: 'bt',                 label: 'BT',                 type: 'text',  receptionSN: true },
  { key: 'caisse',             label: 'Caisse',             type: 'text',  receptionSN: true },
  { key: 'emplacementNom',    label: 'Emplacement',        type: 'text' },
  { key: 'genericNotes',      label: 'Notes génériques',   type: 'text',  receptionSN: true },
  { key: 'livelloRiparazione', label: 'Niveau réparation',  type: 'text' },
  { key: 'codeStatut',         label: 'Code Statut',        type: 'text' },
  { key: 'customer',           label: 'Client',             type: 'text',  receptionSN: true, receptionQTE: true },
  { key: 'partNumber',         label: 'P/N',                type: 'text',  receptionSN: true, receptionQTE: true },
  { key: 'productFamily',      label: 'Famille produit',    type: 'text',  receptionSN: true },
  { key: 'mercurySn',          label: 'Mercury SN',         type: 'text' },
  { key: 'defectFromCustomer',  label: 'Défaut client',             type: 'text',  receptionSN: true },
  { key: 'defectCodeCastles',   label: 'Defect code by Castles',    type: 'text' },
  { key: 'descrCode',           label: 'Descr. Code',               type: 'text' },
  { key: 'repaireNotes',       label: 'Notes réparation',   type: 'text' },
]

export const COLONNES_DATE = COLONNES_INVENTAIRE.filter(c => c.type === 'date')

export function getLabelColonne(key: string): string {
  return COLONNES_INVENTAIRE.find(c => c.key === key)?.label ?? key
}
