// Date helpers. Days are local-time ISO strings ("2026-10-12"); instants are epoch ms.

export const MIN_MS = 60_000;
export const DAY_MIN = 24 * 60;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(now: number = Date.now()): string {
  return toISO(new Date(now));
}

export function isoOf(ms: number): string {
  return toISO(new Date(ms));
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const d = fromISO(iso);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toISO(d);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Start of a local day as epoch ms. */
export function dayStartMs(iso: string): number {
  return fromISO(iso).getTime();
}

/** Epoch ms for `minutes` after local midnight on `iso` (DST-safe). */
export function msAt(iso: string, minutes: number): number {
  const d = fromISO(iso);
  d.setHours(0, minutes, 0, 0);
  return d.getTime();
}

/** Minutes since local midnight for an instant. */
export function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

/** Stopwatch format, e.g. 0:15:08. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** 9:00 am / 1:30 pm from minutes after midnight. */
export function fmtHM(minutes: number): string {
  const m = Math.round(minutes) % DAY_MIN;
  const h = Math.floor(m / 60);
  const period = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m % 60)} ${period}`;
}

export function hourLabel(h: number): string {
  if (h === 0 || h === 24) return '12 am';
  if (h === 12) return '12 pm';
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

/** "HH:MM" for <input type="time">. */
export function toTimeInput(minutes: number): string {
  const m = Math.round(minutes);
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
}

export function fromTimeInput(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const weekdayShort = (iso: string) => WD[fromISO(iso).getDay()];
export const weekdayLong = (iso: string) => WD_LONG[fromISO(iso).getDay()];
export const dayNum = (iso: string) => fromISO(iso).getDate();
export const monthName = (ym: string) => MON[Number(ym.slice(5, 7)) - 1];
export const monthShort = (ym: string) => monthName(ym).slice(0, 3);

/** "Mon 12 Oct" */
export function fmtDayShort(iso: string): string {
  return `${weekdayShort(iso)} ${dayNum(iso)} ${monthShort(monthOf(iso))}`;
}

/** "Monday, 12 October" */
export function fmtDayLong(iso: string): string {
  return `${weekdayLong(iso)}, ${dayNum(iso)} ${monthName(monthOf(iso))}`;
}

/** Friendly relative label used for due dates. */
export function relativeDay(iso: string, today: string): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  if (iso === addDays(today, -1)) return 'Yesterday';
  const diff = Math.round((dayStartMs(iso) - dayStartMs(today)) / 86_400_000);
  if (diff > 1 && diff < 7) return weekdayShort(iso);
  return `${dayNum(iso)} ${monthShort(monthOf(iso))}`;
}

export function greeting(now: number = Date.now()): string {
  const h = new Date(now).getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
