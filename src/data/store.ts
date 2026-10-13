// The app's single source of truth: an immutable AppData snapshot, React subscriptions,
// debounced saving, and the actions every screen uses to change data.
import { useSyncExternalStore } from 'react';
import type { AppData, Bill, Expense, ID, Milestone, PlannedBlock, Settings, SpendKind, Task, TimeEntry } from './types';
import { DEFAULT_TIME_CATEGORIES, defaultData, sampleData } from './seed';
import { createPersistence, type Persistence, type StorageKind } from './persist';
import { nextDue, paintRange } from './logic';
import { uid } from '../lib/id';
import type { Day } from './types';

let state: AppData = defaultData();
let ready = false;
let persistence: Persistence | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export let storageKind: StorageKind = 'memory';

function emit() {
  for (const l of listeners) l();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

function flush() {
  clearTimeout(saveTimer);
  persistence?.save(state).catch(() => undefined);
}

function set(next: AppData) {
  state = next;
  emit();
  scheduleSave();
}

function update(fn: (d: AppData) => AppData) {
  set(fn(state));
}

type OldCategory = { id: string; name: string };
const NEED_IDS = new Set(['food', 'transport', 'bills']);
const tagOf = (name?: string) => (name ? [name.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '')].filter(Boolean) : []);

/** Fill in anything an older save is missing, so new fields never crash old data. */
export function migrate(raw: unknown): AppData {
  const base = defaultData();
  const d = (raw ?? {}) as Partial<AppData> & { version?: number; moneyCategories?: OldCategory[] };
  const arr = <T,>(v: T[] | undefined, fallback: T[]) => (Array.isArray(v) ? v : fallback);
  const oldCats = arr(d.moneyCategories, []);
  const catName = (id?: string) => oldCats.find((c) => c.id === id)?.name;

  // Version 1 had money categories with budgets. Version 2 has need/want plus optional tags.
  type Legacy = { categoryId?: string; kind?: SpendKind; tags?: string[] };
  const kindOf = (x: Legacy): SpendKind => x.kind ?? (x.categoryId && !NEED_IDS.has(x.categoryId) ? 'want' : 'need');
  const tagsOf = (x: Legacy) => (Array.isArray(x.tags) ? x.tags : tagOf(catName(x.categoryId)));
  const expenses = arr(d.expenses, []).map((e) => {
    const { categoryId: _c, ...rest } = e as Expense & Legacy;
    return { ...rest, kind: kindOf(e as Legacy), tags: tagsOf(e as Legacy) };
  });
  const bills = arr(d.bills, []).map((b) => {
    const { categoryId: _c, ...rest } = b as Bill & Legacy;
    return { ...rest, kind: kindOf(b as Legacy), tags: tagsOf(b as Legacy) };
  });

  // Add the new default activities (Friends, Transport, Drift…) that older saves don't have.
  const timeCategories = arr(d.timeCategories, base.timeCategories);
  if ((d.version ?? 1) < 2) {
    for (const c of DEFAULT_TIME_CATEGORIES) if (!timeCategories.some((x) => x.id === c.id)) timeCategories.push({ ...c });
  }

  return {
    version: 2,
    example: Boolean(d.example),
    timeCategories,
    entries: arr(d.entries, []),
    planned: arr(d.planned, []),
    milestones: arr(d.milestones, []),
    expenses,
    bills,
    lists: arr(d.lists, base.lists),
    tasks: arr(d.tasks, []),
    settings: { ...base.settings, ...(d.settings ?? {}) },
  };
}

export async function initStore(): Promise<void> {
  try {
    persistence = await createPersistence();
    storageKind = persistence.kind;
    const loaded = await persistence.load();
    state = loaded ? migrate(loaded) : sampleData();
  } catch {
    state = sampleData();
  }
  ready = true;
  emit();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useData(): AppData {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function useReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}

export const getData = () => state;

/* ---------- Actions ---------- */

const replace = <T extends { id: ID }>(list: T[], id: ID, patch: Partial<T>) => list.map((x) => (x.id === id ? { ...x, ...patch } : x));
const remove = <T extends { id: ID }>(list: T[], id: ID) => list.filter((x) => x.id !== id);

export const actions = {
  /** Put back an earlier snapshot (used by Undo). */
  restore(snapshot: AppData) {
    set(snapshot);
  },

  /* Time */
  startTimer(label: string, categoryId: ID, now = Date.now()) {
    update((d) => ({
      ...d,
      entries: [
        ...d.entries.map((e) => (e.end === null ? { ...e, end: now } : e)),
        { id: uid(), label: label.trim(), categoryId, start: now, end: null, source: 'timer' },
      ],
    }));
  },
  stopTimer(now = Date.now()) {
    update((d) => ({ ...d, entries: d.entries.map((e) => (e.end === null ? { ...e, end: Math.max(now, e.start + 60_000) } : e)) }));
  },
  addEntry(e: Omit<TimeEntry, 'id'>) {
    update((d) => ({ ...d, entries: [...d.entries, { source: 'manual', ...e, id: uid() }] }));
  },
  /** Paint a range of the timeline with an activity, or erase it (null). Returns the earlier snapshot for Undo. */
  paint(from: number, to: number, categoryId: ID | null, now = Date.now()): AppData {
    const before = state;
    update((d) => ({ ...d, entries: paintRange(d.entries, from, to, categoryId, now, uid) }));
    return before;
  },
  updateEntry(id: ID, patch: Partial<TimeEntry>) {
    update((d) => ({ ...d, entries: replace(d.entries, id, patch) }));
  },
  deleteEntry(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, entries: remove(d.entries, id) }));
    return before;
  },
  addPlanned(p: Omit<PlannedBlock, 'id'>) {
    update((d) => ({ ...d, planned: [...d.planned, { ...p, id: uid() }] }));
  },
  updatePlanned(id: ID, patch: Partial<PlannedBlock>) {
    update((d) => ({ ...d, planned: replace(d.planned, id, patch) }));
  },
  deletePlanned(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, planned: remove(d.planned, id) }));
    return before;
  },
  /** Start the timer for a planned block; the plan becomes a real entry. */
  startPlanned(id: ID, now = Date.now()) {
    const p = state.planned.find((x) => x.id === id);
    if (!p) return;
    actions.startTimer(p.label, p.categoryId, now);
    update((d) => ({ ...d, planned: remove(d.planned, id) }));
  },

  /* Milestones */
  addMilestone(m: Omit<Milestone, 'id'>) {
    // One wake-up and one bedtime per day: adding another replaces it.
    const single = m.kind === 'wake' || m.kind === 'bed';
    update((d) => ({ ...d, milestones: [...d.milestones.filter((x) => !(single && x.kind === m.kind && x.day === m.day)), { ...m, id: uid() }] }));
  },
  updateMilestone(id: ID, patch: Partial<Milestone>) {
    update((d) => ({ ...d, milestones: replace(d.milestones, id, patch) }));
  },
  deleteMilestone(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, milestones: remove(d.milestones, id) }));
    return before;
  },

  /* Money */
  addExpense(e: Omit<Expense, 'id' | 'createdAt'>) {
    update((d) => ({ ...d, expenses: [...d.expenses, { ...e, id: uid(), createdAt: Date.now() }] }));
  },
  updateExpense(id: ID, patch: Partial<Expense>) {
    update((d) => ({ ...d, expenses: replace(d.expenses, id, patch) }));
  },
  deleteExpense(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, expenses: remove(d.expenses, id) }));
    return before;
  },
  addBill(b: Omit<Bill, 'id'>) {
    update((d) => ({ ...d, bills: [...d.bills, { ...b, id: uid() }] }));
  },
  updateBill(id: ID, patch: Partial<Bill>) {
    update((d) => ({ ...d, bills: replace(d.bills, id, patch) }));
  },
  deleteBill(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, bills: remove(d.bills, id) }));
    return before;
  },
  /** Record a bill as paid today: logs the expense and moves the due date on. */
  payBill(id: ID, today: Day): AppData {
    const before = state;
    const bill = state.bills.find((b) => b.id === id);
    if (!bill) return before;
    update((d) => ({
      ...d,
      expenses: [...d.expenses, { id: uid(), amount: bill.amount, kind: bill.kind, tags: bill.tags, note: bill.name, day: today, billId: bill.id, createdAt: Date.now() }],
      bills: replace(d.bills, id, { nextDue: nextDue(bill.nextDue, bill.cadence) }),
    }));
    return before;
  },

  /* Tasks */
  addTask(t: Pick<Task, 'title' | 'listId'> & Partial<Task>) {
    update((d) => ({
      ...d,
      tasks: [...d.tasks, { tags: [], priority: 0, due: null, done: false, doneAt: null, ...t, id: uid(), createdAt: Date.now() }],
    }));
  },
  updateTask(id: ID, patch: Partial<Task>) {
    update((d) => ({ ...d, tasks: replace(d.tasks, id, patch) }));
  },
  toggleTask(id: ID, now = Date.now()) {
    update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : now } : t)) }));
  },
  deleteTask(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, tasks: remove(d.tasks, id) }));
    return before;
  },
  addList(name: string) {
    update((d) => ({ ...d, lists: [...d.lists, { id: uid(), name }] }));
  },
  renameList(id: ID, name: string) {
    update((d) => ({ ...d, lists: replace(d.lists, id, { name }) }));
  },

  /* Settings & data */
  updateSettings(patch: Partial<Settings>) {
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  },
  renameTimeCategory(id: ID, name: string) {
    update((d) => ({ ...d, timeCategories: replace(d.timeCategories, id, { name }) }));
  },
  addTimeCategory(name: string) {
    const colors = ['#9CC488', '#EE9BB2', '#F2B8A0', '#C9B3E6', '#6E9A5E', '#E9C46A'];
    update((d) => ({ ...d, timeCategories: [...d.timeCategories, { id: uid(), name, color: colors[d.timeCategories.length % colors.length] }] }));
  },
  /** Start fresh: keep categories, lists and settings, clear every record. */
  startFresh() {
    update((d) => ({ ...d, example: false, entries: [], planned: [], milestones: [], expenses: [], bills: [], tasks: [] }));
  },
  loadExample() {
    const s = sampleData();
    set({ ...s, settings: state.settings });
  },
  importData(raw: unknown): boolean {
    const d = raw as (Omit<Partial<AppData>, "version"> & { version?: number }) | null;
    if (!d || (d.version !== 1 && d.version !== 2) || !Array.isArray(d.entries) || !Array.isArray(d.tasks)) return false;
    set({ ...migrate(d), example: false });
    return true;
  },
};
