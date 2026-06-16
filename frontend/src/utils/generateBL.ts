export interface ConfigSite {
  nomSociete: string
  adresse: string
  ville: string
  codePostal: string
  pays: string
  tel: string
  email: string
  siteWeb: string
  tva: string
  capitalSocial: string
}

export interface PlateformeAdresse {
  nom: string
  adresse: string
  codePostal: string
  ville: string
  pays: string
  tel: string
  mail: string
  contact: string
}

export interface ArticleBL {
  pn: string
  sn: string
  designation: string
  model: string
}

export interface ColisBL {
  type: string
  longueur: string
  largeur: string
  hauteur: string
  poids: string
}

export function genererHTMLBL(params: {
  numero: string
  bonTransport: string
  date: string
  eta: string
  expediteur: ConfigSite
  destinataire: PlateformeAdresse
  articles: ArticleBL[]
  colis: ColisBL[]
}): string {
  const { numero, bonTransport, date, eta, expediteur, destinataire, articles, colis } = params

  const lignes = articles.map((a, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="font-family:monospace">${esc(a.pn)}</td>
      <td>${esc(a.designation)}${a.model ? ` — ${esc(a.model)}` : ''}</td>
      <td style="font-family:monospace;font-size:10px">${esc(a.sn)}</td>
      <td style="text-align:center">1</td>
    </tr>`).join('')

  const totalQte = articles.length

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Delivery Note ${esc(numero)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; padding: 15mm 20mm; }
    h1 { font-size: 22px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #000; padding-bottom: 16px; }
    .company-name { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .company-info { font-size: 10px; line-height: 1.6; color: #333; }
    .doc-meta { text-align: right; }
    .doc-meta table { margin-left: auto; border-collapse: collapse; }
    .doc-meta td { padding: 2px 6px; }
    .doc-meta td:first-child { font-weight: 600; color: #444; }
    .addresses { display: flex; gap: 24px; margin-bottom: 24px; }
    .address-box { flex: 1; border: 1px solid #aaa; border-radius: 4px; padding: 10px 14px; }
    .address-box .label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 6px; }
    .address-box .name { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
    .address-box .line { font-size: 10px; line-height: 1.6; color: #333; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    table.items th { background: #1a1a2e; color: #fff; padding: 7px 10px; font-size: 10px; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
    table.items td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    table.items tr:nth-child(even) td { background: #f9fafb; }
    .totals { text-align: right; margin-bottom: 24px; font-size: 11px; }
    .totals strong { font-size: 13px; }
    .signatures { display: flex; gap: 40px; margin-top: 40px; }
    .sig-box { flex: 1; border-top: 1px solid #000; padding-top: 8px; font-size: 10px; color: #555; }
    .footer-legal { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 9px; color: #888; line-height: 1.5; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm 20mm; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="company-name">${esc(expediteur.nomSociete)}</div>
      <div class="company-info">
        ${esc(expediteur.adresse)}<br>
        ${esc(expediteur.codePostal)} ${esc(expediteur.ville)}<br>
        ${esc(expediteur.pays)}<br>
        ${expediteur.tel ? `Tel: ${esc(expediteur.tel)}<br>` : ''}
        ${expediteur.email ? `Email: ${esc(expediteur.email)}<br>` : ''}
        ${expediteur.siteWeb ? `Web: ${esc(expediteur.siteWeb)}<br>` : ''}
        ${expediteur.tva ? `VAT: ${esc(expediteur.tva)}` : ''}
      </div>
    </div>
    <div class="doc-meta">
      <h1>Delivery Note</h1>
      <table>
        <tr><td>Number:</td><td><strong>${esc(numero)}</strong></td></tr>
        <tr><td>Date:</td><td>${esc(date)}</td></tr>
        <tr><td>Transport Ref:</td><td>${esc(bonTransport) || '—'}</td></tr>
        ${eta ? `<tr><td>ETA:</td><td>${esc(eta)}</td></tr>` : ''}
        <tr><td>Total Qty:</td><td><strong>${totalQte}</strong></td></tr>
      </table>
    </div>
  </div>

  <div class="addresses">
    <div class="address-box">
      <div class="label">Ship From</div>
      <div class="name">${esc(expediteur.nomSociete)}</div>
      <div class="line">
        ${esc(expediteur.adresse)}<br>
        ${esc(expediteur.codePostal)} ${esc(expediteur.ville)}<br>
        ${esc(expediteur.pays)}
      </div>
    </div>
    <div class="address-box">
      <div class="label">Ship To</div>
      <div class="name">${esc(destinataire.nom)}</div>
      <div class="line">
        ${destinataire.contact ? `Attn: ${esc(destinataire.contact)}<br>` : ''}
        ${esc(destinataire.adresse)}<br>
        ${esc(destinataire.codePostal)} ${esc(destinataire.ville)}<br>
        ${esc(destinataire.pays)}<br>
        ${destinataire.tel ? `Tel: ${esc(destinataire.tel)}<br>` : ''}
        ${destinataire.mail ? `Email: ${esc(destinataire.mail)}` : ''}
      </div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:36px;text-align:center">#</th>
        <th style="width:160px">Part Number</th>
        <th>Description</th>
        <th style="width:200px">Serial Number</th>
        <th style="width:40px;text-align:center">Qty</th>
      </tr>
    </thead>
    <tbody>
      ${lignes}
    </tbody>
  </table>

  <div class="totals">
    Total items dispatched: <strong>${totalQte}</strong>
  </div>

  ${colis.length > 0 ? (() => {
    const poidsTotal = colis.reduce((sum, c) => sum + (parseFloat(c.poids) || 0), 0)
    const poidsTotalStr = poidsTotal > 0 ? poidsTotal.toFixed(2).replace(/\.?0+$/, '') : null
    return `
  <div style="margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;color:#444">Packaging</div>
    <table class="items">
      <thead>
        <tr>
          <th style="width:100px">Type</th>
          <th style="width:180px">Dimensions (L × l × H cm)</th>
          <th style="width:100px">Weight (kg)</th>
        </tr>
      </thead>
      <tbody>
        ${colis.map(c => `
        <tr>
          <td>${esc(c.type)}</td>
          <td>${[c.longueur, c.largeur, c.hauteur].filter(Boolean).join(' × ') || '—'}</td>
          <td>${esc(c.poids) || '—'}</td>
        </tr>`).join('')}
        ${poidsTotalStr ? `
        <tr style="border-top:2px solid #000">
          <td colspan="2" style="text-align:right;font-weight:700">Total weight</td>
          <td style="font-weight:700">${poidsTotalStr} kg</td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>`
  })() : ''}

  <div class="signatures">
    <div class="sig-box">
      Issued by: ___________________________<br>
      <br>Date: ___________________________
    </div>
    <div class="sig-box">
      Received by: ___________________________<br>
      <br>Date: ___________________________
    </div>
  </div>

  ${expediteur.capitalSocial || expediteur.tva ? `
  <div class="footer-legal">
    ${expediteur.nomSociete}
    ${expediteur.capitalSocial ? ` — Capital: ${esc(expediteur.capitalSocial)}` : ''}
    ${expediteur.tva ? ` — VAT: ${esc(expediteur.tva)}` : ''}
  </div>` : ''}

  <script>window.onload = () => window.print()</script>
</body>
</html>`
}

function esc(str: string | null | undefined): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
