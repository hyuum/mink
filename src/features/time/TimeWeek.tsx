// Week spread, Jibun Techo style: seven thin day columns, sleep shaded, and dotted lines joining
// wake-up times and bedtimes across the week. You can paint straight into any column.
import { useRef } from 'react';
import { useData } from '../../data/store';
import { avgMin, bedOf, donePlanIds, entriesForDay, entryEnd, planForDay, rangeSummary, wakeOf, weekDays } from '../../data/logic';
import { DRIFT_ID } from '../../data/seed';
import { addDays, dayNum, dayStartMs, fmtDuration, fmtHM, minutesOfDay, monthOf, monthShort, todayISO, weekStart, weekdayLong, weekdayShort } from '../../lib/dates';
import { ERASE, go, timeDay, useNow } from '../../app/ui-state';
import { Band, Card } from '../../ui/kit';
import { IconLeft, IconMoon, IconRight, IconSun } from '../../ui/icons';
import { PaintDock } from './PaintDock';
import { SLOT, usePainter } from './usePainter';
import { TimeTabs } from './TimeTabs';
import { fmtMilestone } from './Milestones';

const HP = 30; // px per hour
const GUT = 30; // hour labels
const PAD_R = 6;
const TOP = 6;

export function TimeWeek() {
  const data = useData();
  const now = useNow(60_000);
  const today = todayISO(now);
  const anchor = timeDay.use() ?? today;
  const days = weekDays(anchor);
  const ws = weekStart(anchor);
  const we = addDays(ws, 6);
  const grid = useRef<HTMLDivElement>(null);
  const cat = (id: string) => data.timeCategories.find((c) => c.id === id);
  const s = data.settings;

  const H0 = Math.min(6, s.dayStartHour);
  const H1 = 25; // to 1 am, so late bedtimes still show
  const y = (min: number) => TOP + ((Math.max(H0 * 60, Math.min(H1 * 60, min)) - H0 * 60) / 60) * HP;
  const height = TOP + (H1 - H0) * HP + 6;
  const colLeft = (i: number) => `calc(${GUT}px + (100% - ${GUT + PAD_R}px) * ${i} / 7)`;
  const colWidth = `calc((100% - ${GUT + PAD_R}px) / 7)`;

  const wakes = days.map((d) => wakeOf(data.milestones, d)?.min ?? null);
  const beds = days.map((d) => bedOf(data.milestones, d)?.min ?? null);
  const avgWake = avgMin(wakes.filter((v): v is number => v !== null));
  const avgBed = avgMin(beds.filter((v): v is number => v !== null));
  const sum = rangeSummary(data.entries, days, now);
  const done = donePlanIds(data.entries);
  const weekCats = data.timeCategories.filter((c) => sum.byCat[c.id]).sort((a, b) => sum.byCat[b.id] - sum.byCat[a.id]);

  const { brush, drag, handlers } = usePainter((x, py, fixedDay) => {
    const el = grid.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const colW = (r.width - GUT - PAD_R) / 7;
    const i = Math.floor((x - r.left - GUT) / colW);
    if (!fixedDay && (i < 0 || i > 6)) return null;
    const m = H0 * 60 + Math.floor((((py - r.top - TOP) / HP) * 60) / SLOT) * SLOT;
    return { day: fixedDay ?? days[i], min: Math.min(Math.max(m, H0 * 60), 24 * 60 - SLOT) };
  }, (id) => cat(id)?.name ?? '');
  const brushCat = brush && brush !== ERASE ? cat(brush) : undefined;

  const openDay = (d: string) => { timeDay.set(d === today ? null : d); go('time'); };
  const isCurrent = ws === weekStart(today);

  // Points for the sleep lines, in a 7-wide coordinate space stretched over the columns.
  const line = (vals: (number | null)[]) => vals.map((v, i) => (v === null ? null : `${i + 0.5},${y(v)}`)).filter(Boolean).join(' ');

  return (
    <>
      <Band>
        <div className="band-row">
          <h1>Time</h1>
          <TimeTabs current="week" />
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" aria-label="Previous week" onClick={() => timeDay.set(addDays(anchor, -7))}><IconLeft size={18} /></button>
          <span className="num" style={{ fontSize: 17 }}>{isCurrent ? 'This week' : `${dayNum(ws)} ${monthShort(monthOf(ws))} – ${dayNum(we)} ${monthShort(monthOf(we))}`}</span>
          <button className="icon-btn" aria-label="Next week" onClick={() => timeDay.set(addDays(anchor, 7))}><IconRight size={18} /></button>
          <span className="band-sub row" style={{ marginLeft: 'auto', gap: 10 }}>
            {avgWake !== null && <span className="row" style={{ gap: 4 }} title="Average wake-up"><IconSun size={13} />{fmtMilestone(avgWake)}</span>}
            {avgBed !== null && <span className="row" style={{ gap: 4 }} title="Average bedtime"><IconMoon size={13} />{fmtMilestone(avgBed)}</span>}
          </span>
        </div>
      </Band>

      <div className="content">
        <div className="card spread-card">
          <div className="spread-head" style={{ paddingLeft: GUT, paddingRight: PAD_R }}>
            {days.map((d) => (
              <button key={d} type="button" className={`spread-day ${d === today ? 'today' : ''}`} aria-label={`Open ${weekdayLong(d)} ${dayNum(d)}`} onClick={() => openDay(d)}>
                <small>{weekdayShort(d).slice(0, 1)}</small><b>{dayNum(d)}</b>
              </button>
            ))}
          </div>
          <div className={`spread ${brush ? 'painting' : ''}`} ref={grid} style={{ height }}>
            {Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i).map((h) => (
              <div key={h}>
                {h % 3 === 0 && <span className="spread-hour" style={{ top: y(h * 60) - 6, width: GUT - 6 }}>{h === 12 ? '12p' : h === 24 ? '12a' : h > 12 ? h - 12 : h === 6 ? '6a' : h}</span>}
                <span className={`spread-line ${h % 3 === 0 ? 'major' : ''}`} style={{ top: y(h * 60), left: GUT, right: PAD_R }} />
              </div>
            ))}
            {days.map((d, i) => {
              const wk = wakes[i], bd = beds[i];
              const start = dayStartMs(d);
              const toMin = (ms: number) => (ms - start) / 60_000;
              return (
                <div key={d} className={`spread-col ${d === today ? 'today' : ''}`} style={{ left: colLeft(i), width: colWidth }}>
                  {wk !== null && <span className="sleep-band" style={{ top: y(H0 * 60), height: y(wk) - y(H0 * 60) }} />}
                  {bd !== null && <span className="sleep-band" style={{ top: y(bd), height: y(H1 * 60) - y(bd) }} />}
                  {entriesForDay(data.entries, d, now).map((e) => {
                    const a = Math.max(H0 * 60, toMin(e.start));
                    const b = Math.min(24 * 60, toMin(entryEnd(e, now)));
                    if (b <= a) return null;
                    return <span key={e.id} className={`spread-blk ${e.categoryId === DRIFT_ID ? 'drift' : ''}`} title={`${e.label || cat(e.categoryId)?.name} · ${fmtHM(a)}–${fmtHM(b)}`} style={{ top: y(a) + 0.5, height: Math.max(1.5, y(b) - y(a) - 1), background: cat(e.categoryId)?.color }} />;
                  })}
                  {planForDay(data, d).filter((p) => !done.has(p.id) && (d > today || (d === today && p.endMin > minutesOfDay(now)))).map((p) => (
                    <span key={p.id} className="spread-blk planned" style={{ top: y(p.startMin) + 0.5, height: y(p.endMin) - y(p.startMin) - 1, borderColor: cat(p.categoryId)?.color }} />
                  ))}
                  {d === today && <span className="spread-now" style={{ top: y(minutesOfDay(now)) }} />}
                  {drag && drag.day === d && (
                    <span className={`spread-preview ${brush === ERASE ? 'erase' : ''}`} style={{ top: y(Math.min(drag.a, drag.b)), height: y(Math.max(drag.a, drag.b) + SLOT) - y(Math.min(drag.a, drag.b)), background: brushCat?.color }} />
                  )}
                </div>
              );
            })}
            <svg className="sleep-lines" viewBox={`0 0 7 ${height}`} preserveAspectRatio="none" style={{ left: GUT, right: PAD_R, height }} role="img" aria-label={`Wake-up and bedtime lines. Average wake-up ${avgWake !== null ? fmtMilestone(avgWake) : 'not logged'}, average bedtime ${avgBed !== null ? fmtMilestone(avgBed) : 'not logged'}.`}>
              <polyline points={line(wakes)} fill="none" stroke="var(--wake)" strokeWidth={1.6} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
              <polyline points={line(beds)} fill="none" stroke="var(--bed)" strokeWidth={1.6} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
            </svg>
            {days.map((d, i) => (
              <span key={d}>
                {wakes[i] !== null && <span className="sleep-dot wake" style={{ top: y(wakes[i]!) - 4, left: `calc(${colLeft(i)} + ${colWidth} / 2 - 4px)` }} title={`Up ${fmtMilestone(wakes[i]!)}`} />}
                {beds[i] !== null && <span className="sleep-dot bed" style={{ top: y(beds[i]!) - 4, left: `calc(${colLeft(i)} + ${colWidth} / 2 - 4px)` }} title={`Bed ${fmtMilestone(beds[i]!)}`} />}
              </span>
            ))}
            {brush && <div className="paint-layer" aria-hidden="true" style={{ left: GUT, right: PAD_R }} {...handlers} />}
          </div>
        </div>

        <Card title={isCurrent ? 'This week so far' : 'That week'} action={<button className="card-link" onClick={() => go('stats')}>More stats</button>}>
          <p className="num mid">{fmtDuration(sum.total)}</p>
          <div className="legend" style={{ marginTop: 10 }}>
            {weekCats.map((c) => <span key={c.id}><span className={`dot ${c.id === DRIFT_ID ? 'drift' : ''}`} style={{ background: c.color }} />{c.name} {fmtDuration(sum.byCat[c.id])}</span>)}
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            <span><span className="sleep-dot wake inline" />Wake up</span>
            <span><span className="sleep-dot bed inline" />Bed</span>
            <span><span className="dot sleep-swatch" />Asleep</span>
          </div>
        </Card>
        <p className="small muted" style={{ padding: '0 4px' }}>Tap a day to open it. Pick a colour below to paint straight onto the week.</p>
        <div className="dock-spacer" aria-hidden="true" />
      </div>
      <PaintDock />
    </>
  );
}
