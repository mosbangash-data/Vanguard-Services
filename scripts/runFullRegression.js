const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testsDir = path.join(__dirname, '..', 'tests');
const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js')).sort();

console.log(`Found ${files.length} test files to evaluate.`);
let totalPassed = 0;
let totalFailed = 0;
const failures = [];
const successes = [];

for (const file of files) {
  const filePath = path.join(testsDir, file);
  try {
    const output = execSync(`node --test "${filePath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    successes.push({ file, output: output.trim() });
    totalPassed++;
  } catch (err) {
    totalFailed++;
    failures.push({ file, error: (err.stdout || '') + '\n' + (err.stderr || '') });
  }
}

console.log('=== REGRESSION TEST SUMMARY ===');
console.log(`Total test files: ${files.length}`);
console.log(`Passed files: ${totalPassed}`);
console.log(`Failed files: ${totalFailed}`);

if (failures.length > 0) {
  console.log('\n--- Failed test files ---');
  failures.forEach(f => {
    console.log(`\n❌ ${f.file}:`);
    const lines = f.error.split('\n').filter(l => l.trim().length > 0).slice(0, 10);
    console.log(lines.join('\n'));
  });
}

if (successes.length > 0) {
  console.log('\n--- Passed test files ---');
  successes.forEach(s => console.log(`✔ ${s.file}`));
}
