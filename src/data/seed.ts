// Starting data: sensible defaults for a fresh install, plus an optional example week.
import type { AppData, Expense, Milestone, MilestoneKind, PlannedBlock, SpendKind, Task, TimeCategory, TimeEntry } from './types';
import { addDays, msAt, todayISO } from '../lib/dates';
import { uid } from '../lib/id';

/** Activities you paint the day with. Drift is for doomscrolling and dillydallying. */
export const DEFAULT_TIME_CATEGORIES: TimeCategory[] = [
  { id: 'uni', name: 'Uni', color: '#9CC488' },
  { id: 'work', name: 'Work', color: '#6E9A5E' },
  { id: 'friends', name: 'Friends', color: '#EE9BB2' },
  { id: 'transport', name: 'Transport', color: '#93B9D6' },
  { id: 'meals', name: 'Meals', color: '#F2C38B' },
  { id: 'health', name: 'Exercise', color: '#F2A68E' },
  { id: 'chores', name: 'Chores', color: '#D4C49A' },
  { id: 'rest', name: 'Rest', color: '#C9B3E6' },
  { id: 'personal', name: 'Me time', color: '#D9A3C6' },
  { id: 'drift', name: 'Drift', color: '#B8B2C2' },
];

export const DRIFT_ID = 'drift';

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
    milestones: [],
    expenses: [],
    bills: [],
    lists: [
      { id: 'uni', name: 'Uni' },
      { id: 'work', name: 'Work' },
      { id: 'personal', name: 'Personal' },
      { id: 'chores', name: 'Chores' },
    ],
    tasks: [],
    settings: { dayStartHour: 8, dayEndHour: 22, dailyGoalMin: 0, weeklyAllowance: 25000, stickers: true, theme: 'system' },
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
    if (pattern[i] === shiftDay) { mark(d, 'leave', h(8, 15)); mark(d, 'arrive', h(9)); mark(d, 'home', h(17, 30)); }
    mark(d, 'bed', beds[i]);
  }

  const planned: PlannedBlock[] = [
    { id: uid(), label: 'Gym', categoryId: 'health', day: today, startMin: h(19), endMin: h(20) },
  ];

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
    planned,
    milestones,
    expenses,
    bills: [
      { id: uid(), name: 'Phone plan', amount: 3500, kind: 'need', tags: ['bills'], cadence: 'monthly', nextDue: addDays(today, 3) },
      { id: uid(), name: 'Spotify', amount: 1399, kind: 'want', tags: ['subscriptions'], cadence: 'monthly', nextDue: addDays(today, 6) },
      { id: uid(), name: 'Gym', amount: 2200, kind: 'need', tags: ['health'], cadence: 'weekly', nextDue: addDays(today, 7) },
    ],
    tasks,
  };
}
