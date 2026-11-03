import { translations as client } from '../client-frontend/src/i18n/translations.js'
import { translations as admin } from '../admin-frontend/src/i18n/translations.js'
import fs from 'node:fs'
import path from 'node:path'

const leaves = (value, prefix = '', output = {}) => {
  for (const [key, child] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) leaves(child, path, output)
    else output[path] = child
  }
  return output
}

const intentionalIdentical = {
  client: new Set([
    'hero.eyebrow', 'hero.route1', 'hero.route2', 'hero.route3',
    'about.stat1Value', 'about.stat2Value', 'about.stat3Value',
    'institutional.constructionTitle', 'institutional.constructionAddress',
    'stats.stat1Val', 'stats.stat2Val', 'stats.stat3Val',
    'howItWorks.step1Num', 'howItWorks.step2Num', 'howItWorks.step3Num',
    'contact.phonePlaceholder', 'transportPage.paymentMobileMoney',
    'transportPage.paymentPhonePlaceholder', 'automobilePage.showroomLabel',
    'automobilePage.kilometerShort', 'automobilePage.inquiryContactPreferenceWhatsapp',
    'common.currency', 'common.french', 'common.english',
  ]),
  admin: new Set([
    'superAdminNav.coach', 'navigation.sections.coach', 'navigation.sections.automobile',
    'navigation.sections.construction', 'adminHome.servicesItems.coach',
    'agentParcel.mobileMoney', 'resourceOptions.paymentMethod.MOBILE_MONEY',
  ]),
}

for (const [name, dictionaries] of [['client', client], ['admin', admin]]) {
  const fr = leaves(dictionaries.fr)
  const en = leaves(dictionaries.en)
  const sw = leaves(dictionaries.sw)
  const frKeys = Object.keys(fr).filter((key) => typeof fr[key] === 'string')
  const missing = frKeys.filter((key) => typeof sw[key] !== 'string')
  const identical = frKeys.filter((key) => typeof sw[key] === 'string' && sw[key] === fr[key])
  const unexpected = identical.filter((key) => !intentionalIdentical[name].has(key))
  const onlyInEn = Object.keys(en).filter((key) => !(key in fr))
  const onlyInFr = Object.keys(fr).filter((key) => !(key in en))
  const onlyInSw = Object.keys(sw).filter((key) => !(key in fr))
  const groups = new Map()
  for (const key of identical) {
    const group = key.split('.')[0]
    groups.set(group, (groups.get(group) || 0) + 1)
  }
  console.log(`${name}: ${frKeys.length} FR strings; ${missing.length} missing SW strings; ${identical.length} SW values equal FR`)
  console.log(`  FR/EN parity: ${onlyInFr.length === 0 && onlyInEn.length === 0 ? 'OK' : 'FAIL'}; every FR string has SW: ${missing.length === 0 ? 'OK' : 'FAIL'}; additional SW-only keys: ${onlyInSw.length}`)
  console.log([...groups.entries()].sort((a, b) => b[1] - a[1]).map(([group, count]) => `  ${group}: ${count}`).join('\n'))
  console.log(`  Documented intentional equalities: ${identical.join(', ') || 'none'}`)
  if (missing.length || onlyInFr.length || onlyInEn.length || unexpected.length) {
    console.error(`  QA failure: missing SW=${missing.join(', ')}; unexpected equalities=${unexpected.join(', ')}; FR/EN key parity mismatch.`)
    process.exitCode = 1
  }
}

const sourceFiles = []
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) visit(filename)
    else if (/\.jsx?$/.test(entry.name)) sourceFiles.push(filename)
  }
}
visit('client-frontend/src')
visit('admin-frontend/src')
const rawText = new Map()
for (const filename of sourceFiles) {
  const source = fs.readFileSync(filename, 'utf8')
  for (const match of source.matchAll(/>([^<{\n]{2,90})</g)) {
    const value = match[1].trim()
    if (/[A-Za-zÀ-ÿ]/.test(value) && !/^[\s:,.\-–—/]+$/.test(value)) rawText.set(value, filename)
  }
}
console.log(`Potential hard-coded text (${rawText.size} strings):`)
for (const [value, filename] of rawText) console.log(`  ${path.relative('.', filename)}: ${value}`)
