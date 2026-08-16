// Temporary QA script: validates translations module integrity + all t() keys used in source
import { translations } from './src/i18n/translations.js'
import * as mod from './src/i18n/translations.js'
import fs from 'node:fs'
import path from 'node:path'

console.log('EXPORT KEYS:', Object.keys(mod))
console.log('LANGS:', Object.keys(translations))

const get = (dict, key) => {
  const keys = key.split('.')
  let res = dict
  for (const k of keys) {
    if (res && res[k] !== undefined) res = res[k]
    else return undefined
  }
  return res
}

const walk = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full)
  }
  return files
}

const files = walk('./src')
const usage = new Map() // key -> Set(files)
const re = /\bt\(\s*'([^'`$]+?)'\s*\)/g
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  let m
  while ((m = re.exec(src))) {
    if (!usage.has(m[1])) usage.set(m[1], new Set())
    usage.get(m[1]).add(file.replace(/\\/g, '/'))
  }
}

console.log(`\nScanned ${files.length} source files; found ${usage.size} distinct t() keys.\n`)

const problems = []
for (const [key, where] of [...usage].sort()) {
  for (const lang of Object.keys(translations)) {
    const v = get(translations[lang], key)
    if (v === undefined) problems.push({ lang, key, kind: 'MISSING', where: [...where] })
    else if (typeof v === 'object') problems.push({ lang, key, kind: 'NOT_A_STRING(object)', where: [...where] })
  }
}

// Focus on construction pages
const constructionProblems = problems.filter((p) => p.where.some((w) => w.includes('/construction/') || w.includes('layouts/') || w.includes('resourceConfig')))

if (problems.length === 0) {
  console.log('KEY CHECK: OK — every t() key used in source resolves in FR and EN.')
} else {
  console.log(`KEY CHECK: ${problems.length} problem(s):`)
  for (const p of problems) console.log(`  [${p.lang}] ${p.kind} ${p.key}  <- ${p.where.join(', ')}`)
  console.log(`\n  (of which ${constructionProblems.length} affect Construction/layout files)`)
}

// Structural parity FR vs EN
const flat = (obj, prefix = '', out = []) => {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === 'object') flat(v, prefix ? `${prefix}.${k}` : k, out)
    else out.push(prefix ? `${prefix}.${k}` : k)
  }
  return out
}
const fr = new Set(flat(translations.fr))
const en = new Set(flat(translations.en))
console.log('\nFR total keys:', fr.size, '| EN total keys:', en.size)
console.log('Only in FR:', [...fr].filter((k) => !en.has(k)))
console.log('Only in EN:', [...en].filter((k) => !fr.has(k)))

// Verify FR and EN values actually differ where expected (not just copies) for construction
const sample = [
  'construction.requests.title',
  'construction.quoteRequests.title',
  'construction.requests.empty',
  'construction.quoteRequests.empty',
]
console.log('\nSample FR/EN values:')
for (const k of sample) {
  console.log(`  ${k}\n    FR: ${JSON.stringify(get(translations.fr, k))}\n    EN: ${JSON.stringify(get(translations.en, k))}`)
}

process.exit(problems.length === 0 ? 0 : 1)
