import { api } from '../../../services/api'

export async function printTicket(ticketCode, format = '80mm') {
  const printWindow = window.open('about:blank', '_blank')
  if (!printWindow) throw new Error('POPUP_BLOCKED')
  printWindow.opener = null
  try {
    const response = await api.get(`/api/tickets/${encodeURIComponent(ticketCode)}/print`, {
      params: { format },
      responseType: 'text',
    })
    const origin = window.location.origin
    const html = String(response.data).replace(/(href|src)="\/([^"]*)"/g, `$1="${origin}/$2"`)
    const objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    printWindow.location.replace(objectUrl)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    printWindow.close()
    throw error
  }
}
