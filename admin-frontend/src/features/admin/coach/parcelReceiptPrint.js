const FORMATS = ['a4', '58mm', '80mm', '110mm']

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])

export function openParcelReceiptPrintWindow() {
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('The print window was blocked')
  printWindow.opener = null
  return printWindow
}

export function renderParcelReceiptPrintWindow(printWindow, data, format, language = 'fr', translate = (value) => value) {
  const normalizedFormat = String(format || '').toLowerCase()
  if (!FORMATS.includes(normalizedFormat)) throw new Error('Invalid parcel receipt format')
  if (!data?.trackingCode) throw new Error('Parcel receipt data is missing')

  const paper = normalizedFormat === 'a4'
    ? { page: 'A4 portrait', margin: '12mm', width: '186mm', font: '12px' }
    : { page: `${normalizedFormat} auto`, margin: '0', width: `calc(${normalizedFormat} - 4mm)`, font: normalizedFormat === '58mm' ? '10px' : '12px' }
  const paid = data.paymentStatus === 'PAID'
  const statusLabels = {
    REGISTERED: translate('agentParcel.receiptRegistered'),
    PAYMENT_PENDING: translate('agentParcel.receiptPaymentPending'),
    PAID: translate('agentParcel.receiptPaid'),
    ACCEPTED: translate('agentParcel.receiptAccepted'),
    IN_TRANSIT: translate('agentParcel.receiptInTransit'),
    ARRIVED_AT_AGENCY: translate('agentParcel.receiptArrived'),
    READY_FOR_PICKUP: translate('agentParcel.receiptReady'),
    COLLECTED: translate('agentParcel.receiptCollected'),
    DELIVERED: translate('agentParcel.receiptCollected'),
    RETURNED: translate('agentParcel.receiptReturned'),
    CANCELLED: translate('agentParcel.receiptCancelled'),
  }
  const dateLocale = language === 'en' ? 'en-US' : 'fr-FR'
  const createdAt = data.createdAt ? new Date(data.createdAt).toLocaleString(dateLocale) : '—'
  const labels = {
    created: translate('agentParcel.receiptCreated'),
    sender: translate('agentParcel.senderSection'),
    recipient: translate('agentParcel.recipientSection'),
    amount: translate('agentParcel.totalToPay'),
    financial: translate('agentParcel.paymentSection'),
    paid: translate('agentParcel.paymentPaid'),
    due: translate('agentParcel.paymentDueAtPickup'),
    logistics: translate('agentParcel.receiptLogistics'),
    origin: translate('agentParcel.receiptOrigin'),
    destination: translate('agentParcel.receiptDestination'),
  }
  const image = data.qrDataUrl
    ? `<img class="qr" src="${escapeHtml(data.qrDataUrl)}" alt="QR ${escapeHtml(data.trackingCode)}">`
    : ''
  const html = `<!doctype html><html lang="${language === 'en' ? 'en' : 'fr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.trackingCode)}</title><style>
    @page{size:${paper.page};margin:${paper.margin}}
    *{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;color:#111;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:${paper.font};line-height:1.35}
    .receipt{width:${paper.width};max-width:100%;margin:0 auto;padding:3mm;overflow-wrap:anywhere;word-break:normal}
    header{text-align:center;border-bottom:1px dashed #555;padding-bottom:3mm;margin-bottom:3mm}
    h1{font-size:1.4em;margin:0 0 1mm;letter-spacing:.03em}header p{margin:1mm 0}
    .code{text-align:center;font-weight:700;font-size:1.35em;letter-spacing:.04em;margin:4mm 0;overflow-wrap:anywhere}
    .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:2mm;margin:2.2mm 0;align-items:start}
    .row span{color:#333}.row strong{text-align:right;overflow-wrap:anywhere}
    .total{border-top:1px solid #222;padding-top:2.5mm;font-size:1.2em;font-weight:700}
    .qr-wrap{text-align:center;margin:4mm auto 1mm;break-inside:avoid}.qr{display:block;width:28mm;height:28mm;max-width:100%;object-fit:contain;margin:auto}.foot{text-align:center;font-size:.85em;margin-top:2mm}
    @media print{html,body{width:100%;margin:0;padding:0}.receipt{break-inside:avoid}img{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><article class="receipt"><header><h1>VANGUARD SERVICES</h1><p>${escapeHtml(labels.origin)} : ${escapeHtml(data.origin)}</p><p>${escapeHtml(labels.destination)} : ${escapeHtml(data.destination)}</p></header>
    <p class="code">${escapeHtml(data.trackingCode)}</p><div class="row"><span>${escapeHtml(labels.created)}</span><strong>${escapeHtml(createdAt)}</strong></div>
    <div class="row"><span>${escapeHtml(labels.sender)}</span><strong>${escapeHtml(data.senderName)}<br>${escapeHtml(data.senderPhone)}</strong></div>
    <div class="row"><span>${escapeHtml(labels.recipient)}</span><strong>${escapeHtml(data.recipientName)}<br>${escapeHtml(data.recipientPhone)}</strong></div>
    <div class="row total"><span>${escapeHtml(labels.amount)}</span><strong>${escapeHtml(data.amount)} ${escapeHtml(data.currency)}</strong></div>
    <div class="row"><span>${escapeHtml(labels.financial)}</span><strong>${escapeHtml(paid ? labels.paid : labels.due)}</strong></div>
    <div class="row"><span>${escapeHtml(labels.logistics)}</span><strong>${escapeHtml(statusLabels[data.status] || data.status || '—')}</strong></div>
    <div class="qr-wrap">${image}</div><p class="foot">${escapeHtml(data.trackingCode)}</p></article></body></html>`

  printWindow.addEventListener('load', () => {
    printWindow.focus()
    printWindow.print()
  }, { once: true })
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}

export function printParcelReceipt(data, format, language = 'fr', translate = (value) => value) {
  const printWindow = openParcelReceiptPrintWindow()
  renderParcelReceiptPrintWindow(printWindow, data, format, language, translate)
}

export const PARCEL_RECEIPT_FORMATS = FORMATS
