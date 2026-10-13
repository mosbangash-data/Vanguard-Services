const BUSINESS_TIME_ZONE = 'Africa/Kinshasa';
const formatterCache = new Map();
const getFormatter = (timeZone) => {
  if (!formatterCache.has(timeZone)) formatterCache.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }));
  return formatterCache.get(timeZone);
};
const isValidTimeZone = (timeZone) => {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return false;
  try { getFormatter(timeZone.trim()); return true; } catch { return false; }
};
const dateKeyAt = (date, timeZone = BUSINESS_TIME_ZONE) => {
  const parts = Object.fromEntries(getFormatter(timeZone).formatToParts(date).map(({ type, value }) => [type, value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
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
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days)).toISOString().slice(0, 10);
};
const businessMidnightUtc = (value, timeZone = BUSINESS_TIME_ZONE) => {
  const parsed = parseDateKey(value);
  if (!parsed || !isValidTimeZone(timeZone)) return null;
  const approximate = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  let low = approximate - 48 * 60 * 60 * 1000;
  let high = approximate + 48 * 60 * 60 * 1000;
  if (dateKeyAt(new Date(low), timeZone) >= value || dateKeyAt(new Date(high), timeZone) < value) return null;
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (dateKeyAt(new Date(middle), timeZone) < value) low = middle;
    else high = middle;
  }
  return dateKeyAt(new Date(high), timeZone) === value ? new Date(high) : null;
};
const businessDayRange = (value, timeZone = BUSINESS_TIME_ZONE) => {
  if (!parseDateKey(value) || !isValidTimeZone(timeZone)) return null;
  const start = businessMidnightUtc(value, timeZone);
  const nextDate = addDateKeyDays(value, 1);
  const end = nextDate ? businessMidnightUtc(nextDate, timeZone) : null;
  return start && end && end > start ? { start, end } : null;
};
module.exports = { BUSINESS_TIME_ZONE, isValidTimeZone, dateKeyAt, parseDateKey, addDateKeyDays, businessMidnightUtc, businessDayRange };
