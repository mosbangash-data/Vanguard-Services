import { translations } from '../admin-frontend/src/i18n/translations.js'
const flatten = (value, prefix = '') => {
  const rows = []
  for (const [key, child] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) rows.push(...flatten(child, path))
    else rows.push([path, child])
  }
  return rows
}
for (const name of process.argv.slice(2)) {
  console.log(`\n${name}`)
  for (const [key, value] of flatten(translations.fr[name])) console.log(`${key}: ${String(value)}`)
}
