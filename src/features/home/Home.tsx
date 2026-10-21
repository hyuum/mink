import { useState, type FormEvent } from 'react';
import { actions, useData } from '../../data/store';
import { dayTotals, daySpend, dueTrackers, entriesForDay, entryEnd, parseTaskInput, runningEntry, stickersThisWeek, tasksForToday, trackerStatus, unloggedMin, upcomingBills, weekSpend } from '../../data/logic';
import { DRIFT_ID } from '../../data/seed';
import { dayStartMs, fmtClock, fmtDayLong, fmtDuration, greeting, hourLabel, isoOf, relativeDay, todayISO } from '../../lib/dates';
import { fmtMoney, fmtMoneyShort } from '../../lib/money';
import { go, moreView, showToast, useNow } from '../../app/ui-state';
import { Band, Bar, Card, CheckBox, Sticker } from '../../ui/kit';
import { IconPlus, IconStop, Sakura } from '../../ui/icons';
import { ThingIcon } from '../../ui/things';
import { BankReviewCard, useBankSuggestions } from '../money/bank';

export function Home() {
  const data = useData();
  const bank = useBankSuggestions();
  const running = runningEntry(data.entries);
  const now = useNow(running ? 1000 : 30_000);
  const today = todayISO(now);
  const cat = (id: string) => data.timeCategories.find((c) => c.id === id);

  const s = data.settings;
  const time = dayTotals(data.entries, today, now);
  const unlogged = unloggedMin(data.entries, today, s.dayStartHour, s.dayEndHour, now);
  const dayCats = data.timeCategories.filter((c) => time.byCat[c.id]).sort((a, b) => time.byCat[b.id] - time.byCat[a.id]);
  // Mini ribbon of the day, from the timeline's first to last hour.
  const r0 = dayStartMs(today) + s.dayStartHour * 3_600_000;
  const r1 = dayStartMs(today) + s.dayEndHour * 3_600_000;
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - r0) / (r1 - r0)) * 100));
  const ribbon = entriesForDay(data.entries, today, now).map((e) => ({ id: e.id, left: pct(e.start), width: pct(entryEnd(e, now)) - pct(e.start), color: cat(e.categoryId)?.color ?? '#ccc', drift: e.categoryId === DRIFT_ID })).filter((x) => x.width > 0);

  const week = weekSpend(data.expenses, today, s.weeklyAllowance, today);
  const nextBill = upcomingBills(data.bills, today)[0];

  const dueTasks = tasksForToday(data.tasks, today);
  const doneToday = data.tasks.filter((t) => t.done && t.doneAt !== null && isoOf(t.doneAt) === today);
  const stickers = data.settings.stickers ? stickersThisWeek(data, today) : [];
  // From the folders in More: routines due today, and trackers pinned to Home.
  const dueRoutines = dueTrackers(data.trackers, today);
  const pinned = data.trackers.filter((t) => t.pinned);

  const [newTask, setNewTask] = useState('');
  const addTask = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseTaskInput(newTask);
    if (!parsed.title) return;
    actions.addTask({ ...parsed, listId: data.lists[0]?.id ?? 'personal', due: today });
    setNewTask('');
  };

  return (
    <>
      <Band>
        <div className="band-row">
          <div>
            <p className="band-sub">{fmtDayLong(today)}</p>
            <h1>{greeting(now)}</h1>
          </div>
          <Sakura size={38} />
        </div>
        {data.settings.stickers && (
          <div className="stickers" aria-label={`${stickers.length} stickers this week`}>
            <span className="band-sub" style={{ marginRight: 4 }}>This week</span>
            {stickers.slice(-5).map((k, i) => <Sticker key={i} kind={k} />)}
            {stickers.length > 5 ? <span className="band-sub">+{stickers.length - 5}</span> : <span className="sticker empty-slot" aria-hidden="true" />}
          </div>
        )}
      </Band>

      <div className="content">
        <BankReviewCard suggestions={bank} />
        {(dueRoutines.length > 0 || pinned.length > 0) && (
          <button type="button" className="card home-due" onClick={() => { moreView.set({ kind: 'hub' }); go('more'); }}>
            {dueRoutines.length > 0 && <span><b>Due today</b> · {dueRoutines.map((d) => d.item.name).join(', ')}</span>}
            {pinned.map((t) => {
              const st = trackerStatus(t, today);
              return <span key={t.id} className="muted due-line"><ThingIcon name={t.icon} size={16} />{st.kind === 'since' ? `${st.days} ${st.days === 1 ? 'day' : 'days'} since ${t.name.toLowerCase()}` : st.daysLeft > 0 ? `${t.name} in ${st.daysLeft} ${st.daysLeft === 1 ? 'day' : 'days'}` : `${t.name} due`}</span>;
            })}
          </button>
        )}
        {data.example && (
          <div className="card" style={{ background: 'var(--pink-soft)' }}>
            <p style={{ fontSize: 14 }}>You're looking at an example week so you can try things out.</p>
            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={() => { actions.startFresh(); showToast('Cleared. This is your planner now.'); }}>Start with my own data</button>
            </div>
          </div>
        )}

        <Card title="Today" action={<button className="card-link" onClick={() => go('time')}>Fill in today</button>}>
          <p className="num big">{fmtDuration(time.total)} <span className="small muted" style={{ fontFamily: 'var(--font-body)' }}>logged</span></p>
          <div className="ribbon" role="img" aria-label={`Today from ${hourLabel(s.dayStartHour)} to ${hourLabel(s.dayEndHour)}: ${dayCats.map((c) => `${c.name} ${fmtDuration(time.byCat[c.id])}`).join(', ') || 'nothing logged yet'}`}>
            {ribbon.map((r) => <span key={r.id} className={r.drift ? 'drift' : ''} style={{ left: `${r.left}%`, width: `${r.width}%`, background: r.color }} />)}
            <i style={{ left: `${pct(now)}%` }} />
          </div>
          <div className="row small muted" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <span>{hourLabel(s.dayStartHour)}</span><span>{hourLabel(s.dayEndHour)}</span>
          </div>
          <div className="legend">
            {dayCats.slice(0, 5).map((c) => (
              <span key={c.id}><span className="dot" style={{ background: c.color }} />{c.name} {fmtDuration(time.byCat[c.id])}</span>
            ))}
            {unlogged > 0 && <span>Unlogged {fmtDuration(unlogged)}</span>}
          </div>
          {running && (
            <div className="running">
              <span className="pulse" />
              <div className="grow">
                <p style={{ fontSize: 14 }}>{running.label || cat(running.categoryId)?.name}</p>
                <p className="small muted">Timer running</p>
              </div>
              <span className="num" style={{ fontSize: 16 }}>{fmtClock(now - running.start)}</span>
              <button className="icon-btn" aria-label="Stop timer" onClick={() => { actions.stopTimer(); showToast('Timer stopped'); }}><IconStop size={18} /></button>
            </div>
          )}
        </Card>

        <Card title="Money this week" action={<button className="card-link" onClick={() => go('money')}>Details</button>}>
          <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <p className="num mid">{fmtMoney(week.total)}<span className="small muted" style={{ fontFamily: 'var(--font-body)' }}> of {fmtMoneyShort(week.allowance)}</span></p>
            <p className="small muted">Today {fmtMoney(daySpend(data.expenses, today))}</p>
          </div>
          <div style={{ marginTop: 8 }}>
            <Bar height={8} segments={[{ value: week.need, color: 'var(--need)' }, { value: week.want, color: 'var(--want)' }]} max={Math.max(week.allowance, week.total)} />
          </div>
          <div className="row small muted" style={{ justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap' }}>
            <span><span className="dot" style={{ background: 'var(--need)' }} />Need {fmtMoney(week.need)} <span className="dot" style={{ background: 'var(--want)', marginLeft: 8 }} />Want {fmtMoney(week.want)}</span>
            <span className={week.left < 0 ? 'warn' : ''}>{week.left >= 0 ? `${fmtMoney(week.perDayLeft)} a day left` : `${fmtMoney(-week.left)} over`}</span>
          </div>
          {nextBill && (
            <p className="small muted" style={{ marginTop: 10 }}>
              Next bill · {nextBill.bill.name} {fmtMoney(nextBill.bill.amount)} {nextBill.overdue ? <span className="warn">overdue</span> : `due ${relativeDay(nextBill.bill.nextDue, today)}`}
            </p>
          )}
        </Card>

        <Card title="Today's tasks" action={<button className="card-link" onClick={() => go('tasks')}>All tasks</button>}>
          {dueTasks.length === 0 && doneToday.length === 0 && <p className="muted" style={{ fontSize: 14, padding: '6px 0' }}>Nothing due today.</p>}
          <ul className="items">
            {[...dueTasks, ...doneToday].map((t) => (
              <li key={t.id} className={`item ${t.done ? 'is-done' : ''}`}>
                <CheckBox checked={t.done} onChange={() => actions.toggleTask(t.id)} label={`${t.done ? 'Mark not done' : 'Mark done'}: ${t.title}`} />
                <div className="grow">
                  <p className="item-title">{t.title} {t.priority > 0 && !t.done && <span className="prio">{'!'.repeat(t.priority)}</span>}</p>
                </div>
                <span className={`small ${t.due && t.due < today && !t.done ? 'warn' : 'muted'}`}>
                  {t.due && t.due < today ? relativeDay(t.due, today) : data.lists.find((l) => l.id === t.listId)?.name}
                </span>
              </li>
            ))}
          </ul>
          <form onSubmit={addTask} className="inline-input" style={{ marginTop: 8 }}>
            <label htmlFor="home-new-task" className="sr-only">Add a task for today</label>
            <input id="home-new-task" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task for today…  #tag  !!" enterKeyHint="done" />
            <button className="icon-btn" aria-label="Add task" type="submit"><IconPlus size={20} /></button>
          </form>
        </Card>
      </div>
    </>
  );
}
