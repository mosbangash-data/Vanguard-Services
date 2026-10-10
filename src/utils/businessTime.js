const BUSINESS_TIME_ZONE = 'Africa/Kinshasa';

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const dateKeyAt = (date) => {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const parseDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
};

const addDateKeyDays = (value, days) => {
  const parsed = parseDateKey(value);
  if (!parsed) return null;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return date.toISOString().slice(0, 10);
};

const businessMidnightUtc = (value) => {
  const parsed = parseDateKey(value);
  if (!parsed) return null;
  const desiredUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  let candidate = desiredUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = Object.fromEntries(dateTimeFormatter.formatToParts(new Date(candidate)).map(({ type, value: part }) => [type, part]));
    const observedWallUtc = Date.UTC(Number(observed.year), Number(observed.month) - 1, Number(observed.day), Number(observed.hour), Number(observed.minute), Number(observed.second));
    const correction = observedWallUtc - desiredUtc;
    if (correction === 0) return new Date(candidate);
    candidate -= correction;
  }
  return new Date(candidate);
};

const businessDayRange = (value) => {
  const start = businessMidnightUtc(value);
  if (!start) return null;
  return { start, end: businessMidnightUtc(addDateKeyDays(value, 1)) };
};

module.exports = { BUSINESS_TIME_ZONE, dateKeyAt, parseDateKey, addDateKeyDays, businessMidnightUtc, businessDayRange };
