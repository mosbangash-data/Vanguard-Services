import test from 'node:test'
import assert from 'node:assert/strict'
import { AUTOMOBILE_WHATSAPP } from '../src/config/contact.js'
import { translations } from '../src/i18n/translations.js'
import { formatVehiclePrice, getVehicleWhatsAppHref } from '../src/utils/vehiclePresentation.js'

const translate = (language) => (key) => key.split('.').reduce((value, part) => value?.[part], translations[language]) || key

test('formats configured vehicle currency in French and English', () => {
  assert.equal(formatVehiclePrice('12500.50', 'USD', 'fr', translate('fr')), '12\u202f500,50\u00a0$US')
  assert.equal(formatVehiclePrice('12500.50', 'USD', 'en', translate('en')), '$12,500.50')
})

test('uses translated request pricing for missing, zero, or invalid prices', () => {
  assert.equal(formatVehiclePrice(null, 'USD', 'fr', translate('fr')), 'Prix sur demande')
  assert.equal(formatVehiclePrice(0, 'USD', 'en', translate('en')), 'Price on request')
  assert.equal(formatVehiclePrice('not-a-number', 'USD', 'en', translate('en')), 'Price on request')
})

test('generates a localized and correctly encoded WhatsApp inquiry from vehicle fields', () => {
  const vehicle = { id: 'veh-42', brand: 'Land Rover', model: 'Defender & Co.' }
  const frUrl = new URL(getVehicleWhatsAppHref(vehicle, translate('fr')))
  const enUrl = new URL(getVehicleWhatsAppHref(vehicle, translate('en')))
  assert.equal(frUrl.hostname, 'wa.me')
  assert.equal(frUrl.pathname, `/${AUTOMOBILE_WHATSAPP}`)
  assert.equal(frUrl.searchParams.get('text'), 'Bonjour, je suis intéressé par le véhicule Land Rover Defender & Co., référence veh-42.')
  assert.equal(enUrl.searchParams.get('text'), 'Hello, I am interested in the Land Rover Defender & Co., reference veh-42.')
})

test('keeps AUTO_SALES translation keys in FR and EN in sync', () => {
  assert.deepEqual(Object.keys(translations.fr.automobilePage).sort(), Object.keys(translations.en.automobilePage).sort())
})
