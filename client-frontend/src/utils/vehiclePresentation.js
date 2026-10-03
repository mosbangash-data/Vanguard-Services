import { AUTOMOBILE_WHATSAPP } from '../config/contact.js'

export function formatVehiclePrice(price, currency, language, t) {
  const amount = Number(price)
  if (price == null || price === '' || !Number.isFinite(amount) || amount <= 0) {
    return t('automobilePage.priceOnRequest')
  }

  const currencyCode = currency || 'USD'
  const locale = language === 'fr' ? 'fr-FR' : 'en-US'
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(amount)
  } catch {
    return `${new Intl.NumberFormat(locale).format(amount)} ${currencyCode}`
  }
}

export function getVehicleWhatsAppHref(vehicle, t) {
  const message = t('automobilePage.whatsappMessage')
    .replace('{vehicle}', [vehicle?.brand, vehicle?.model].filter(Boolean).join(' '))
    .replace('{reference}', vehicle?.id || '')
  const phone = AUTOMOBILE_WHATSAPP.replace(/\D/g, '')
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
