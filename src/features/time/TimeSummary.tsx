import { useState } from 'react';
import { useData } from '../../data/store';
import { monthDays, rangeSummary, runningEntry, weekDays } from '../../data/logic';
import { addDays, addMonths, dayNum, fmtDuration, fromISO, monthName, monthOf, monthShort, todayISO, weekStart, weekdayShort } from '../../lib/dates';
import { useNow } from '../../app/ui-state';
import { TimeTabs } from './TimeTabs';
import { DRIFT_ID } from '../../data/seed';
import { Band, Bar, Card } from '../../ui/kit';
import { IconLeft, IconRight } from '../../ui/icons';

export function TimeSummary() {
  const data = useData();
  const now = useNow(runningEntry(data.entries) ? 10_000 : 60_000);
  const today = todayISO(now);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(today);
  const cats = data.timeCategories;

  const days = mode === 'week' ? weekDays(anchor) : monthDays(monthOf(anchor));
  const sum = rangeSummary(data.entries, days, now);
  const elapsed = days.filter((d) => d <= today).length || 1;
  const busiest = [...sum.days].sort((a, b) => b.total - a.total)[0];

  const ws = weekStart(anchor);
  const we = addDays(ws, 6);
  const rangeLabel = mode === 'week'
    ? `${dayNum(ws)} ${monthShort(monthOf(ws))} – ${dayNum(we)} ${monthShort(monthOf(we))}`
    : `${monthName(monthOf(anchor))} ${anchor.slice(0, 4)}`;
  const isCurrent = mode === 'week' ? ws === weekStart(today) : monthOf(anchor) === monthOf(today);
  const step = (n: number) => setAnchor(mode === 'week' ? addDays(anchor, 7 * n) : `${addMonths(monthOf(anchor), n)}-01`);

  const maxDay = Math.max(60, ...sum.days.map((d) => d.total));
  const BAR_H = 124;

  return (
    <>
      <Band>
        <div className="band-row">
          <h1>Time</h1>
          <TimeTabs current="stats" />
        </div>
        <div className="band-row">
          <button className="icon-btn" aria-label={`Previous ${mode}`} onClick={() => step(-1)}><IconLeft size={18} /></button>
          <div style={{ textAlign: 'center' }}>
            <div className="seg" role="tablist" aria-label="Range" style={{ display: 'inline-flex', marginBottom: 6 }}>
              <button role="tab" aria-selected={mode === 'week'} onClick={() => setMode('week')}>Week</button>
              <button role="tab" aria-selected={mode === 'month'} onClick={() => setMode('month')}>Month</button>
            </div>
            <p className="band-sub">{isCurrent ? (mode === 'week' ? 'This week' : 'This month') : rangeLabel}</p>
            <p className="num" style={{ fontSize: 36, lineHeight: 1.1 }}>{fmtDuration(sum.total)}</p>
            <p className="band-sub">{isCurrent ? rangeLabel + ' · ' : ''}avg {fmtDuration(sum.total / elapsed)} a day</p>
          </div>
          <button className="icon-btn" aria-label={`Next ${mode}`} onClick={() => step(1)}><IconRight size={18} /></button>
        </div>
      </Band>

      <div className="content two">
        {mode === 'week' ? (
          <Card title="Hours per day">
            <figure className="bars" style={{ margin: 0 }} aria-label={`Hours logged per day: ${sum.days.map((d) => `${weekdayShort(d.day)} ${fmtDuration(d.total)}`).join(', ')}`} role="img">
              {sum.days.map((d) => (
                <div className="col" key={d.day}>
                  <span>{d.total > 0 ? (d.total / 60).toFixed(d.total % 60 === 0 ? 0 : 1) : ''}</span>
                  <div className="stackbar">
                    {cats.map((c) => d.byCat[c.id] ? <span key={c.id} style={{ height: (d.byCat[c.id] / maxDay) * BAR_H, background: c.color }} /> : null)}
                  </div>
                  <span style={{ color: d.day === today ? 'var(--accent)' : undefined, fontWeight: d.day === today ? 700 : 400 }}>{weekdayShort(d.day).slice(0, 1)}</span>
                </div>
              ))}
            </figure>
            <div className="legend">
              {cats.filter((c) => sum.byCat[c.id]).map((c) => <span key={c.id}><span className="dot" style={{ background: c.color }} />{c.name}</span>)}
              <span style={{ marginLeft: 'auto' }}>hours</span>
            </div>
          </Card>
        ) : (
          <Card title="Each day">
            <div className="heat" role="img" aria-label="Calendar of hours logged each day this month">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <span key={i} className="small muted" style={{ height: 18 }}>{w}</span>)}
              {Array.from({ length: (fromISO(days[0]).getDay() + 6) % 7 }, (_, i) => <span key={`b${i}`} />)}
              {sum.days.map((d) => {
                const level = d.total === 0 ? 0 : Math.min(4, Math.ceil((d.total / maxDay) * 4));
                const bg = level === 0 ? 'var(--track)' : `color-mix(in srgb, var(--green) ${25 + level * 18}%, var(--card))`;
                return (
                  <span key={d.day} title={`${d.day}: ${fmtDuration(d.total)}`} style={{ background: bg, outline: d.day === today ? '2px solid var(--accent)' : undefined, color: level >= 3 ? 'var(--ink)' : 'var(--muted)' }}>
                    {dayNum(d.day)}
                  </span>
                );
              })}
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>Darker days have more time logged.</p>
          </Card>
        )}

        <Card title="By category">
          {sum.total === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>Nothing logged yet.</p>
          ) : (
            <div className="stack">
              {cats.filter((c) => sum.byCat[c.id]).sort((a, b) => sum.byCat[b.id] - sum.byCat[a.id]).map((c) => {
                const v = sum.byCat[c.id];
                return (
                  <div key={c.id}>
                    <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                      <span>{c.name}</span>
                      <span className="muted">{fmtDuration(v)} · {Math.round((v / sum.total) * 100)}%</span>
                    </div>
                    <div style={{ marginTop: 4 }}><Bar segments={[{ value: v, color: c.color }]} max={sum.total} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {(sum.byCat[DRIFT_ID] ?? 0) > 0 && (
          <div className="card" style={{ background: 'var(--soft)', boxShadow: 'none' }}>
            <p className="small" style={{ color: 'var(--green-strong)' }}>Drift {mode === 'week' ? 'this week' : 'this month'}</p>
            <p className="num" style={{ fontSize: 18 }}>{fmtDuration(sum.byCat[DRIFT_ID])} · about {fmtDuration(Math.round(sum.byCat[DRIFT_ID] / elapsed))} a day</p>
            <p className="small muted" style={{ marginTop: 2 }}>Doomscrolling and dillydallying you painted in.</p>
          </div>
        )}

        {busiest && busiest.total > 0 && (
          <div className="card" style={{ background: 'var(--soft)', boxShadow: 'none' }}>
            <p className="small" style={{ color: 'var(--green-strong)' }}>Busiest day</p>
            <p className="num" style={{ fontSize: 18 }}>{weekdayShort(busiest.day)} {dayNum(busiest.day)} · {fmtDuration(busiest.total)}</p>
          </div>
        )}
      </div>
    </>
  );
}
