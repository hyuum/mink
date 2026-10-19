// The app's single source of truth: an immutable AppData snapshot, React subscriptions,
// debounced saving, and the actions every screen uses to change data.
import { useSyncExternalStore } from 'react';
import type { AppData, Bill, Expense, Folder, ID, ListItem, Milestone, PhoneSettings, PlannedBlock, Settings, SpendKind, Task, TimeCategory, TimeEntry, TrackerItem } from './types';
import { CATEGORY_COLORS, DEFAULT_TIME_CATEGORIES, OLD_DEFAULT_COLORS, defaultData, LIST_ICON, defaultFolders, sampleData } from './seed';
import { iconName } from './icons';
import { createPersistence, type Persistence, type StorageKind } from './persist';
import { isTemplatePlan, nextDue, ownPlan, paintRange, planForDay, planRange, relinkDay, templateFor, weekdayIndex } from './logic';
import { uid } from '../lib/id';
import { addDays, dayStartMs, msAt } from '../lib/dates';
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
  const timeCategories = arr(d.timeCategories, base.timeCategories).map((c) => {
    // Move untouched default colours to the matcha and sakura palette, and draw travel as an arrow.
    const def = DEFAULT_TIME_CATEGORIES.find((x) => x.id === c.id);
    if (!def) return c;
    const recolour = Boolean(OLD_DEFAULT_COLORS[c.id]?.some((x) => x.toUpperCase() === c.color?.toUpperCase()));
    return { ...c, color: recolour ? def.color : c.color, arrow: c.arrow ?? def.arrow };
  });
  if ((d.version ?? 1) < 2) {
    for (const c of DEFAULT_TIME_CATEGORIES) if (!timeCategories.some((x) => x.id === c.id)) timeCategories.push({ ...c });
  }
  // Older saves kept plans only as loose blocks: every day that has some keeps them as its own plan.
  const planned = arr(d.planned, []);
  const planDays = Array.isArray(d.planDays) ? d.planDays : Array.from(new Set(planned.map((p) => p.day)));

  return {
    version: 2,
    example: Boolean(d.example),
    timeCategories,
    entries: arr(d.entries, []),
    planned,
    templates: arr(d.templates, []),
    planDays,
    phoneDismissed: arr(d.phoneDismissed, []),
    milestones: arr(d.milestones, []),
    expenses,
    bills,
    // Folders, lists and trackers used to carry an emoji; they now carry an icon name.
    lists: arr(d.lists, base.lists).map((l) => withIcon(l, LIST_ICON[l.id] ?? 'list-checks')),
    tasks: arr(d.tasks, []),
    folders: arr(d.folders, defaultFolders()).map((f) => withIcon(f, 'folder')),
    trackers: arr(d.trackers, []).map((t) => withIcon(t, 'sparkles')),
    listItems: arr(d.listItems, []),
    settings: { ...base.settings, ...(d.settings ?? {}), phone: { ...base.settings.phone, ...(d.settings?.phone ?? {}) } },
  };
}

function withIcon<T extends { icon: string }>(x: T, fallback: string): T {
  const { emoji, ...rest } = x as T & { emoji?: string };
  return { ...rest, icon: iconName(x.icon ?? emoji, fallback) } as T;
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
const unlink = (e: TimeEntry): TimeEntry => { const { planId: _p, ...rest } = e; return rest; };
const unlinkMissing = (d: AppData): AppData => {
  const ids = new Set(d.planned.map((p) => p.id));
  return { ...d, entries: d.entries.map((e) => (e.planId && !ids.has(e.planId) && !isTemplatePlan(e.planId) ? unlink(e) : e)) };
};

/** Gives the day a plan block belongs to its own copy of its template, and returns the block's real id. */
function own(d: AppData, id: ID): { data: AppData; id: ID } {
  if (!isTemplatePlan(id)) return { data: d, id };
  const day = id.split(':')[3];
  const { data, ids } = ownPlan(d, day, uid);
  return { data, id: ids[id] ?? id };
}
const hasLogged = (d: AppData, day: string) => {
  const from = dayStartMs(day), to = dayStartMs(addDays(day, 1));
  return d.entries.some((e) => e.start >= from && e.start < to);
};

export const actions = {
  /** Put back an earlier snapshot (used by Undo). */
  restore(snapshot: AppData) {
    set(snapshot);
  },

  /* Time */
  startTimer(label: string, categoryId: ID, now = Date.now(), planId?: ID) {
    update((d) => ({
      ...d,
      entries: [
        ...d.entries.map((e) => (e.end === null ? { ...e, end: now } : e)),
        { id: uid(), label: label.trim(), categoryId, start: now, end: null, source: 'timer', ...(planId ? { planId } : {}) },
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
    update((d) => {
      const { data } = ownPlan(d, p.day, uid);
      return { ...data, planned: [...data.planned, { ...p, id: uid() }] };
    });
  },
  /** Returns the block's id, which changes when it came straight from a template. */
  updatePlanned(id: ID, patch: Partial<PlannedBlock>): ID {
    let real = id;
    update((d) => {
      const owned = own(d, id);
      real = owned.id;
      const data = patch.day ? ownPlan(owned.data, patch.day, uid).data : owned.data;
      return { ...data, planned: replace(data.planned, real, patch) };
    });
    return real;
  },
  deletePlanned(id: ID): AppData {
    const before = state;
    update((d) => {
      const { data, id: real } = own(d, id);
      return unlinkMissing({ ...data, planned: remove(data.planned, real) });
    });
    return before;
  },
  /** Start the timer for a planned block. The plan counts as done once the timer is running. */
  startPlanned(id: ID, now = Date.now()) {
    const { data, id: real } = own(state, id);
    const p = data.planned.find((x) => x.id === real);
    if (!p) return;
    set(data);
    actions.startTimer(p.label, p.categoryId, now, real);
  },
  /** Plan [from, to) minutes of a day with an activity, or clear it (null). Returns the earlier snapshot and the new block's id. */
  planPaint(day: string, from: number, to: number, categoryId: ID | null): { before: AppData; id: ID | null } {
    const before = state;
    let id: ID | null = null;
    update((d) => {
      const { data } = ownPlan(d, day, uid);
      const r = planRange(data.planned, day, from, to, categoryId, uid);
      id = r.id;
      return unlinkMissing({ ...data, planned: r.blocks });
    });
    return { before, id };
  },
  /** Fill in a planned block: logs it as planned (from `fromMin` if part was already logged), replacing anything logged in that time. */
  completePlan(planId: ID, now = Date.now(), fromMin?: number): { before: AppData; entryId: ID | null } {
    const before = state;
    let entryId: ID | null = null;
    update((d) => {
      const { data, id } = own(d, planId);
      const p = data.planned.find((x) => x.id === id);
      if (!p) return d;
      const from = msAt(p.day, Math.max(p.startMin, Math.min(p.endMin - 1, fromMin ?? p.startMin)));
      const to = msAt(p.day, p.endMin);
      entryId = uid();
      const cleared = paintRange(data.entries, from, to, null, now, uid);
      return { ...data, entries: [...cleared, { id: entryId, label: p.label, categoryId: p.categoryId, start: from, end: to, source: 'plan', planId: id }] };
    });
    return { before, entryId };
  },

  /* Phone tracking */
  /** Approve phone-use suggestions as logged blocks. */
  approvePhone(items: { key: string; start: number; end: number; categoryId: ID; label: string }[]): AppData {
    const before = state;
    update((d) => ({
      ...d,
      entries: [...d.entries, ...items.map((x) => ({ id: uid(), label: x.label, categoryId: x.categoryId, start: x.start, end: x.end, source: 'device' as const, deviceKey: x.key }))],
    }));
    return before;
  },
  /** Hide phone-use suggestions for good. Keeps the most recent 1000. */
  dismissPhone(keys: string[]): AppData {
    const before = state;
    update((d) => ({ ...d, phoneDismissed: [...d.phoneDismissed.filter((k) => !keys.includes(k)), ...keys].slice(-1000) }));
    return before;
  },
  updatePhoneSettings(patch: Partial<PhoneSettings>) {
    update((d) => ({ ...d, settings: { ...d.settings, phone: { ...d.settings.phone, ...patch } } }));
  },

  /* Day templates */
  /** Make this day's weekday follow a template (or none). The day's own plan is replaced by it. */
  setDayTemplate(day: string, templateId: ID | null): AppData {
    const before = state;
    update((d) => {
      const w = weekdayIndex(day);
      const templates = d.templates.map((t) => ({ ...t, weekdays: t.id === templateId ? [...t.weekdays.filter((x) => x !== w), w].sort() : t.weekdays.filter((x) => x !== w) }));
      let next: AppData = unlinkMissing({ ...d, templates, planned: d.planned.filter((p) => p.day !== day), planDays: d.planDays.filter((x) => x !== day) });
      // Keep what's already logged that day counting toward the new plan.
      if (hasLogged(next, day)) {
        next = ownPlan(next, day, uid).data;
        next = { ...next, entries: relinkDay(next.entries, planForDay(next, day), day) };
      }
      return next;
    });
    return before;
  },
  /** Turn a weekday on or off for a template. A weekday follows only one template. */
  toggleTemplateWeekday(templateId: ID, weekday: number) {
    update((d) => {
      const on = d.templates.find((t) => t.id === templateId)?.weekdays.includes(weekday);
      return {
        ...d,
        templates: d.templates.map((t) => ({
          ...t,
          weekdays: t.id === templateId ? (on ? t.weekdays.filter((x) => x !== weekday) : [...t.weekdays, weekday].sort()) : on ? t.weekdays : t.weekdays.filter((x) => x !== weekday),
        })),
      };
    });
  },
  /** Copy this day's plan into the template its weekday follows. Days without their own plan pick it up. */
  saveDayToTemplate(day: string) {
    update((d) => {
      const t = templateFor(d.templates, day);
      if (!t) return d;
      const blocks = planForDay(d, day).map(({ label, categoryId, startMin, endMin }) => ({ label, categoryId, startMin, endMin }));
      return { ...d, templates: replace(d.templates, t.id, { blocks }) };
    });
  },
  /** A new template from this day's plan, repeating on this day's weekday. */
  addTemplateFromDay(day: string, name: string): ID {
    const id = uid();
    update((d) => {
      const w = weekdayIndex(day);
      const blocks = planForDay(d, day).map(({ label, categoryId, startMin, endMin }) => ({ label, categoryId, startMin, endMin }));
      return { ...d, templates: [...d.templates.map((t) => ({ ...t, weekdays: t.weekdays.filter((x) => x !== w) })), { id, name, weekdays: [w], blocks }] };
    });
    return id;
  },
  renameTemplate(id: ID, name: string) {
    update((d) => ({ ...d, templates: replace(d.templates, id, { name }) }));
  },
  deleteTemplate(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, templates: remove(d.templates, id) }));
    return before;
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
  addList(name: string, icon = 'list-checks'): ID {
    const id = uid();
    update((d) => ({ ...d, lists: [...d.lists, { id, name, icon }] }));
    return id;
  },
  /** Delete a task list and its tasks. Keeps at least one list. */
  deleteList(id: ID): AppData {
    const before = state;
    update((d) => (d.lists.length < 2 ? d : { ...d, lists: remove(d.lists, id), tasks: d.tasks.filter((t) => t.listId !== id) }));
    return before;
  },

  /* Folders in More: trackers, checklists, collections, wishlists */
  addFolder(f: Omit<Folder, 'id'>): ID {
    const id = uid();
    update((d) => ({ ...d, folders: [...d.folders, { ...f, id }] }));
    return id;
  },
  updateFolder(id: ID, patch: Partial<Omit<Folder, 'id' | 'type'>>) {
    update((d) => ({ ...d, folders: replace<Folder>(d.folders, id, patch) }));
  },
  /** Delete a folder and everything in it. */
  deleteFolder(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, folders: remove(d.folders, id), trackers: d.trackers.filter((t) => t.folderId !== id), listItems: d.listItems.filter((i) => i.folderId !== id) }));
    return before;
  },
  addTracker(t: Omit<TrackerItem, 'id'>) {
    update((d) => ({ ...d, trackers: [...d.trackers, { ...t, id: uid() }] }));
  },
  updateTracker(id: ID, patch: Partial<Omit<TrackerItem, 'id'>>) {
    update((d) => ({ ...d, trackers: replace<TrackerItem>(d.trackers, id, patch) }));
  },
  deleteTracker(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, trackers: remove(d.trackers, id) }));
    return before;
  },
  /** Mark a tracker as done (or as having happened) on a day. Returns the earlier snapshot for Undo. */
  hitTracker(id: ID, day: string): AppData {
    const before = state;
    update((d) => ({ ...d, trackers: d.trackers.map((t) => (t.id === id && !t.hits.includes(day) ? { ...t, hits: [...t.hits, day].sort() } : t)) }));
    return before;
  },
  addListItem(i: Omit<ListItem, 'id' | 'createdAt'>) {
    update((d) => ({ ...d, listItems: [...d.listItems, { ...i, id: uid(), createdAt: Date.now() }] }));
  },
  updateListItem(id: ID, patch: Partial<Omit<ListItem, 'id'>>) {
    update((d) => ({ ...d, listItems: replace<ListItem>(d.listItems, id, patch) }));
  },
  deleteListItem(id: ID): AppData {
    const before = state;
    update((d) => ({ ...d, listItems: remove(d.listItems, id) }));
    return before;
  },
  clearTicked(folderId: ID): AppData {
    const before = state;
    update((d) => ({ ...d, listItems: d.listItems.filter((i) => !(i.folderId === folderId && i.done)) }));
    return before;
  },
  /** Buy something from a wishlist: logs it as a "want" expense today and takes it off the list. */
  buyWish(id: ID, today: string): AppData {
    const before = state;
    const item = state.listItems.find((i) => i.id === id);
    if (!item) return before;
    update((d) => ({
      ...d,
      listItems: remove(d.listItems, id),
      expenses: [...d.expenses, { id: uid(), amount: item.price ?? 0, kind: 'want', tags: ['wishlist'], note: item.text, day: today, createdAt: Date.now() }],
    }));
    return before;
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
    update((d) => {
      const unused = CATEGORY_COLORS.find((c) => !d.timeCategories.some((x) => x.color.toUpperCase() === c.toUpperCase()));
      const color = unused ?? CATEGORY_COLORS[d.timeCategories.length % CATEGORY_COLORS.length];
      return { ...d, timeCategories: [...d.timeCategories, { id: uid(), name, color }] };
    });
  },
  updateTimeCategory(id: ID, patch: Partial<Omit<TimeCategory, 'id'>>) {
    update((d) => ({ ...d, timeCategories: replace<TimeCategory>(d.timeCategories, id, patch) }));
  },
  /** Delete an activity. Its logged time, plans and template blocks move to `moveTo`, or are removed when it's null. */
  deleteTimeCategory(id: ID, moveTo: ID | null): AppData {
    const before = state;
    update((d) => {
      const move = <T extends { categoryId: ID }>(list: T[]) =>
        moveTo ? list.map((x) => (x.categoryId === id ? { ...x, categoryId: moveTo } : x)) : list.filter((x) => x.categoryId !== id);
      return unlinkMissing({
        ...d,
        timeCategories: remove(d.timeCategories, id),
        entries: move(d.entries),
        planned: move(d.planned),
        templates: d.templates.map((t) => ({ ...t, blocks: move(t.blocks) })),
      });
    });
    return before;
  },
  /** Start fresh: keep categories, lists and settings, clear every record. */
  startFresh() {
    update((d) => ({ ...d, example: false, entries: [], planned: [], planDays: [], milestones: [], expenses: [], bills: [], tasks: [], trackers: [], listItems: [] }));
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
