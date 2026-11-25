const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const SLASH_DATE = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isRealDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

/** Calendar parts from a Date, ISO string, or MM/DD/YYYY string. Date prefixes ignore clock time. */
export function parseDateParts(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const isoMatch = ISO_DATE.exec(text);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return isRealDate(year, month, day) ? { year, month, day } : null;
  }

  const slashMatch = SLASH_DATE.exec(text);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    return isRealDate(year, month, day) ? { year, month, day } : null;
  }

  return null;
}

/** Zero-padded MM/DD/YYYY. Returns an empty string when the value has no calendar date. */
export function formatDate(value) {
  const parts = parseDateParts(value);
  if (!parts) return '';
  return `${pad(parts.month)}/${pad(parts.day)}/${parts.year}`;
}

/** Compact month and day label for dense transaction rows. */
export function formatCompactDate(value) {
  const parts = parseDateParts(value);
  if (!parts) return '';
  return `${MONTH_NAMES[parts.month - 1]} ${parts.day}`;
}

/** YYYY-MM-DD used by date inputs, sorting, and stored room dates. */
export function toIsoDate(value) {
  const parts = parseDateParts(value);
  if (!parts) return '';
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function todayIsoDate() {
  return toIsoDate(new Date());
}
