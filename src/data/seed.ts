// Starting data: sensible defaults for a fresh install, plus an optional example week.
import type { AppData, DayTemplate, Expense, Folder, ListItem, Milestone, MilestoneKind, PhoneSettings, SpendKind, Task, TemplateBlock, TimeCategory, TimeEntry, TrackerItem } from './types';
import { addDays, fromISO, msAt, todayISO } from '../lib/dates';
import { uid } from '../lib/id';

/**
 * Activities you fill the day with, in the matcha and sakura palette: greens for study, work, chores and rest,
 * pinks for people, me time and exercise, cream for meals. Drift is for doomscrolling and dillydallying.
 */
export const DEFAULT_TIME_CATEGORIES: TimeCategory[] = [
  { id: 'uni', name: 'Uni', color: '#8DBA78' },
  { id: 'work', name: 'Work', color: '#6E9A5E' },
  { id: 'friends', name: 'Friends', color: '#EE9BB2' },
  { id: 'transport', name: 'Transport', color: '#ADA59B', arrow: true },
  { id: 'meals', name: 'Meals', color: '#F4DDB0' },
  { id: 'health', name: 'Exercise', color: '#E58AA6' },
  { id: 'chores', name: 'Chores', color: '#BFD6A9' },
  { id: 'rest', name: 'Rest', color: '#DCE8CF' },
  { id: 'personal', name: 'Me time', color: '#F6C3D1' },
  { id: 'drift', name: 'Drift', color: '#CFC8CB' },
];

/** Colours earlier versions used by default, so saves that never changed them move to the current palette. */
export const OLD_DEFAULT_COLORS: Record<string, string[]> = {
  uni: ['#9CC488'], work: ['#6E9A5E'], friends: ['#EE9BB2'], transport: ['#93B9D6', '#A9B8A3', '#6FAFC0'], meals: ['#F2C38B'],
  health: ['#F2A68E'], chores: ['#D4C49A'], rest: ['#C9B3E6'], personal: ['#D9A3C6'], drift: ['#B8B2C2'],
};

/** Colours you can pick for an activity, and hand out in turn to new ones. */
export const CATEGORY_COLORS = ['#8DBA78', '#6E9A5E', '#BFD6A9', '#DCE8CF', '#EE9BB2', '#E58AA6', '#F6C3D1', '#D9A3C6', '#F4DDB0', '#6FAFC0', '#ADA59B', '#CFC8CB'];

export const DRIFT_ID = 'drift';

/** The folders a fresh install starts with in More, alongside the task lists. */
export function defaultFolders(): Folder[] {
  return [
    { id: 'habits', name: 'Habits', icon: 'sprout', type: 'tracker' },
    { id: 'routines', name: 'Routines', icon: 'calendar-check', type: 'tracker' },
    { id: 'groceries', name: 'Groceries', icon: 'shopping-cart', type: 'check' },
  ];
}

export const LIST_ICON: Record<string, string> = { uni: 'graduation-cap', work: 'briefcase', personal: 'leaf', chores: 'brush' };

/** Scrolling and video apps count as Drift; music, maps, calls and the camera don't count. Everything else is Drift too. */
export function defaultPhoneSettings(): PhoneSettings {
  const drift = ['com.instagram.android', 'com.zhiliaoapp.musically', 'com.ss.android.ugc.trill', 'com.google.android.youtube', 'com.twitter.android',
    'com.reddit.frontpage', 'com.facebook.katana', 'com.snapchat.android', 'com.pinterest', 'tv.twitch.android.app', 'com.netflix.mediaclient'];
  const ignore = ['com.spotify.music', 'com.google.android.apps.youtube.music', 'com.google.android.apps.maps', 'com.google.android.dialer',
    'com.android.dialer', 'com.google.android.deskclock', 'com.google.android.GoogleCamera', 'com.sec.android.app.camera', 'com.samsung.android.dialer'];
  return {
    enabled: false, minMin: 5, gapMin: 2, defaultCategoryId: 'drift',
    apps: Object.fromEntries([...drift.map((p) => [p, 'drift']), ...ignore.map((p) => [p, null])]),
  };
}

export const MILESTONE_KINDS: { kind: MilestoneKind; name: string }[] = [
  { kind: 'wake', name: 'Wake up' },
  { kind: 'leave', name: 'Leave home' },
  { kind: 'arrive', name: 'Arrive' },
  { kind: 'lunch', name: 'Lunch' },
  { kind: 'home', name: 'Home' },
  { kind: 'bed', name: 'Bed' },
];

export function defaultData(): AppData {
  return {
    version: 2,
    example: false,
    timeCategories: DEFAULT_TIME_CATEGORIES.map((c) => ({ ...c })),
    entries: [],
    planned: [],
    templates: [],
    planDays: [],
    phoneDismissed: [],
    milestones: [],
    expenses: [],
    bills: [],
    lists: [
      { id: 'uni', name: 'Uni', icon: LIST_ICON.uni },
      { id: 'work', name: 'Work', icon: LIST_ICON.work },
      { id: 'personal', name: 'Personal', icon: LIST_ICON.personal },
      { id: 'chores', name: 'Chores', icon: LIST_ICON.chores },
    ],
    tasks: [],
    folders: defaultFolders(),
    trackers: [],
    listItems: [],
    settings: { dayStartHour: 8, dayEndHour: 22, dailyGoalMin: 0, weeklyAllowance: 25000, stickers: true, theme: 'system', phone: defaultPhoneSettings() },
  };
}

const h = (hh: number, mm = 0) => hh * 60 + mm;

/** A believable example fortnight, relative to `now`, for trying the app out. */
export function sampleData(now: number = Date.now()): AppData {
  const data = defaultData();
  const today = todayISO(now);
  const entries: TimeEntry[] = [];
  const block = (dayOffset: number, from: number, to: number, categoryId: string, label = '') => {
    const day = addDays(today, dayOffset);
    const start = msAt(day, from);
    const end = Math.min(msAt(day, to), now);
    if (start >= end) return;
    entries.push({ id: uid(), label, categoryId, start, end, source: 'paint' });
  };

  // Weekday with uni and a café shift.
  const shiftDay = (d: number) => {
    block(d, h(8), h(8, 45), 'transport'); block(d, h(9), h(11), 'uni', 'COMP2521 lecture'); block(d, h(11), h(11, 30), 'drift');
    block(d, h(11, 30), h(12, 15), 'meals'); block(d, h(12, 15), h(12, 45), 'transport'); block(d, h(13), h(17), 'work', 'Shift at Mugi Café');
    block(d, h(17), h(17, 30), 'transport'); block(d, h(17, 30), h(18, 30), 'drift'); block(d, h(18, 30), h(19, 15), 'meals');
    block(d, h(20), h(21), 'rest');
  };
  // Study day at home.
  const studyDay = (d: number) => {
    block(d, h(9), h(9, 45), 'drift'); block(d, h(9, 45), h(12), 'uni', 'Readings'); block(d, h(12), h(12, 45), 'meals');
    block(d, h(12, 45), h(14, 15), 'drift'); block(d, h(14, 15), h(16), 'uni', 'Lab prep'); block(d, h(16), h(16, 30), 'chores');
    block(d, h(17), h(18), 'health', 'Gym'); block(d, h(18, 15), h(19), 'meals'); block(d, h(19), h(21, 30), 'friends', 'Call with Jess');
  };
  const weekend = (d: number) => {
    block(d, h(10), h(11), 'drift'); block(d, h(11), h(11, 30), 'transport'); block(d, h(11, 30), h(14), 'friends', 'Market with Jess');
    block(d, h(14), h(14, 30), 'transport'); block(d, h(15), h(16), 'chores', 'Laundry'); block(d, h(16), h(17), 'personal', 'Sketching');
    block(d, h(18), h(19), 'meals'); block(d, h(19), h(20, 30), 'rest');
  };
  const pattern = [shiftDay, studyDay, shiftDay, studyDay, weekend, weekend, studyDay];
  for (let d = -13; d <= 0; d++) pattern[(d + 14) % 7](d);

  // Templates that match the example's rhythm, each on the weekdays it fell on.
  const tb = (from: number, to: number, categoryId: string, label = ''): TemplateBlock => ({ label, categoryId, startMin: from, endMin: to });
  const shiftPlan = [tb(h(8), h(8, 45), 'transport'), tb(h(9), h(11), 'uni', 'COMP2521 lecture'), tb(h(11, 30), h(12, 15), 'meals'), tb(h(12, 15), h(12, 45), 'transport'),
    tb(h(13), h(17), 'work', 'Shift at Mugi Café'), tb(h(17), h(17, 30), 'transport'), tb(h(18, 30), h(19, 15), 'meals'), tb(h(20), h(21), 'rest')];
  const studyPlan = [tb(h(9, 30), h(12), 'uni', 'Readings'), tb(h(12), h(12, 45), 'meals'), tb(h(13), h(16), 'uni', 'Lab prep'), tb(h(16), h(16, 30), 'chores'),
    tb(h(17), h(18), 'health', 'Gym'), tb(h(18, 15), h(19), 'meals'), tb(h(19), h(20), 'personal')];
  const slowPlan = [tb(h(10, 30), h(11), 'chores'), tb(h(11, 30), h(14), 'friends'), tb(h(15), h(16), 'chores', 'Laundry'), tb(h(16), h(17), 'personal', 'Sketching'), tb(h(18), h(19), 'meals')];
  const weekdayOf = (d: number) => (fromISO(addDays(today, d)).getDay() + 6) % 7;
  const daysFor = (fn: (d: number) => void) => Array.from({ length: 7 }, (_, i) => i - 6).filter((d) => pattern[(d + 14) % 7] === fn).map(weekdayOf);
  const templates: DayTemplate[] = [
    { id: uid(), name: 'Shift day', weekdays: daysFor(shiftDay), blocks: shiftPlan },
    { id: uid(), name: 'Study day', weekdays: daysFor(studyDay), blocks: studyPlan },
    { id: uid(), name: 'Slow day', weekdays: daysFor(weekend), blocks: slowPlan },
  ];

  // Milestones: wake and bed every day, plus leave / arrive / home on shift days.
  const milestones: Milestone[] = [];
  const mark = (dayOffset: number, kind: MilestoneKind, min: number) => {
    const day = addDays(today, dayOffset);
    if (msAt(day, Math.min(min, 1439)) + Math.max(0, min - 1439) * 60_000 > now) return;
    milestones.push({ id: uid(), kind, label: '', day, min });
  };
  const wakes = [h(7, 10), h(8, 40), h(7, 5), h(9, 15), h(9, 50), h(10, 5), h(8, 55)];
  const beds = [h(23, 20), h(23, 50), h(23, 5), h(23, 45), h(24, 30), h(24, 40), h(22, 50)];
  for (let d = -13; d <= 0; d++) {
    const i = (d + 14) % 7;
    mark(d, 'wake', wakes[i]);
    mark(d, 'bed', beds[i]);
  }

  const spend: [number, number, SpendKind, string[], string][] = [
    [0, 520, 'want', ['coffee'], 'Coffee · Mugi Café'],
    [-1, 3845, 'need', ['groceries'], 'Groceries · Coles'], [-1, 2000, 'need', ['transport'], 'Opal top-up'],
    [-2, 1890, 'want', ['friends'], 'Movie ticket'], [-3, 1450, 'want', ['takeaway'], 'Dumplings'],
    [-4, 4599, 'want', ['clothes'], 'Linen tote'], [-5, 650, 'want', ['treats'], 'Bubble tea'],
    [-6, 3500, 'need', ['bills'], 'Phone plan'], [-7, 5230, 'need', ['groceries'], 'Groceries · Aldi'],
    [-8, 2000, 'need', ['transport'], 'Opal top-up'], [-9, 2400, 'want', ['friends'], 'Karaoke'],
    [-10, 1299, 'need', ['uni'], 'Notebook & pens'], [-12, 3110, 'need', ['groceries'], 'Groceries · Coles'],
    [-14, 1800, 'want', ['takeaway'], 'Ramen'], [-15, 2000, 'need', ['transport'], 'Opal top-up'], [-17, 900, 'want', ['coffee'], 'Coffee & cake'],
  ];
  const expenses: Expense[] = spend.map(([d, amount, kind, tags, note], i) => ({
    id: uid(), amount, kind, tags, note, day: addDays(today, d), createdAt: now - i * 1000,
  }));

  const task = (title: string, listId: string, due: number | null, priority: 0 | 1 | 2 = 0, tags: string[] = [], done = false): Task => ({
    id: uid(), title, listId, tags, priority, due: due === null ? null : addDays(today, due), done, doneAt: done ? now - 3_600_000 : null, createdAt: now,
  });
  const tasks: Task[] = [
    task('Lab 4 report', 'uni', 0, 2, ['lab4']),
    task('Email tutor about extension', 'uni', 0),
    task('Buy laundry powder', 'chores', 0, 0, [], true),
    task('Water plants', 'chores', 2, 0, ['weekly']),
    task('Book dentist', 'personal', 3),
    task('Submit café timesheet', 'work', 4, 2),
    task('COMP2521 quiz prep', 'uni', 5, 1, ['exam']),
    task('Return library books', 'uni', 14),
    task('Learn sourdough', 'personal', null, 0, ['someday']),
  ];

  return {
    ...data,
    example: true,
    entries,
    templates,
    milestones,
    expenses,
    bills: [
      { id: uid(), name: 'Phone plan', amount: 3500, kind: 'need', tags: ['bills'], cadence: 'monthly', nextDue: addDays(today, 3) },
      { id: uid(), name: 'Spotify', amount: 1399, kind: 'want', tags: ['subscriptions'], cadence: 'monthly', nextDue: addDays(today, 6) },
      { id: uid(), name: 'Gym', amount: 2200, kind: 'need', tags: ['health'], cadence: 'weekly', nextDue: addDays(today, 7) },
    ],
    tasks,
    trackers: sampleTrackers(today),
    listItems: sampleListItems(now),
    folders: [...defaultFolders(), { id: 'books', name: 'Books', icon: 'book-open', type: 'collect' }, { id: 'wishlist', name: 'Wishlist', icon: 'gift', type: 'wish' }],
  };
}

function sampleTrackers(today: string): TrackerItem[] {
  const ago = (...ns: number[]) => ns.map((n) => addDays(today, -n)).sort();
  const t = (folderId: string, name: string, icon: string, kind: 'since' | 'every', hits: string[], extra: Partial<TrackerItem> = {}): TrackerItem =>
    ({ id: uid(), folderId, name, icon, kind, hits, since: addDays(today, -60), ...extra });
  return [
    t('habits', 'Doomscrolling past midnight', 'smartphone', 'since', ago(12, 20, 23, 30, 41), { pinned: true }),
    t('habits', 'Gym', 'dumbbell', 'every', ago(1, 3, 6, 8, 11, 14, 16, 19), { every: { n: 3, unit: 'day' } }),
    t('habits', 'Bubble tea', 'cup-soda', 'since', ago(4, 9, 15, 22)),
    t('habits', 'Call home', 'phone', 'every', ago(9, 17, 24), { every: { n: 1, unit: 'week' } }),
    t('routines', 'Laundry', 'shirt', 'every', ago(6, 13, 20, 27), { every: { n: 1, unit: 'week' } }),
    t('routines', 'Water plants', 'sprout', 'every', ago(3, 6, 9, 13), { every: { n: 3, unit: 'day' } }),
    t('routines', 'Change bedsheets', 'bed-double', 'every', ago(10, 24), { every: { n: 2, unit: 'week' } }),
    // Rent was paid on the 1st of this month and last month.
    t('routines', 'Pay rent', 'banknote', 'every', [addDays(today, -(fromISO(today).getDate() - 1) - 30), addDays(today, -(fromISO(today).getDate() - 1))].sort(), { every: { n: 1, unit: 'month' }, onDay: 1 }),
  ];
}

function sampleListItems(now: number): ListItem[] {
  const item = (folderId: string, text: string, extra: Partial<ListItem> = {}): ListItem => ({ id: uid(), folderId, text, createdAt: now, ...extra });
  return [
    item('groceries', 'Oat milk'), item('groceries', 'Eggs', { done: true }), item('groceries', 'Matcha powder'), item('groceries', 'Rice'),
    item('books', 'Piranesi', { status: 'doing' }), item('books', 'Tomorrow, and Tomorrow, and Tomorrow', { status: 'done', stars: 5 }), item('books', 'The Remains of the Day', { status: 'want' }),
    item('wishlist', 'Ceramic matcha bowl', { price: 3800 }), item('wishlist', 'Film camera', { price: 12000 }),
  ];
}
