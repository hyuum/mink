// Pure functions over AppData: summaries, bills, task grouping. No React, no storage — easy to test.
import type { AppData, Bill, BlockLook, Cadence, Day, DayTemplate, Expense, ID, LineKind, Milestone, PhoneSettings, PlannedBlock, Priority, RepeatUnit, Rewards, SpendKind, Task, TextLine, TimeCategory, TimeEntry, TrackerItem } from './types';
import { MIN_MS, addDays, daysInMonth, dayStartMs, fromISO, monthOf, toISO, weekStart } from '../lib/dates';

/* ---------- Time ---------- */

export interface Totals {
  total: number;
  byCat: Record<ID, number>;
  /** Minutes per sub-activity id; the rest of an activity's time had no sub picked. */
  bySub: Record<ID, number>;
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
  const bySub: Record<ID, number> = {};
  let total = 0;
  for (const e of entries) {
    const m = overlapMin(e, from, to, now);
    if (m <= 0) continue;
    byCat[e.categoryId] = (byCat[e.categoryId] ?? 0) + m;
    if (e.subId) bySub[e.subId] = (bySub[e.subId] ?? 0) + m;
    total += m;
  }
  return { total, byCat, bySub };
}

export function rangeSummary(entries: TimeEntry[], days: Day[], now: number): Totals & { days: DaySummary[] } {
  const out: DaySummary[] = days.map((day) => ({ day, ...dayTotals(entries, day, now) }));
  const byCat: Record<ID, number> = {};
  const bySub: Record<ID, number> = {};
  let total = 0;
  for (const d of out) {
    total += d.total;
    for (const [k, v] of Object.entries(d.byCat)) byCat[k] = (byCat[k] ?? 0) + v;
    for (const [k, v] of Object.entries(d.bySub)) bySub[k] = (bySub[k] ?? 0) + v;
  }
  return { days: out, total, byCat, bySub };
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
/** The looks an activity's blocks can take, in the order the picker shows them. */
export const LOOKS: { id: BlockLook; name: string; hint: string }[] = [
  { id: 'solid', name: 'Solid', hint: 'Normal blocks' },
  { id: 'soft', name: 'Soft', hint: 'Pale, low-key' },
  { id: 'bold', name: 'Bold', hint: 'Outlined, stands out' },
  { id: 'hatch', name: 'Hatched', hint: 'Striped, like sleep' },
  { id: 'line', name: 'Line', hint: 'Just a thin line' },
  { id: 'arrow', name: 'Arrow', hint: 'An arrow, like travel' },
  { id: 'glow', name: 'Glow', hint: 'Soft halo' },
];
export const lookOf = (c: TimeCategory | undefined): BlockLook => c?.look ?? 'solid';
/** Filled looks merge with the block above or below; lines, arrows and glows stay apart. */
export const joinsNeighbours = (look: BlockLook) => look !== 'line' && look !== 'arrow' && look !== 'glow';
/** "Uni · Lecture" for a sub-activity, otherwise just the activity. */
export const activityName = (c: TimeCategory | undefined, subId?: string): string => {
  const sub = subId ? c?.subs?.find((s) => s.id === subId) : undefined;
  return sub ? `${c?.name} · ${sub.name}` : c?.name ?? '';
};

export function paintRange(entries: TimeEntry[], from: number, to: number, categoryId: ID | null, now: number, makeId: () => ID, label = '', subId?: ID): TimeEntry[] {
  if (to <= from) return entries;
  const out: TimeEntry[] = [];
  for (const e of entries) {
    const end = entryEnd(e, now);
    if (end <= from || e.start >= to) { out.push(e); continue; }
    if (e.start < from) out.push({ ...e, end: from });
    if (end > to) out.push({ ...e, id: e.start < from ? makeId() : e.id, start: to, end: e.end });
  }
  if (categoryId) out.push({ id: makeId(), label, categoryId, ...(subId ? { subId } : {}), start: from, end: to, source: 'paint' });
  return mergeNeighbours(out.filter((e) => e.end === null || e.end - e.start >= MIN_MS));
}

function mergeNeighbours(entries: TimeEntry[]): TimeEntry[] {
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  const out: TimeEntry[] = [];
  for (const e of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.end !== null && e.end !== null && prev.end === e.start && prev.categoryId === e.categoryId && prev.subId === e.subId && !prev.label && !e.label) {
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

/* ---------- Plans and templates ---------- */

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (day: Day) => (fromISO(day).getDay() + 6) % 7;

export const templateFor = (templates: DayTemplate[], day: Day) => templates.find((t) => t.weekdays.includes(weekdayIndex(day)));

const TPL_PREFIX = 'tpl:';
/** Plans shown straight from a template have made-up ids until the day gets its own copy. */
export const isTemplatePlan = (id: ID) => id.startsWith(TPL_PREFIX);
const templatePlanId = (t: DayTemplate, i: number, day: Day) => `${TPL_PREFIX}${t.id}:${i}:${day}`;

/** A day's plan: its own blocks once it has some (or was edited), otherwise its weekday's template. */
export function planForDay(d: Pick<AppData, 'planned' | 'planDays' | 'templates'>, day: Day): PlannedBlock[] {
  if (d.planDays.includes(day)) return d.planned.filter((p) => p.day === day).sort((a, b) => a.startMin - b.startMin);
  const t = templateFor(d.templates, day);
  if (!t) return [];
  return t.blocks.map((b, i) => ({ ...b, id: templatePlanId(t, i, day), day })).sort((a, b) => a.startMin - b.startMin);
}

/** Copies a day's template into `planned` so it can be changed. Returns the new data and old id → new id. */
export function ownPlan(d: AppData, day: Day, makeId: () => ID): { data: AppData; ids: Record<ID, ID> } {
  if (d.planDays.includes(day)) return { data: d, ids: {} };
  const ids: Record<ID, ID> = {};
  const copies = planForDay(d, day).map((p) => { const id = makeId(); ids[p.id] = id; return { ...p, id }; });
  return { data: { ...d, planned: [...d.planned, ...copies], planDays: [...d.planDays, day] }, ids };
}

/** Clears [from, to) minutes in one day's plan, trimming or splitting blocks, then adds a block if given an activity. */
export function planRange(blocks: PlannedBlock[], day: Day, from: number, to: number, categoryId: ID | null, makeId: () => ID, label = '', subId?: ID): { blocks: PlannedBlock[]; id: ID | null } {
  if (to <= from) return { blocks, id: null };
  const out: PlannedBlock[] = [];
  for (const p of blocks) {
    if (p.day !== day || p.endMin <= from || p.startMin >= to) { out.push(p); continue; }
    if (p.startMin < from) out.push({ ...p, endMin: from });
    if (p.endMin > to) out.push({ ...p, id: p.startMin < from ? makeId() : p.id, startMin: to });
  }
  const id = categoryId ? makeId() : null;
  if (categoryId && id) out.push({ id, label, categoryId, ...(subId ? { subId } : {}), day, startMin: from, endMin: to });
  return { blocks: out, id };
}

/** Ids of plans that have been filled in. */
export const donePlanIds = (entries: TimeEntry[]) => new Set(entries.map((e) => e.planId).filter((x): x is ID => Boolean(x)));

/**
 * Links a day's logged blocks to its plan after the plan changes: a logged block counts for a plan of the
 * same activity that it covers at least half of.
 */
export function relinkDay(entries: TimeEntry[], plan: PlannedBlock[], day: Day): TimeEntry[] {
  const from = dayStartMs(day);
  const to = dayStartMs(addDays(day, 1));
  const used = new Set<ID>();
  return entries.map((e) => {
    if (e.start < from || e.start >= to || e.end === null) return e;
    const s = (e.start - from) / MIN_MS;
    const t = (e.end - from) / MIN_MS;
    const p = plan.find((x) => x.categoryId === e.categoryId && !used.has(x.id) && Math.min(x.endMin, t) - Math.max(x.startMin, s) >= (x.endMin - x.startMin) / 2);
    if (p) used.add(p.id);
    const { planId: _old, ...rest } = e;
    return p ? { ...rest, planId: p.id } : rest;
  });
}

/* ---------- Phone tracking ---------- */

/** One stretch of one app on screen, as the Android app reports it. */
export interface PhoneSession { pkg: string; label: string; start: number; end: number }

/** A stretch of phone use waiting for you to approve it as a block. */
export interface PhoneSuggestion {
  key: string;
  start: number;
  end: number;
  categoryId: ID;
  /** Apps used, longest first, with minutes. */
  apps: { pkg: string; label: string; min: number }[];
}

/** What a stretch is called when approved: your name for its main app, else the app (if that's on), else nothing (the activity's name shows). */
export const phoneBlockName = (p: PhoneSettings, s: Pick<PhoneSuggestion, 'apps'>) => {
  const top = s.apps[0];
  if (!top) return '';
  return p.names?.[top.pkg] ?? (p.nameAfterApp ? top.label : '');
};

/** The activity an app counts as, or null when it doesn't count. */
export const phoneCategory = (s: PhoneSettings, pkg: string): ID | null => (pkg in s.apps ? s.apps[pkg] : s.defaultCategoryId);

/**
 * Turns raw app sessions into suggested blocks: apps that don't count are dropped, sessions with short gaps
 * between them join up, time you've already logged is cut out, and anything shorter than the minimum or
 * dismissed before is left out. Times snap to the quarter hour, like painted blocks, so a suggestion is
 * always at least 15 minutes and lines up with the rest of the day.
 */
export function phoneSuggestions(sessions: PhoneSession[], entries: TimeEntry[], s: PhoneSettings, dismissed: string[], now: number): PhoneSuggestion[] {
  const counted = sessions
    .map((x) => ({ ...x, cat: phoneCategory(s, x.pkg) }))
    .filter((x): x is PhoneSession & { cat: ID } => x.cat !== null && x.end > x.start)
    .sort((a, b) => a.start - b.start);

  // Join sessions whose gaps are shorter than the setting.
  const groups: (typeof counted)[] = [];
  for (const x of counted) {
    const g = groups[groups.length - 1];
    const gEnd = g ? Math.max(...g.map((y) => y.end)) : 0;
    if (g && x.start - gEnd <= s.gapMin * MIN_MS) g.push(x); else groups.push([x]);
  }

  const covered = entries
    .map((e) => [e.start, entryEnd(e, now)] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const Q = 15 * MIN_MS;
  const roundQ = (t: number) => Math.round(t / Q) * Q;
  const covers = (a: number, b: number) => covered.some(([x, y]) => x < b && y > a);
  const gone = new Set(dismissed);
  const out: PhoneSuggestion[] = [];

  for (const g of groups) {
    const rawEnd = Math.max(...g.map((y) => y.end));
    if (rawEnd - g[0].start < s.minMin * MIN_MS) continue;
    const g0 = roundQ(g[0].start);
    const g1 = roundQ(rawEnd);
    if (g1 <= g0) continue;
    let pieces: [number, number][] = [[g0, g1]];
    for (const [a, b] of covered) {
      pieces = pieces.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q] as [number, number]] : [[p, Math.min(a, q)], [Math.max(b, p), q]].filter(([u, v]) => v > u) as [number, number][]));
    }
    for (const [p0, q0] of pieces) {
      // Edges cut by logged time stay where that time starts or ends; the rest go to the nearest quarter hour.
      let p = roundQ(p0), q = roundQ(q0);
      if (p < p0 && covers(p, p0)) p += Q;
      if (q > q0 && covers(q0, q)) q -= Q;
      if (q - p < Math.max(15, s.minMin) * MIN_MS) continue;
      const key = `phone:${p}`;
      if (gone.has(key)) continue;
      const byApp = new Map<string, { pkg: string; label: string; min: number; cat: ID }>();
      for (const y of g) {
        const m = (Math.min(y.end, q) - Math.max(y.start, p)) / MIN_MS;
        if (m <= 0) continue;
        const cur = byApp.get(y.pkg) ?? { pkg: y.pkg, label: y.label, min: 0, cat: y.cat };
        cur.min += m;
        byApp.set(y.pkg, cur);
      }
      const apps = [...byApp.values()].sort((a, b) => b.min - a.min);
      if (!apps.length) continue;
      const byCat = new Map<ID, number>();
      for (const a of apps) byCat.set(a.cat, (byCat.get(a.cat) ?? 0) + a.min);
      const categoryId = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0][0];
      out.push({ key, start: p, end: q, categoryId, apps: apps.map(({ pkg, label, min }) => ({ pkg, label, min: Math.round(min) })) });
    }
  }
  return out;
}

/* ---------- Trackers: habits and routines ---------- */

export const daysBetween = (a: Day, b: Day) => Math.round((dayStartMs(b) - dayStartMs(a)) / 86_400_000);
const UNIT_DAYS = { day: 1, week: 7, month: 31 } as const;

/** `day` moved by whole months, keeping the day of the month where it can (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsToDay(day: Day, n: number, dom?: number): Day {
  const d = fromISO(day);
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(dom ?? d.getDate(), last)));
}

/** When a repeating item is next due: a set time after it was last done (or added), or the next set day of the month. */
export function repeatDue(t: TrackerItem): Day {
  const every = t.every ?? { n: 1, unit: 'week' as const };
  const last = t.hits.length ? t.hits[t.hits.length - 1] : null;
  const base = last ?? t.since;
  if (t.weekday !== undefined) {
    // On a set weekday: the first such day after it was last done (or on/after the day it was added).
    // Not done since that day came round means it's due (or overdue) from then.
    const ahead = (t.weekday - weekdayIndex(base) + 7) % 7;
    return addDays(base, last ? ahead || 7 : ahead);
  }
  if (every.unit === 'month' && t.onDay) {
    // The first chosen day of the month after it was last done (or on/after the day it was added).
    let due = addMonthsToDay(base, 0, t.onDay);
    if (last ? due <= base : due < base) due = addMonthsToDay(base, 1, t.onDay);
    return last && every.n > 1 ? addMonthsToDay(due, every.n - 1, t.onDay) : due;
  }
  if (every.unit === 'month') return addMonthsToDay(base, every.n);
  return addDays(base, every.n * UNIT_DAYS[every.unit]);
}

export type TrackerStatus =
  | { kind: 'since'; days: number; best: number }
  | { kind: 'every'; due: Day; daysLeft: number; doneToday: boolean; streak: number };

export function trackerStatus(t: TrackerItem, today: Day): TrackerStatus {
  if (t.kind === 'since') {
    const points = [t.since, ...t.hits, today];
    let best = 0;
    for (let i = 1; i < points.length; i++) best = Math.max(best, daysBetween(points[i - 1], points[i]));
    const last = t.hits.length ? t.hits[t.hits.length - 1] : t.since;
    return { kind: 'since', days: Math.max(0, daysBetween(last, today)), best };
  }
  const due = repeatDue(t);
  const every = t.every ?? { n: 1, unit: 'week' as const };
  const gap = every.n * UNIT_DAYS[every.unit];
  // Streak: done each time within its interval, counting back from the latest, while it isn't overdue.
  let streak = 0;
  if (t.hits.length && due >= today) {
    streak = 1;
    for (let i = t.hits.length - 1; i > 0 && daysBetween(t.hits[i - 1], t.hits[i]) <= gap; i--) streak++;
  }
  return { kind: 'every', due, daysLeft: daysBetween(today, due), doneToday: t.hits.includes(today), streak };
}

/** Repeating items due today or overdue (and not done today), most overdue first. */
export function dueTrackers(trackers: TrackerItem[], today: Day): { item: TrackerItem; daysLeft: number }[] {
  return trackers
    .filter((t) => t.kind === 'every')
    .map((item) => ({ item, s: trackerStatus(item, today) }))
    .filter(({ s }) => s.kind === 'every' && s.daysLeft <= 0 && !s.doneToday)
    .map(({ item, s }) => ({ item, daysLeft: s.kind === 'every' ? s.daysLeft : 0 }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ---------- Pages ---------- */

/** One line of a page, whichever array it lives in. */
export type PageItem =
  | { kind: 'todo'; id: ID; order: number; task: Task }
  | { kind: 'repeat' | 'since'; id: ID; order: number; tracker: TrackerItem }
  | { kind: 'heading' | 'note'; id: ID; order: number; line: TextLine };

/** A page's lines in order. */
export function pageItems(data: Pick<AppData, 'tasks' | 'trackers' | 'lines'>, listId: ID): PageItem[] {
  const out: PageItem[] = [
    ...data.trackers.filter((t) => t.folderId === listId).map((t): PageItem => ({ kind: t.kind === 'since' ? 'since' : 'repeat', id: t.id, order: t.order ?? 0, tracker: t })),
    ...data.tasks.filter((t) => t.listId === listId).map((t): PageItem => ({ kind: 'todo', id: t.id, order: t.order ?? 0, task: t })),
    ...data.lines.filter((l) => l.listId === listId).map((l): PageItem => ({ kind: l.kind, id: l.id, order: l.order, line: l })),
  ];
  return out.sort((a, b) => a.order - b.order);
}

/** The next free position at the end of a page. */
export const nextOrder = (data: Pick<AppData, 'tasks' | 'trackers' | 'lines'>, listId: ID) =>
  pageItems(data, listId).reduce((m, i) => Math.max(m, i.order + 1), 0);

/**
 * Gives every to-do and tracker a place on its page, for data saved before pages had an order:
 * repeats and counts first (as they were listed), then to-dos oldest first, after anything already placed.
 */
export function withOrders<T extends Pick<AppData, 'tasks' | 'trackers' | 'lines'>>(data: T): T {
  if (data.tasks.every((t) => t.order !== undefined) && data.trackers.every((t) => t.order !== undefined)) return data;
  const next = new Map<ID, number>();
  const take = (listId: ID) => { const n = next.get(listId) ?? 0; next.set(listId, n + 1); return n; };
  for (const x of [...data.tasks, ...data.trackers, ...data.lines]) {
    const listId = 'listId' in x ? x.listId : x.folderId;
    if (x.order !== undefined) next.set(listId, Math.max(next.get(listId) ?? 0, Math.ceil(x.order + 1e-9)));
  }
  const trackers = data.trackers.map((t) => (t.order !== undefined ? t : { ...t, order: take(t.folderId) }));
  const tasks = [...data.tasks].sort((a, b) => a.createdAt - b.createdAt).reduce((m, t) => m.set(t.id, t.order !== undefined ? t : { ...t, order: take(t.listId) }), new Map<ID, Task>());
  return { ...data, trackers, tasks: data.tasks.map((t) => tasks.get(t.id) ?? t) };
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** What a typed line will become: "## " a heading, "- " a note, "since …" a count, "every …" a repeat, else a to-do. */
export function lineKind(text: string): LineKind {
  const t = text.trim().toLowerCase();
  if (/^#{1,3}\s/.test(t)) return 'heading';
  if (/^-\s/.test(t)) return 'note';
  if (/^(since|last time)\b|\bdays since\b/.test(t)) return 'since';
  if (/\bevery\b|\bon (mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(daily|weekly|fortnightly|monthly)\b/.test(t)) return 'repeat';
  return 'todo';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A typed line read into its kind, its words, and for a repeat how often it comes due. */
export function parseLine(text: string, kind: LineKind = lineKind(text)): { kind: LineKind; text: string; every?: { n: number; unit: RepeatUnit }; weekday?: number } {
  const s = text.trim();
  if (kind === 'heading') return { kind, text: s.replace(/^#{1,3}\s*/, '') || s };
  if (kind === 'note') return { kind, text: s.replace(/^-\s*/, '') || s };
  if (kind === 'since') return { kind, text: cap(s.replace(/^(since|last time)\s+(i\s+)?/i, '').replace(/\bdays since\b/i, '').replace(/\s{2,}/g, ' ').trim()) || s };
  if (kind === 'repeat') {
    const day = /\b(?:every|on)\s+(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i.exec(s);
    if (day) return { kind, text: cap(s.replace(day[0], '').replace(/\s{2,}/g, ' ').trim()) || s, every: { n: 1, unit: 'week' }, weekday: WEEKDAYS.indexOf(day[1].toLowerCase()) };
    const m = /\b(?:every\s+(\d+)\s+(day|week|month)s?|every\s+(day|week|fortnight|month)|(daily|weekly|fortnightly|monthly))\b/i.exec(s);
    let every: { n: number; unit: RepeatUnit } = { n: 1, unit: 'week' };
    if (m) {
      const word = (m[3] ?? m[4] ?? '').toLowerCase();
      if (m[1]) every = { n: Number(m[1]), unit: m[2].toLowerCase() as RepeatUnit };
      else if (/^(day|daily)$/.test(word)) every = { n: 1, unit: 'day' };
      else if (/fortnight/.test(word)) every = { n: 2, unit: 'week' };
      else if (/^month/.test(word)) every = { n: 1, unit: 'month' };
    }
    return { kind, text: cap((m ? s.replace(m[0], '') : s).replace(/\s{2,}/g, ' ').trim()) || s, every };
  }
  return { kind, text: cap(s) };
}

/** "weekly", "every 3 days", "every Sunday", "monthly on the 1st". */
export function repeatText(t: TrackerItem): string {
  if (t.weekday !== undefined) return `every ${WEEKDAY_NAMES[t.weekday]}`;
  const e = t.every ?? { n: 1, unit: 'week' };
  const nth = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
  if (e.unit === 'month' && t.onDay) return `${e.n === 1 ? 'monthly' : `every ${e.n} months`} on the ${nth(t.onDay)}`;
  if (e.n === 1) return e.unit === 'day' ? 'daily' : e.unit === 'week' ? 'weekly' : 'monthly';
  if (e.n === 2 && e.unit === 'week') return 'fortnightly';
  return `every ${e.n} ${e.unit}s`;
}

/** A days-since count that has gone past its aim. */
export const pastAim = (t: TrackerItem, today: Day) => {
  if (t.kind !== 'since' || !t.aim) return false;
  const s = trackerStatus(t, today);
  return s.kind === 'since' && s.days > t.aim;
};

/** The line under a page's name: what's due, and counts past their aim. */
export function pageSummary(data: Pick<AppData, 'tasks' | 'trackers' | 'lines'>, listId: ID, today: Day): string {
  const items = pageItems(data, listId);
  const due = dueTrackers(items.flatMap((i) => (i.kind === 'repeat' ? [i.tracker] : [])), today).map((d) => d.item.name);
  const over = items.flatMap((i) => (i.kind === 'since' && pastAim(i.tracker, today) ? [i.tracker] : []))
    .map((t) => { const s = trackerStatus(t, today); return `${s.kind === 'since' ? s.days : 0} days since ${t.name.toLowerCase()}`; });
  const parts = [due.length ? `${due.slice(0, 2).join(', ')}${due.length > 2 ? ` +${due.length - 2}` : ''} due` : '', ...over.slice(0, 1)].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  const open = items.flatMap((i) => (i.kind === 'todo' && !i.task.done ? [i.task.title] : []));
  if (open.length) return open.slice(0, 2).join(', ');
  return items.length ? 'Nothing due' : 'Empty';
}

/* ---------- Dailies, gems and themes ---------- */

/** Colour themes, bought with gems. The colours themselves live in app.css under [data-palette]. */
export const PALETTES: { id: string; name: string; price: number; swatch: [string, string, string] }[] = [
  { id: 'matcha', name: 'Matcha', price: 0, swatch: ['#4B6545', '#DCE8CF', '#F6F5EE'] },
  { id: 'sakura', name: 'Sakura', price: 40, swatch: ['#B03F64', '#FBE7EC', '#FBF5F5'] },
  { id: 'hojicha', name: 'Hojicha', price: 60, swatch: ['#7A5236', '#F1E5D9', '#F8F3EC'] },
  { id: 'yuzu', name: 'Yuzu', price: 60, swatch: ['#8A6A00', '#F6EDC8', '#FBF8EC'] },
  { id: 'blueberry', name: 'Blueberry', price: 80, swatch: ['#3E5A9B', '#E3E9F6', '#F4F6FA'] },
  { id: 'lavender', name: 'Lavender', price: 80, swatch: ['#6B5A9C', '#ECE7F6', '#F7F5FA'] },
  { id: 'sumi', name: 'Sumi ink', price: 120, swatch: ['#2B2B2B', '#ECEAE5', '#F5F4F0'] },
  { id: 'koi', name: 'Koi', price: 120, swatch: ['#C2502B', '#FBE6DC', '#FBF6F2'] },
];

/**
 * Skins change more than colours: fonts, icons, corners, how blocks are drawn and how things move.
 * A skin brings its own colours, so it ignores the light/dark setting while it's on.
 */
export const SKINS: { id: string; name: string; price: number; blurb: string }[] = [
  { id: 'hearth', name: 'Pixel Hearth', price: 200, blurb: 'A cosy pixel-art inn: parchment panels in wooden frames, a pixel font, chunky icons and blocks, and steppy little animations.' },
];
export const isSkin = (id: string | null | undefined) => SKINS.some((s) => s.id === id);

export type DailyId = 'phone' | 'bank' | 'hours' | 'note';
export interface Daily { id: DailyId; name: string; gems: number; done: boolean; detail: string; progress?: number }
/** What the dailies need from outside the data: whether phone and bank review are on, and what's waiting. */
export interface DailyContext { phoneOn: boolean; phonePending: number; bankOn: boolean; bankPending: number }

/** Reviews count as finished from this hour if nothing came up to review all day. */
const EVENING = 18;

/** Minutes of a day accounted for: logged time, plus sleep before wake-up and after bedtime. */
export function dayCoverage(data: Pick<AppData, 'entries' | 'milestones'>, day: Day, now: number): number {
  const from = dayStartMs(day);
  const to = dayStartMs(addDays(day, 1));
  const spans: [number, number][] = data.entries.map((e) => [Math.max(e.start, from), Math.min(entryEnd(e, now), to)] as [number, number]).filter(([a, b]) => b > a);
  const wake = wakeOf(data.milestones, day);
  const bed = bedOf(data.milestones, day);
  if (wake) spans.push([from, from + wake.min * MIN_MS]);
  if (bed && bed.min < 24 * 60) spans.push([from + bed.min * MIN_MS, to]);
  spans.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = from;
  for (const [a, b] of spans) {
    if (b <= cursor) continue;
    covered += b - Math.max(a, cursor);
    cursor = b;
  }
  return Math.round(covered / MIN_MS);
}

/** Today's dailies that apply, finished or not. */
export function dailies(data: AppData, today: Day, now: number, c: DailyContext): Daily[] {
  const isToday = (ms: number) => toISO(new Date(ms)) === today;
  const evening = new Date(now).getHours() >= EVENING;
  const out: Daily[] = [];
  if (c.phoneOn) {
    const reviewed = data.entries.some((e) => e.source === 'device' && isToday(e.start)) || data.phoneDismissed.some((k) => isToday(Number(k.split(':')[1])));
    const done = c.phonePending === 0 && (reviewed || evening);
    out.push({ id: 'phone', name: 'Review today’s phone use', gems: 5, done, detail: c.phonePending ? `${c.phonePending} to review` : done ? 'All reviewed' : 'Nothing yet: checks again this evening' });
  }
  if (c.bankOn) {
    const reviewed = data.expenses.some((e) => e.bankKey && isToday(e.createdAt)) || data.bankDismissed.some((k) => isToday(Number(k.split(':')[1])));
    const done = c.bankPending === 0 && (reviewed || evening);
    out.push({ id: 'bank', name: 'Review today’s spends', gems: 5, done, detail: c.bankPending ? `${c.bankPending} to review` : done ? 'All reviewed' : 'Nothing yet: checks again this evening' });
  }
  const yesterday = addDays(today, -1);
  const covered = dayCoverage(data, yesterday, now);
  // A few minutes short still counts: the edges of blocks rarely meet to the minute.
  out.push({ id: 'hours', name: 'Fill in all of yesterday', gems: 10, done: covered >= 24 * 60 - 10, detail: `${Math.floor(covered / 60)} of 24 hours`, progress: Math.min(1, covered / (24 * 60)) });
  const note = data.notes.find((n) => n.day === today && n.text.trim());
  out.push({ id: 'note', name: 'Write today’s note', gems: 5, done: Boolean(note), detail: note ? 'Written' : 'A line or two at the end of the day' });
  return out;
}

/** Days in a row with every daily done, up to yesterday. Strict: one missed day starts it again. */
export function streakBefore(r: Rewards, today: Day): number {
  let n = 0;
  for (let d = addDays(today, -1); r.days[d]?.bonus; d = addDays(d, -1)) n++;
  return n;
}
export const streakNow = (r: Rewards, today: Day) => streakBefore(r, today) + (r.days[today]?.bonus ? 1 : 0);
/** The all-done bonus: 20, plus 2 for each day of the streak so far, up to 10 more. */
export const bonusFor = (streak: number) => 20 + Math.min(10, streak * 2);

/* ---------- Milestones ---------- */

export const wakeOf = (ms: Milestone[], day: Day) => ms.find((m) => m.day === day && m.kind === 'wake');
export const bedOf = (ms: Milestone[], day: Day) => ms.find((m) => m.day === day && m.kind === 'bed');

/** Average of minute values, or null with none. Bedtimes after midnight are > 1440, so they average sensibly. */
export function avgMin(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null;
}

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

/* ---------- Bank notifications ---------- */

/** A notification kept by the Android app because it showed a dollar amount. */
export interface BankNote { key: string; pkg: string; label: string; title: string; text: string; postedAt: number }
export interface BankSuggestion {
  key: string;
  day: Day;
  at: number;
  /** Cents. */
  amount: number;
  /** The shop as the notification names it, lower case. */
  merchant: string;
  app: string;
  kind: SpendKind;
  tags: string[];
  /** What the spend will be called: the shop, or your own name for it from last time. Lower case. */
  note: string;
  /** A spend of the same amount is already logged that day, so this is probably a duplicate. */
  logged: boolean;
  /** The notification it was read from, as it appeared. */
  source: { title: string; text: string };
}

/** Money coming in, or not a purchase at all. */
const NOT_SPENDING = /\b(received|receive|deposit(ed)?|refund(ed)?|credited|paid you|sent you|incoming|salary|pay ?day|transfer(red)? from|cashback|reversal|reversed|declined|balance|available|limit|reminder|due on|statement|pending|authori[sz]ation hold)\b/i;
/** Ads and offers that quote a price ("on sale for $49", "flights from $99"). */
const PROMO = /\b(sale|on sale|off|offer|offers|deal|deals|discount|save|saving|savings|promo|promotion|coupon|voucher|code|win|reward|rewards|points|bonus|free|limited|ends|ending soon|shop now|buy now|book now|order now|new arrivals|price drop|starting at|from only|only|was|subscribe|upgrade|trial|earn|exclusive|hurry|last chance|don'?t miss|up to)\b|\d+\s?%/i;
/** Words that say money actually left your account. */
const PURCHASE = /\b(purchase|purchased|spent|spend|paid|payment|charged|charge|debited|debit|transaction|tap(ped)?|contactless|approved|card ending|withdrawal|withdrew|bought)\b/i;
/** Titles that name the kind of alert rather than the shop. */
const GENERIC_TITLE = /\b(purchase|payment|paid|transaction|spent|spend|card|alert|bank|debit|credit|account|notification|approved|you)\b/i;
const AMOUNT_RE = /(?:A?\$|AUD\s?)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/;
const CARD_RE = /^(visa|mastercard|master card|amex|american express|eftpos|debit|credit|card|apple pay|google pay)\b/i;
const MERCHANT_RE =/\b(?:at|to|with|@)\s+([A-Za-z0-9][^\n]*?)(?=\s+(?:on|for|using|via|with|from|card|ending|was|has|is)\b|[.,!\n(]|\s+-\s|$)/;

/** Spend names are kept in lower case, with spaces tidied. */
export const spendName = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Reads a bank notification: how much was spent and where. Null for anything that isn't a purchase
 * (money coming in, balance alerts, declined cards).
 */
export function parseBankNote(title: string, text: string): { amount: number; merchant: string } | null {
  const all = `${title}\n${text}`;
  if (NOT_SPENDING.test(all) || PROMO.test(all)) return null;
  const a = AMOUNT_RE.exec(all);
  if (!a) return null;
  const amount = Number(a[1].replace(/,/g, '')) * 100 + Number((a[2] ?? '0').padEnd(2, '0'));
  if (!amount) return null;
  // The shop: "… at Mugi Café", or else the title when it names the shop (as wallet apps do).
  const m = MERCHANT_RE.exec(text) ?? MERCHANT_RE.exec(title);
  let merchant = m ? m[1] : '';
  // "… with Visa ••12" names the card, not the shop.
  const paidWithCard = Boolean(merchant && CARD_RE.test(merchant));
  if (merchant && (AMOUNT_RE.test(merchant) || paidWithCard)) merchant = '';
  // It has to read like a purchase: a word like "purchase" or "paid", a card, or "at" a shop.
  if (!PURCHASE.test(all) && !paidWithCard && !/\bat\s/i.test(all)) return null;
  if (!merchant && title && !GENERIC_TITLE.test(title) && !AMOUNT_RE.test(title)) merchant = title;
  return { amount, merchant: spendName(merchant).slice(0, 40) };
}

/**
 * The shape of a notification with its numbers taken out, so "Never show ones like this" can match the
 * next one that only differs by amount or date.
 */
export const bankPattern = (title: string, text: string) => spendName(`${title} ${text}`).replace(/[\d.,$]+/g, '#').slice(0, 120);

/**
 * Spends to review from kept bank notifications: newest first, leaving out ones already logged from a
 * notification or dismissed. Each starts with what you chose for that shop last time.
 */
export function bankSuggestions(
  notes: BankNote[], expenses: Expense[], merchants: Record<string, { kind: SpendKind; tags: string[]; note?: string }>, dismissed: string[],
  toDay: (ms: number) => Day, ignore: string[] = [],
): BankSuggestion[] {
  const used = new Set([...dismissed, ...expenses.map((e) => e.bankKey).filter((k): k is string => Boolean(k))]);
  const ignored = new Set(ignore);
  const out: BankSuggestion[] = [];
  // Repeats are matched against every earlier notification, including ones already approved or dismissed,
  // so a notification posted again later doesn't come back for review.
  const lastText = new Map<string, number>();
  const lastSpend = new Map<string, number>();
  for (const n of [...notes].sort((a, b) => a.postedAt - b.postedAt)) {
    const p = parseBankNote(n.title, n.text);
    if (!p || ignored.has(bankPattern(n.title, n.text))) continue;
    const textKey = `${n.pkg}|${n.title}|${n.text}`;
    const spendKey = `${p.amount}|${p.merchant}`;
    // A repeat is the very same words, amount included, within 3 hours (a notification posted again), or the
    // same amount at the same shop within 10 minutes. Same wording with a different amount is always a new spend,
    // and so is the same coffee bought again later in the day.
    const repeat = (lastText.has(textKey) && n.postedAt - lastText.get(textKey)! < 3 * 3_600_000)
      || (lastSpend.has(spendKey) && n.postedAt - lastSpend.get(spendKey)! < 10 * 60_000);
    lastText.set(textKey, n.postedAt);
    lastSpend.set(spendKey, n.postedAt);
    if (repeat || used.has(n.key)) continue;
    const day = toDay(n.postedAt);
    const memory = merchants[p.merchant];
    out.push({
      key: n.key, day, at: n.postedAt, amount: p.amount, merchant: p.merchant, app: n.label,
      kind: memory?.kind ?? 'want', tags: memory?.tags ?? [], note: memory?.note ?? p.merchant,
      logged: expenses.some((e) => e.day === day && e.amount === p.amount && !e.bankKey),
      source: { title: n.title, text: n.text },
    });
  }
  return out.reverse();
}
