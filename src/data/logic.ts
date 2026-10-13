// Pure functions over AppData: summaries, bills, task grouping. No React, no storage — easy to test.
import type { AppData, Bill, Cadence, Day, Expense, ID, Milestone, Priority, SpendKind, Task, TimeEntry } from './types';
import { MIN_MS, addDays, daysInMonth, dayStartMs, fromISO, monthOf, toISO, weekStart } from '../lib/dates';
import { DRIFT_ID, MILESTONE_KINDS } from './seed';

/* ---------- Time ---------- */

export interface Totals {
  total: number;
  byCat: Record<ID, number>;
}

export interface DaySummary extends Totals {
  day: Day;
}

export function entryEnd(e: TimeEntry, now: number): number {
  return e.end ?? Math.max(now, e.start);
}

/** Minutes of `e` that fall inside [from, to). */
export function overlapMin(e: TimeEntry, from: number, to: number, now: number): number {
  const s = Math.max(e.start, from);
  const t = Math.min(entryEnd(e, now), to);
  return t > s ? (t - s) / MIN_MS : 0;
}

export function dayTotals(entries: TimeEntry[], day: Day, now: number): Totals {
  const from = dayStartMs(day);
  const to = dayStartMs(addDays(day, 1));
  const byCat: Record<ID, number> = {};
  let total = 0;
  for (const e of entries) {
    const m = overlapMin(e, from, to, now);
    if (m <= 0) continue;
    byCat[e.categoryId] = (byCat[e.categoryId] ?? 0) + m;
    total += m;
  }
  return { total, byCat };
}

export function rangeSummary(entries: TimeEntry[], days: Day[], now: number): Totals & { days: DaySummary[] } {
  const out: DaySummary[] = days.map((day) => ({ day, ...dayTotals(entries, day, now) }));
  const byCat: Record<ID, number> = {};
  let total = 0;
  for (const d of out) {
    total += d.total;
    for (const [k, v] of Object.entries(d.byCat)) byCat[k] = (byCat[k] ?? 0) + v;
  }
  return { days: out, total, byCat };
}

export function weekDays(anyDay: Day): Day[] {
  const start = weekStart(anyDay);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthDays(ym: string): Day[] {
  return Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
}

/** Entries that touch `day`, oldest first. */
export function entriesForDay(entries: TimeEntry[], day: Day, now: number): TimeEntry[] {
  const from = dayStartMs(day);
  const to = dayStartMs(addDays(day, 1));
  return entries.filter((e) => overlapMin(e, from, to, now) > 0 || (e.end === null && e.start < to && e.start >= from)).sort((a, b) => a.start - b.start);
}

/**
 * Paint [from, to) with one activity, or erase it when `categoryId` is null.
 * Anything already in that range is trimmed or split, so blocks never overlap the new paint.
 * A running timer that overlaps keeps running after the painted range.
 * Neighbouring painted blocks of the same activity (and no label) are merged into one.
 */
export function paintRange(entries: TimeEntry[], from: number, to: number, categoryId: ID | null, now: number, makeId: () => ID): TimeEntry[] {
  if (to <= from) return entries;
  const out: TimeEntry[] = [];
  for (const e of entries) {
    const end = entryEnd(e, now);
    if (end <= from || e.start >= to) { out.push(e); continue; }
    if (e.start < from) out.push({ ...e, end: from });
    if (end > to) out.push({ ...e, id: e.start < from ? makeId() : e.id, start: to, end: e.end });
  }
  if (categoryId) out.push({ id: makeId(), label: '', categoryId, start: from, end: to, source: 'paint' });
  return mergeNeighbours(out.filter((e) => e.end === null || e.end - e.start >= MIN_MS));
}

function mergeNeighbours(entries: TimeEntry[]): TimeEntry[] {
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  const out: TimeEntry[] = [];
  for (const e of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.end !== null && e.end !== null && prev.end === e.start && prev.categoryId === e.categoryId && !prev.label && !e.label) {
      out[out.length - 1] = { ...prev, end: e.end };
    } else out.push(e);
  }
  return out;
}

/** Minutes of `day` between the timeline's start and end (up to now, for today) that nothing covers. */
export function unloggedMin(entries: TimeEntry[], day: Day, fromHour: number, toHour: number, now: number): number {
  const from = dayStartMs(day) + fromHour * 60 * MIN_MS;
  const to = Math.min(dayStartMs(day) + toHour * 60 * MIN_MS, Math.max(now, from));
  if (to <= from) return 0;
  const spans = entries
    .map((e) => [Math.max(e.start, from), Math.min(entryEnd(e, now), to)] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = from;
  for (const [a, b] of spans) {
    if (b <= cursor) continue;
    covered += b - Math.max(a, cursor);
    cursor = b;
  }
  return Math.round((to - from - covered) / MIN_MS);
}

/* ---------- Milestones ---------- */

export const milestoneName = (m: Pick<Milestone, 'kind' | 'label'>) =>
  m.kind === 'custom' ? m.label || 'Milestone' : MILESTONE_KINDS.find((k) => k.kind === m.kind)?.name ?? m.kind;

export function milestonesForDay(ms: Milestone[], day: Day): Milestone[] {
  return ms.filter((m) => m.day === day).sort((a, b) => a.min - b.min);
}

export const wakeOf = (ms: Milestone[], day: Day) => ms.find((m) => m.day === day && m.kind === 'wake');
export const bedOf = (ms: Milestone[], day: Day) => ms.find((m) => m.day === day && m.kind === 'bed');

/** Average of minute values, or null with none. Bedtimes after midnight are > 1440, so they average sensibly. */
export function avgMin(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null;
}

/** A bedtime typed as an early-morning clock time (before noon) means after midnight. */
export const bedMinFromClock = (clockMin: number) => (clockMin < 12 * 60 ? clockMin + 24 * 60 : clockMin);

export function runningEntry(entries: TimeEntry[]): TimeEntry | undefined {
  return entries.find((e) => e.end === null);
}

/** Most recent distinct label+category pairs, for one-tap restarts. */
export function recentActivities(entries: TimeEntry[], limit = 4): { label: string; categoryId: ID }[] {
  const seen = new Set<string>();
  const out: { label: string; categoryId: ID }[] = [];
  for (const e of [...entries].sort((a, b) => b.start - a.start)) {
    const key = `${e.label}|${e.categoryId}`;
    if (seen.has(key) || !e.label) continue;
    seen.add(key);
    out.push({ label: e.label, categoryId: e.categoryId });
    if (out.length === limit) break;
  }
  return out;
}

/* ---------- Money ---------- */

export interface SpendSplit {
  total: number;
  need: number;
  want: number;
}

const emptySplit = (): SpendSplit => ({ total: 0, need: 0, want: 0 });
const addTo = (s: SpendSplit, kind: SpendKind, amount: number) => { s.total += amount; s[kind] += amount; };

export interface SpendSummary extends SpendSplit {
  /** Tag totals, biggest first. Untagged spending is not listed. */
  byTag: { tag: string; total: number }[];
  untagged: number;
  count: number;
}

export function spendSummary(expenses: Expense[], match: (e: Expense) => boolean): SpendSummary {
  const split = emptySplit();
  const tags = new Map<string, number>();
  let untagged = 0;
  let count = 0;
  for (const e of expenses) {
    if (!match(e)) continue;
    count++;
    addTo(split, e.kind, e.amount);
    if (e.tags.length === 0) untagged += e.amount;
    for (const t of e.tags) tags.set(t, (tags.get(t) ?? 0) + e.amount);
  }
  const byTag = [...tags.entries()].map(([tag, total]) => ({ tag, total })).sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));
  return { ...split, byTag, untagged, count };
}

export const daySpend = (expenses: Expense[], day: Day) => spendSummary(expenses, (e) => e.day === day).total;

export interface WeekSpend extends SpendSummary {
  start: Day;
  days: (SpendSplit & { day: Day })[];
  allowance: number;
  left: number;
  /** Days left in the week including today (0 for past weeks, 7 for future ones). */
  daysLeft: number;
  /** What can still be spent per remaining day, in cents. */
  perDayLeft: number;
}

/** Spending for the Monday–Sunday week containing `anyDay`, against the weekly allowance. */
export function weekSpend(expenses: Expense[], anyDay: Day, allowance: number, today: Day): WeekSpend {
  const start = weekStart(anyDay);
  const end = addDays(start, 6);
  const sum = spendSummary(expenses, (e) => e.day >= start && e.day <= end);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const s = emptySplit();
    for (const e of expenses) if (e.day === day) addTo(s, e.kind, e.amount);
    return { day, ...s };
  });
  const daysLeft = today > end ? 0 : today < start ? 7 : days.filter((d) => d.day >= today).length;
  const left = allowance - sum.total;
  return { ...sum, start, days, allowance, left, daysLeft, perDayLeft: daysLeft > 0 && left > 0 ? Math.floor(left / daysLeft) : 0 };
}

export interface MonthSpend extends SpendSummary {
  /** Weeks that touch the month; amounts only count days inside the month. */
  weeks: (SpendSplit & { start: Day })[];
  /** A month's allowance is simply four weekly allowances. */
  allowance: number;
}

export function monthSpend(expenses: Expense[], ym: string, weeklyAllowance: number): MonthSpend {
  const sum = spendSummary(expenses, (e) => monthOf(e.day) === ym);
  const first = `${ym}-01`;
  const last = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
  const weeks: (SpendSplit & { start: Day })[] = [];
  for (let w = weekStart(first); w <= last; w = addDays(w, 7)) {
    const s = emptySplit();
    const wEnd = addDays(w, 6);
    for (const e of expenses) if (e.day >= w && e.day <= wEnd && monthOf(e.day) === ym) addTo(s, e.kind, e.amount);
    weeks.push({ start: w, ...s });
  }
  return { ...sum, weeks, allowance: weeklyAllowance * 4 };
}

/** Tags used on spending, most used first. */
export function moneyTags(expenses: Expense[]): string[] {
  const count = new Map<string, number>();
  for (const e of expenses) for (const t of e.tags) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/** Next due date after `day`. Monthly and yearly keep the day of month, clamped to short months. */
export function nextDue(day: Day, cadence: Cadence): Day {
  if (cadence === 'weekly') return addDays(day, 7);
  if (cadence === 'fortnightly') return addDays(day, 14);
  const d = fromISO(day);
  const months = cadence === 'monthly' ? 1 : 12;
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toISO(target);
}

export interface UpcomingBill {
  bill: Bill;
  overdue: boolean;
  daysAway: number;
}

export function upcomingBills(bills: Bill[], today: Day, horizonDays = 14): UpcomingBill[] {
  const t = dayStartMs(today);
  return bills
    .map((bill) => {
      const daysAway = Math.round((dayStartMs(bill.nextDue) - t) / 86_400_000);
      return { bill, overdue: daysAway < 0, daysAway };
    })
    .filter((b) => b.daysAway <= horizonDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

/* ---------- Tasks ---------- */

/** "Lab report #uni !!" → title "Lab report", tags ["uni"], priority 2. */
export function parseTaskInput(text: string): { title: string; tags: string[]; priority: Priority } {
  const tags: string[] = [];
  let priority: Priority = 0;
  const words = text.split(/\s+/).filter(Boolean).filter((w) => {
    if (/^#[\p{L}\p{N}_-]+$/u.test(w)) {
      const t = w.slice(1).toLowerCase();
      if (!tags.includes(t)) tags.push(t);
      return false;
    }
    if (w === '!!' || w === '!!!') { priority = 2; return false; }
    if (w === '!') { priority = Math.max(priority, 1) as Priority; return false; }
    return true;
  });
  return { title: words.join(' '), tags, priority };
}

export function normaliseTags(input: string): string[] {
  return Array.from(new Set(input.split(/[\s,]+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean)));
}

export interface TaskGroup {
  key: 'overdue' | 'today' | 'week' | 'later' | 'someday' | 'done';
  label: string;
  tasks: Task[];
}

const byPriorityThenDue = (a: Task, b: Task) =>
  b.priority - a.priority || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt;

export function groupTasks(tasks: Task[], today: Day): TaskGroup[] {
  const weekEnd = addDays(today, 6);
  const groups: TaskGroup[] = [
    { key: 'overdue', label: 'Overdue', tasks: [] },
    { key: 'today', label: 'Today', tasks: [] },
    { key: 'week', label: 'Next 7 days', tasks: [] },
    { key: 'later', label: 'Later', tasks: [] },
    { key: 'someday', label: 'No date', tasks: [] },
    { key: 'done', label: 'Done', tasks: [] },
  ];
  const at = (k: TaskGroup['key']) => groups.find((g) => g.key === k)!.tasks;
  for (const t of tasks) {
    if (t.done) at('done').push(t);
    else if (!t.due) at('someday').push(t);
    else if (t.due < today) at('overdue').push(t);
    else if (t.due === today) at('today').push(t);
    else if (t.due <= weekEnd) at('week').push(t);
    else at('later').push(t);
  }
  for (const g of groups) {
    if (g.key === 'done') g.tasks.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    else g.tasks.sort(byPriorityThenDue);
  }
  return groups.filter((g) => g.tasks.length > 0);
}

/** Tasks for the Home card: overdue and due today, still open. */
export function tasksForToday(tasks: Task[], today: Day): Task[] {
  return tasks.filter((t) => !t.done && t.due !== null && t.due <= today).sort(byPriorityThenDue);
}

export function allTags(tasks: Task[]): string[] {
  const count = new Map<string, number>();
  for (const t of tasks) for (const tag of t.tags) count.set(tag, (count.get(tag) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/* ---------- Stickers ---------- */

export type StickerKind = 'flower' | 'leaf' | 'heart' | 'star';

/** One sticker per finished block of 25+ minutes (Drift doesn't count) and one per finished task, this week (Mon–Sun). */
export function stickersThisWeek(data: AppData, today: Day): StickerKind[] {
  const from = dayStartMs(weekStart(today));
  const to = dayStartMs(addDays(weekStart(today), 7));
  const out: { at: number; kind: StickerKind }[] = [];
  data.entries.forEach((e) => {
    if (e.end !== null && e.categoryId !== DRIFT_ID && e.end >= from && e.end < to && (e.end - e.start) / MIN_MS >= 25) {
      out.push({ at: e.end, kind: out.length % 2 === 0 ? 'flower' : 'leaf' });
    }
  });
  data.tasks.forEach((t) => {
    if (t.done && t.doneAt !== null && t.doneAt >= from && t.doneAt < to) {
      out.push({ at: t.doneAt, kind: t.priority === 2 ? 'star' : 'heart' });
    }
  });
  return out.sort((a, b) => a.at - b.at).map((s) => s.kind);
}
