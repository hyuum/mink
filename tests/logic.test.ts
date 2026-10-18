import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, fmtClock, fmtDuration, fmtHM, msAt, weekStart } from '../src/lib/dates.ts';
import { fmtMoney, parseAmount, pressKey } from '../src/lib/money.ts';
import { avgMin, bedMinFromClock, milestoneName, milestonesForDay, dayTotals, groupTasks, monthSpend, nextDue, paintRange, parseTaskInput, rangeSummary, unloggedMin, upcomingBills, weekDays, weekSpend, stickersThisWeek, tasksForToday } from '../src/data/logic.ts';
import { defaultData, sampleData } from '../src/data/seed.ts';
import { migrate } from '../src/data/store.ts';
import type { Expense, Task, TimeEntry } from '../src/data/types.ts';

test('dates', () => {
  assert.equal(weekStart('2026-10-12'), '2026-10-12'); // Monday
  assert.equal(weekStart('2026-10-18'), '2026-10-12'); // Sunday belongs to the same week
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(fmtDuration(135), '2h 15m');
  assert.equal(fmtDuration(60), '1h');
  assert.equal(fmtDuration(5), '5m');
  assert.equal(fmtClock(908_000), '0:15:08');
  assert.equal(fmtHM(13 * 60 + 5), '1:05 pm');
  assert.equal(fmtHM(0), '12:00 am');
});

test('money', () => {
  assert.equal(fmtMoney(64280), '$642.80');
  assert.equal(fmtMoney(-520), '−$5.20');
  assert.equal(parseAmount('12.5'), 1250);
  assert.equal(parseAmount('$1,200'), 120000);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('1.234'), null);
  let v = '';
  for (const k of ['0', '1', '2', '.', '5', '0', '9']) v = pressKey(v, k);
  assert.equal(v, '12.50');
  assert.equal(pressKey('12.5', 'del'), '12.');
  assert.equal(pressKey('12.5', '.'), '12.5');
});

test('time totals clip to the day and count running timers', () => {
  const day = '2026-10-12';
  const entries: TimeEntry[] = [
    { id: 'a', label: 'Lecture', categoryId: 'uni', start: msAt(day, 9 * 60), end: msAt(day, 10 * 60 + 30) },
    { id: 'b', label: 'Night', categoryId: 'personal', start: msAt('2026-10-11', 23 * 60), end: msAt(day, 60) },
    { id: 'c', label: 'Reading', categoryId: 'uni', start: msAt(day, 11 * 60), end: null },
  ];
  const now = msAt(day, 11 * 60 + 15);
  const t = dayTotals(entries, day, now);
  assert.equal(t.total, 90 + 60 + 15);
  assert.equal(t.byCat.uni, 105);
  assert.equal(t.byCat.personal, 60);
  const w = rangeSummary(entries, weekDays(day), now);
  assert.equal(w.days.length, 7);
  assert.equal(w.days[0].day, '2026-10-12');
});

test('bills roll forward and sort by due date', () => {
  assert.equal(nextDue('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(nextDue('2026-10-15', 'monthly'), '2026-11-15');
  assert.equal(nextDue('2026-10-12', 'fortnightly'), '2026-10-26');
  assert.equal(nextDue('2028-02-29', 'yearly'), '2029-02-28');
  const bills = [
    { id: '1', name: 'Later', amount: 1, kind: 'need' as const, tags: [], cadence: 'monthly' as const, nextDue: '2026-11-30' },
    { id: '2', name: 'Soon', amount: 1, kind: 'need' as const, tags: [], cadence: 'monthly' as const, nextDue: '2026-10-15' },
    { id: '3', name: 'Late', amount: 1, kind: 'need' as const, tags: [], cadence: 'monthly' as const, nextDue: '2026-10-10' },
  ];
  const up = upcomingBills(bills, '2026-10-12');
  assert.deepEqual(up.map((u) => u.bill.name), ['Late', 'Soon']);
  assert.equal(up[0].overdue, true);
});

test('task input parsing', () => {
  assert.deepEqual(parseTaskInput('Lab report #uni #Lab4 !!'), { title: 'Lab report', tags: ['uni', 'lab4'], priority: 2 });
  assert.deepEqual(parseTaskInput('Call mum !'), { title: 'Call mum', tags: [], priority: 1 });
  assert.deepEqual(parseTaskInput('C# homework'), { title: 'C# homework', tags: [], priority: 0 });
});

test('task grouping', () => {
  const mk = (id: string, due: string | null, extra: Partial<Task> = {}): Task => ({
    id, title: id, listId: 'uni', tags: [], priority: 0, due, done: false, doneAt: null, createdAt: 0, ...extra,
  });
  const today = '2026-10-12';
  const groups = groupTasks([
    mk('old', '2026-10-01'), mk('now', today), mk('urgent', today, { priority: 2 }), mk('fri', '2026-10-16'),
    mk('far', '2026-12-01'), mk('none', null), mk('finished', today, { done: true, doneAt: 5 }),
  ], today);
  assert.deepEqual(groups.map((g) => g.key), ['overdue', 'today', 'week', 'later', 'someday', 'done']);
  assert.deepEqual(groups[1].tasks.map((t) => t.id), ['urgent', 'now']);
  assert.deepEqual(tasksForToday(groups.flatMap((g) => g.tasks), today).map((t) => t.id), ['urgent', 'old', 'now']);
});

test('sample data is consistent and stickers count', () => {
  const now = msAt('2026-10-12', 11 * 60 + 15);
  const s = sampleData(now);
  assert.equal(s.example, true);
  assert.equal(s.entries.filter((e) => e.end === null).length, 0);
  assert.ok(s.entries.some((e) => e.categoryId === 'drift'));
  for (const e of s.entries) assert.ok(e.end === null || e.end > e.start, e.label);
  const ids = new Set(s.timeCategories.map((c) => c.id));
  for (const e of s.entries) assert.ok(ids.has(e.categoryId));
  assert.ok(stickersThisWeek(s, '2026-10-12').length >= 1);
});

test('migrate fills missing fields and converts money categories', () => {
  const m = migrate({
    version: 1, entries: [], tasks: [], settings: { dayStartHour: 7 },
    timeCategories: [{ id: 'uni', name: 'Study', color: '#000' }],
    moneyCategories: [{ id: 'food', name: 'Food' }, { id: 'fun', name: 'Fun' }],
    expenses: [{ id: 'x', amount: 500, categoryId: 'food', note: '', day: '2026-10-12', createdAt: 0 }, { id: 'y', amount: 900, categoryId: 'fun', note: '', day: '2026-10-12', createdAt: 0 }],
  });
  assert.equal(m.version, 2);
  assert.equal(m.settings.dayStartHour, 7);
  assert.equal(m.settings.weeklyAllowance, defaultData().settings.weeklyAllowance);
  assert.ok(m.lists.length > 0);
  assert.equal(m.timeCategories[0].name, 'Study'); // renamed category kept
  assert.ok(m.timeCategories.some((c) => c.id === 'drift'));
  assert.deepEqual(m.expenses.map((e) => [e.kind, e.tags]), [['need', ['food']], ['want', ['fun']]]);
  assert.ok(!('categoryId' in m.expenses[0]));
});

test('painting trims, splits, merges and erases', () => {
  const day = '2026-10-12';
  const at = (hh: number, mm = 0) => msAt(day, hh * 60 + mm);
  let n = 0;
  const id = () => `n${n++}`;
  const now = at(23);
  let e: TimeEntry[] = [{ id: 'lec', label: 'Lecture', categoryId: 'uni', start: at(9), end: at(12) }];
  // Paint drift over the middle of the lecture: it splits into two.
  e = paintRange(e, at(10), at(10, 30), 'drift', now, id);
  assert.deepEqual(e.map((x) => [x.categoryId, (x.end! - x.start) / 60000]), [['uni', 60], ['drift', 30], ['uni', 90]]);
  // Painting more drift right after merges into one block.
  e = paintRange(e, at(10, 30), at(11), 'drift', now, id);
  assert.deepEqual(e.map((x) => [x.categoryId, (x.end! - x.start) / 60000]), [['uni', 60], ['drift', 60], ['uni', 60]]);
  // Erasing leaves a gap, which counts as unlogged.
  e = paintRange(e, at(11), at(12), null, now, id);
  assert.equal(e.length, 2);
  assert.equal(unloggedMin(e, day, 9, 12, now), 60);
  assert.equal(unloggedMin(e, day, 9, 12, at(10)), 0); // only counts up to now
  // A running timer keeps running after the painted range.
  const run: TimeEntry[] = [{ id: 'r', label: '', categoryId: 'uni', start: at(13), end: null }];
  const r = paintRange(run, at(13), at(13, 15), 'meals', at(14), id);
  assert.deepEqual(r.map((x) => [x.categoryId, x.end === null]), [['meals', false], ['uni', true]]);
});

test('weekly allowance, need/want split and month = 4 weeks', () => {
  const mk = (day: string, amount: number, kind: 'need' | 'want', tags: string[] = []): Expense => ({ id: day + amount, amount, kind, tags, note: '', day, createdAt: 0 });
  const ex = [mk('2026-10-12', 1000, 'need', ['groceries']), mk('2026-10-14', 500, 'want', ['coffee']), mk('2026-10-18', 2500, 'want'), mk('2026-10-19', 700, 'need'), mk('2026-09-30', 900, 'want')];
  const w = weekSpend(ex, '2026-10-15', 25000, '2026-10-15');
  assert.equal(w.start, '2026-10-12');
  assert.deepEqual([w.total, w.need, w.want], [4000, 1000, 3000]);
  assert.equal(w.left, 21000);
  assert.equal(w.daysLeft, 4); // Thu, Fri, Sat, Sun
  assert.equal(w.perDayLeft, 5250);
  assert.deepEqual(w.byTag.map((t) => t.tag), ['groceries', 'coffee']);
  assert.equal(w.untagged, 2500);
  assert.equal(weekSpend(ex, '2026-10-05', 25000, '2026-10-15').daysLeft, 0);
  const m = monthSpend(ex, '2026-10', 25000);
  assert.equal(m.allowance, 100000);
  assert.equal(m.total, 4700);
  assert.equal(m.weeks[0].start, '2026-09-28');
  assert.equal(m.weeks[0].total, 0); // Sept 30 is outside October
  assert.equal(m.weeks.reduce((s, x) => s + x.total, 0), 4700);
});

test('milestones: names, ordering, bedtimes past midnight', () => {
  assert.equal(milestoneName({ kind: 'wake', label: '' }), 'Wake up');
  assert.equal(milestoneName({ kind: 'custom', label: 'Meds' }), 'Meds');
  assert.equal(bedMinFromClock(30), 24 * 60 + 30);
  assert.equal(bedMinFromClock(23 * 60), 23 * 60);
  assert.equal(avgMin([23 * 60, 25 * 60]), 24 * 60); // 11 pm and 1 am average to midnight
  assert.equal(avgMin([]), null);
  const ms = [{ id: 'b', kind: 'bed' as const, label: '', day: '2026-10-12', min: 1470 }, { id: 'w', kind: 'wake' as const, label: '', day: '2026-10-12', min: 430 }];
  assert.deepEqual(milestonesForDay(ms, '2026-10-12').map((m) => m.id), ['w', 'b']);
  const s = sampleData(msAt('2026-10-12', 20 * 60));
  assert.ok(s.milestones.some((m) => m.kind === 'wake' && m.day === '2026-10-12'));
  assert.ok(!s.milestones.some((m) => m.kind === 'bed' && m.day === '2026-10-12')); // not bedtime yet
});

test('a day shows its weekday template until it gets its own plan', async () => {
  const { planForDay, ownPlan, planRange, isTemplatePlan, weekdayIndex } = await import('../src/data/logic.ts');
  const d = defaultData();
  d.templates = [{ id: 't1', name: 'Uni day', weekdays: [0], blocks: [{ label: '', categoryId: 'uni', startMin: 540, endMin: 660 }, { label: '', categoryId: 'transport', startMin: 480, endMin: 525 }] }];
  assert.equal(weekdayIndex('2026-10-12'), 0); // Monday
  const monday = planForDay(d, '2026-10-12');
  assert.deepEqual(monday.map((p) => p.startMin), [480, 540]);
  assert.ok(isTemplatePlan(monday[0].id));
  assert.equal(planForDay(d, '2026-10-13').length, 0);

  let n = 0;
  const { data, ids } = ownPlan(d, '2026-10-12', () => `p${++n}`);
  assert.deepEqual(data.planDays, ['2026-10-12']);
  assert.equal(ids[monday[0].id], 'p1');
  assert.ok(planForDay(data, '2026-10-12').every((p) => !isTemplatePlan(p.id)));
  // Changing the template no longer changes a day with its own plan.
  data.templates[0].blocks = [];
  assert.equal(planForDay(data, '2026-10-12').length, 2);

  // Planning over the middle of a block splits it.
  const r = planRange(data.planned, '2026-10-12', 570, 600, 'meals', () => `p${++n}`);
  assert.deepEqual(r.blocks.filter((p) => p.categoryId === 'uni').map((p) => [p.startMin, p.endMin]), [[540, 570], [600, 660]]);
  assert.equal(r.blocks.find((p) => p.id === r.id)?.categoryId, 'meals');
});

test('filling a plan logs it and marks it done; logged time relinks to a new plan', async () => {
  const { actions, getData } = await import('../src/data/store.ts');
  const { donePlanIds, planForDay, relinkDay } = await import('../src/data/logic.ts');
  const day = '2026-10-12';
  const d = defaultData();
  d.templates = [{ id: 't1', name: 'Uni day', weekdays: [0], blocks: [{ label: 'Lecture', categoryId: 'uni', startMin: 540, endMin: 660 }] }];
  d.entries = [{ id: 'x', label: '', categoryId: 'drift', start: msAt(day, 600), end: msAt(day, 630) }];
  actions.restore(d);
  const planId = planForDay(getData(), day)[0].id;
  const { entryId } = actions.completePlan(planId, msAt(day, 23 * 60));
  const after = getData();
  const made = after.entries.find((e) => e.id === entryId)!;
  assert.equal(made.label, 'Lecture');
  assert.equal(made.start, msAt(day, 540));
  assert.ok(!after.entries.some((e) => e.id === 'x'), 'logged time under the plan is replaced');
  assert.ok(after.planDays.includes(day));
  assert.ok(donePlanIds(after.entries).has(made.planId!));

  const plan = [{ id: 'q', label: '', categoryId: 'uni', day, startMin: 560, endMin: 640 }];
  assert.equal(relinkDay(after.entries, plan, day).find((e) => e.id === entryId)?.planId, 'q');
});

test('migrate gives old saves plan days, the new palette and travel arrows', () => {
  const m = migrate({
    version: 2, entries: [], tasks: [],
    planned: [{ id: 'p', label: '', categoryId: 'uni', day: '2026-10-12', startMin: 60, endMin: 120 }],
    timeCategories: [{ id: 'uni', name: 'Uni', color: '#9CC488' }, { id: 'transport', name: 'Bus', color: '#123456' }],
  });
  assert.deepEqual(m.planDays, ['2026-10-12']);
  assert.deepEqual(m.templates, []);
  assert.equal(m.timeCategories.find((c) => c.id === 'uni')?.color, '#8DBA78');
  const t = m.timeCategories.find((c) => c.id === 'transport')!;
  assert.equal(t.color, '#123456', 'a colour you picked yourself stays');
  assert.equal(t.arrow, true);
});

test('deleting an activity moves its time, plans and template blocks', async () => {
  const { actions, getData } = await import('../src/data/store.ts');
  const d = defaultData();
  d.entries = [{ id: 'e', label: '', categoryId: 'chores', start: 0, end: 60_000 }];
  d.planned = [{ id: 'p', label: '', categoryId: 'chores', day: '2026-10-12', startMin: 60, endMin: 120 }];
  d.planDays = ['2026-10-12'];
  d.templates = [{ id: 't', name: 'X', weekdays: [], blocks: [{ label: '', categoryId: 'chores', startMin: 0, endMin: 30 }] }];
  actions.restore(d);
  actions.deleteTimeCategory('chores', 'rest');
  const a = getData();
  assert.ok(!a.timeCategories.some((c) => c.id === 'chores'));
  assert.equal(a.entries[0].categoryId, 'rest');
  assert.equal(a.planned[0].categoryId, 'rest');
  assert.equal(a.templates[0].blocks[0].categoryId, 'rest');
  actions.restore(d);
  actions.deleteTimeCategory('chores', null);
  assert.equal(getData().entries.length, 0);
  assert.equal(migrate({ version: 2, entries: [], tasks: [], timeCategories: [{ id: 'transport', name: 'Transport', color: '#A9B8A3' }] }).timeCategories[0].color, '#ADA59B');
});

test('phone sessions become suggestions: ignored apps drop, short gaps join, logged time is cut out', async () => {
  const { phoneSuggestions } = await import('../src/data/logic.ts');
  const { defaultPhoneSettings } = await import('../src/data/seed.ts');
  const day = '2026-10-12';
  const at = (h: number, m = 0) => msAt(day, h * 60 + m);
  const s = { ...defaultPhoneSettings(), enabled: true };
  const sessions = [
    { pkg: 'com.instagram.android', label: 'Instagram', start: at(9, 0), end: at(9, 20) },
    { pkg: 'com.google.android.youtube', label: 'YouTube', start: at(9, 21), end: at(9, 40) }, // 1 min gap: joins
    { pkg: 'com.spotify.music', label: 'Spotify', start: at(10), end: at(11) }, // doesn't count
    { pkg: 'com.instagram.android', label: 'Instagram', start: at(12), end: at(12, 3) }, // too short
    { pkg: 'com.whatsapp', label: 'WhatsApp', start: at(14), end: at(14, 30) }, // unknown app: default (Drift)
  ];
  const logged: TimeEntry[] = [{ id: 'x', label: '', categoryId: 'uni', start: at(14, 10), end: at(14, 20) }];
  const out = phoneSuggestions(sessions, logged, s, [], at(20));
  assert.deepEqual(out.map((x) => [(x.start - at(0)) / 60_000, (x.end - at(0)) / 60_000]), [[540, 580], [840, 850], [860, 870]]);
  assert.equal(out[0].categoryId, 'drift');
  assert.deepEqual(out[0].apps.map((a) => a.label), ['Instagram', 'YouTube']);
  assert.equal(phoneSuggestions(sessions, logged, s, [out[0].key], at(20)).length, 2, 'dismissed ones stay hidden');
  assert.equal(phoneSuggestions(sessions, logged, { ...s, defaultCategoryId: null }, [], at(20)).length, 1, 'unknown apps can be left out');
});
