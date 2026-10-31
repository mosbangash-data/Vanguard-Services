'use strict';

const agencyLocalDateTimeToUtc = (dateValue, timeValue, timeZone = 'Africa/Kinshasa') => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''));
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(timeValue || ''));
  if (!dateMatch || !timeMatch) throw new RangeError('A valid YYYY-MM-DD date and HH:mm time are required');
  const [year, month, day] = dateMatch.slice(1).map(Number);
  const [hour, minute] = timeMatch.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) throw new RangeError('Invalid local date or time');
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(candidate)).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
    const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    const delta = target - represented;
    candidate += delta;
    if (!delta) return new Date(candidate);
  }
  const resolved = new Date(candidate);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(resolved).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  if (+parts.year !== year || +parts.month !== month || +parts.day !== day || +parts.hour !== hour || +parts.minute !== minute) throw new RangeError('Local time does not exist in the agency time zone');
  return resolved;
};

module.exports = { agencyLocalDateTimeToUtc };
