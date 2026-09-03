import fs from 'node:fs'
import path from 'node:path'

const srcDir = path.resolve('c:/Users/DOMINIQUE/Desktop/Vanguard-Services/admin-frontend/src')

function getAllFiles(dir, exts = ['.jsx', '.js']) {
  let results = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, exts))
    } else {
      if (exts.some((ext) => file.endsWith(ext))) {
        results.push(filePath)
      }
    }
  }
  return results
}

console.log('--- Starting Vanguard Admin Frontend Verification ---')
const allFiles = getAllFiles(srcDir)
console.log(`Found ${allFiles.length} JS/JSX files in src/`)

let errorCount = 0

for (const filePath of allFiles) {
  const relative = path.relative(srcDir, filePath)
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    // Basic checks
    if (!content.trim()) {
      console.warn(`[WARN] Empty file: ${relative}`)
    }
    // Check for broken relative imports
    const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      if (importPath.startsWith('.')) {
        const resolved = path.resolve(path.dirname(filePath), importPath)
        const possibleFiles = [
          resolved,
          `${resolved}.js`,
          `${resolved}.jsx`,
          `${resolved}.json`,
          `${resolved}.css`,
          `${resolved}.svg`,
          `${resolved}.png`,
          path.join(resolved, 'index.js'),
          path.join(resolved, 'index.jsx'),
        ]
        const exists = possibleFiles.some((f) => fs.existsSync(f))
        if (!exists) {
          console.error(`[IMPORT ERROR] in ${relative}: cannot resolve "${importPath}"`)
          errorCount++
        }
      }
    }
  } catch (err) {
    console.error(`[PARSE ERROR] in ${relative}:`, err.message)
    errorCount++
  }
}

if (errorCount === 0) {
  console.log('✅ ALL IMPORTS AND FILES VERIFIED CLEANLY!')
} else {
  console.error(`❌ FOUND ${errorCount} ERRORS!`)
}
