const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('agency staff register includes French and English UI labels and frequency/status choices', () => {
  const source = fs.readFileSync(require.resolve('../admin-frontend/src/i18n/translations.js'), 'utf8');
  const french = source.slice(source.indexOf("staffRegistry: { title: 'Personnel de l’agence'"));
  const english = source.slice(source.indexOf("staffRegistry: { title: 'Agency staff'"));
  assert.match(french, /attendanceDate: 'Date de présence'/);
  assert.match(french, /payFrequency: 'Périodicité'/);
  assert.match(french, /present: 'Présent'.*absent: 'Absent'.*leave: 'En congé'/);
  assert.match(english, /attendanceDate: 'Attendance date'/);
  assert.match(english, /payFrequency: 'Pay frequency'/);
  assert.match(english, /present: 'Present'.*absent: 'Absent'.*leave: 'On leave'/);
});

test('staff navigation label is available in both supported languages', () => {
  const source = fs.readFileSync(require.resolve('../admin-frontend/src/i18n/translations.js'), 'utf8');
  assert.match(source, /staff: 'Personnel'/);
  assert.match(source, /staff: 'Staff'/);
});
