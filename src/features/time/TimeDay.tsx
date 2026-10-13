// The day timeline. Pick an activity in the dock, then drag down the day to paint what you did,
// 15 minutes at a time. Blank time stays blank: that's unlogged. Milestones sit on top.
import { useEffect, useMemo, useRef, useState } from 'react';
import { actions, useData } from '../../data/store';
import { bedOf, dayTotals, entriesForDay, entryEnd, milestoneName, milestonesForDay, runningEntry, unloggedMin, wakeOf, weekDays } from '../../data/logic';
import { DRIFT_ID } from '../../data/seed';
import { addDays, dayNum, dayStartMs, fmtClock, fmtDuration, fmtHM, hourLabel, minutesOfDay, todayISO, weekdayShort, weekdayLong } from '../../lib/dates';
import { ERASE, showToast, timeDay, useNow } from '../../app/ui-state';
import { Band, Bar, Card } from '../../ui/kit';
import { IconLeft, IconRight, IconStop } from '../../ui/icons';
import { EntryEditor, type EditTarget } from './EntryEditor';
import { PaintDock } from './PaintDock';
import { SLOT, usePainter } from './usePainter';
import { FlagButton, MilestoneEditor, MilestoneIcon, fmtMilestone, type MilestoneTarget } from './Milestones';
import { Dial } from './Dial';
import { TimeTabs } from './TimeTabs';

const HOUR_PX = 52;
const TOP_PAD = 12;
const GUTTER = 58;

interface Placed {
  key: string;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
  render: () => { title: string; sub: string; color: string; planned: boolean; live: boolean; drift: boolean; target: EditTarget };
}

/** Assigns side-by-side lanes to overlapping blocks (painted blocks never overlap; plans and timers can). */
function layout(items: Omit<Placed, 'lane' | 'lanes'>[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const close = () => { for (const p of cluster) p.lanes = laneEnds.length; cluster = []; laneEnds = []; };
  for (const it of sorted) {
    if (it.startMin >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= it.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endMin); } else laneEnds[lane] = it.endMin;
    const p = { ...it, lane, lanes: 1 };
    cluster.push(p);
    out.push(p);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  close();
  return out;
}

export function TimeDay() {
  const data = useData();
  const running = runningEntry(data.entries);
  const now = useNow(running ? 1000 : 30_000);
  const today = todayISO(now);
  const day = timeDay.use() ?? today;
  const setDay = (d: string) => timeDay.set(d === today ? null : d);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [mEdit, setMEdit] = useState<MilestoneTarget>(null);
  const [extra, setExtra] = useState({ before: 0, after: 0 });
  const [dial, setDial] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const cat = (id: string) => data.timeCategories.find((c) => c.id === id);
  const s = data.settings;

  const entries = entriesForDay(data.entries, day, now);
  const planned = data.planned.filter((p) => p.day === day);
  const miles = milestonesForDay(data.milestones, day);
  const wake = wakeOf(data.milestones, day);
  const bed = bedOf(data.milestones, day);
  const totals = dayTotals(data.entries, day, now);
  const unlogged = unloggedMin(data.entries, day, s.dayStartHour, s.dayEndHour, day === today ? now : Infinity);
  const dayStart = dayStartMs(day);

  const placed = useMemo(() => layout([
    ...entries.map((e) => {
      const st = Math.max(0, (e.start - dayStart) / 60_000);
      const t = Math.min(24 * 60, (entryEnd(e, now) - dayStart) / 60_000);
      const c = cat(e.categoryId);
      return {
        key: e.id, startMin: st, endMin: Math.max(t, st + 1),
        render: () => ({
          title: e.label || c?.name || 'Untitled',
          sub: `${fmtHM(st)} – ${e.end === null ? 'now' : fmtHM(t)}${e.label && c ? ` · ${c.name}` : ''}`,
          color: c?.color ?? '#ccc', planned: false, live: e.end === null, drift: e.categoryId === DRIFT_ID, target: { kind: 'entry', id: e.id } as EditTarget,
        }),
      };
    }),
    ...planned.map((p) => ({
      key: p.id, startMin: p.startMin, endMin: p.endMin,
      render: () => ({ title: p.label || cat(p.categoryId)?.name || 'Planned', sub: `${fmtHM(p.startMin)} – ${fmtHM(p.endMin)} · planned`, color: cat(p.categoryId)?.color ?? '#ccc', planned: true, live: false, drift: false, target: { kind: 'planned', id: p.id } as EditTarget }),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [data, day, Math.floor(now / 60_000)]);

  let h0 = s.dayStartHour - extra.before;
  let h1 = s.dayEndHour + extra.after;
  for (const p of placed) { h0 = Math.min(h0, Math.floor(p.startMin / 60)); h1 = Math.max(h1, Math.ceil(p.endMin / 60)); }
  for (const m of miles) { h0 = Math.min(h0, Math.floor(m.min / 60)); h1 = Math.max(h1, Math.min(24, Math.ceil((m.min + 1) / 60))); }
  h0 = Math.max(0, h0); h1 = Math.min(24, Math.max(h1, h0 + 1));
  const top = (min: number) => TOP_PAD + ((min - h0 * 60) / 60) * HOUR_PX;
  const hours = Array.from({ length: h1 - h0 }, (_, i) => h0 + i);
  const nowMin = day === today ? minutesOfDay(now) : null;

  // Open on "now" (or the first block) the first time the day is shown.
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const target = nowMin ?? placed[0]?.startMin ?? h0 * 60;
    const y = el.getBoundingClientRect().top + window.scrollY + top(target) - window.innerHeight * 0.4;
    window.scrollTo({ top: Math.max(0, y) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const { brush, drag, handlers } = usePainter((_x, y) => {
    const el = grid.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const m = h0 * 60 + Math.floor((((y - r.top - TOP_PAD) / HOUR_PX) * 60) / SLOT) * SLOT;
    return { day, min: Math.min(Math.max(m, h0 * 60), h1 * 60 - SLOT) };
  }, (id) => cat(id)?.name ?? '');

  const brushCat = brush && brush !== ERASE ? cat(brush) : undefined;
  const dayCats = data.timeCategories.filter((c) => totals.byCat[c.id]).sort((a, b) => totals.byCat[b.id] - totals.byCat[a.id]);
  const clampTop = (min: number) => top(Math.max(h0 * 60, Math.min(h1 * 60, min)));

  return (
    <>
      <Band>
        <div className="band-row">
          <h1>Time</h1>
          <div className="row" style={{ gap: 6 }}>
            <FlagButton onClick={() => setMEdit({ day })} />
            <TimeTabs current="time" />
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" aria-label="Previous week" onClick={() => setDay(addDays(day, -7))}><IconLeft size={18} /></button>
          <div className="days grow">
            {weekDays(day).map((d) => (
              <button key={d} className="day" aria-pressed={d === day} aria-label={`${weekdayLong(d)} ${dayNum(d)}`} onClick={() => setDay(d)}>
                <small>{weekdayShort(d)}</small>
                <b>{dayNum(d)}</b>
                {d === today && d !== day && <span className="has" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <button className="icon-btn" aria-label="Next week" onClick={() => setDay(addDays(day, 7))}><IconRight size={18} /></button>
        </div>
      </Band>

      <div className="content">
        {running && (
          <div className="card row">
            <span className="pulse" />
            <div className="grow">
              <p style={{ fontSize: 14 }}>{running.label || cat(running.categoryId)?.name}</p>
              <p className="small muted">Timer running</p>
            </div>
            <span className="num" style={{ fontSize: 18 }}>{fmtClock(now - running.start)}</span>
            <button className="btn" onClick={() => { actions.stopTimer(); showToast('Timer stopped'); }}><IconStop size={14} /> Stop</button>
          </div>
        )}

        <div className="card" style={{ padding: '4px 0 6px' }}>
          <div className="row small muted" style={{ justifyContent: 'space-between', padding: '8px 16px 4px', flexWrap: 'wrap', gap: '2px 10px' }}>
            <span>{fmtDuration(totals.total)} logged{unlogged > 0 && ` · ${fmtDuration(unlogged)} unlogged`}{wake ? ` · up ${fmtMilestone(wake.min)}` : ''}</span>
            {day !== today && <button className="card-link" onClick={() => setDay(today)}>Back to today</button>}
            {h0 > 0 && <button className="card-link" onClick={() => setExtra({ ...extra, before: extra.before + 2 })}>Show earlier</button>}
          </div>
          <div className={`timeline ${brush ? 'painting' : ''}`} ref={grid} style={{ height: TOP_PAD + hours.length * HOUR_PX + 8 }}>
            {hours.map((hr) => (
              <div className="hour" key={hr} style={{ height: HOUR_PX }}>
                <span className="hour-label">{hourLabel(hr)}</span>
                <button className="hour-slot" tabIndex={brush ? -1 : 0} aria-label={`Add a block at ${hourLabel(hr)}`} onClick={() => setEdit({ kind: 'new', day, startMin: hr * 60 })} />
              </div>
            ))}
            {wake && wake.min > h0 * 60 && <div className="sleep-band" style={{ top: top(h0 * 60), height: clampTop(wake.min) - top(h0 * 60) }} aria-hidden="true" />}
            {bed && bed.min < h1 * 60 && <div className="sleep-band" style={{ top: clampTop(bed.min), height: top(h1 * 60) - clampTop(bed.min) }} aria-hidden="true" />}
            {placed.map((p) => {
              const r = p.render();
              const height = Math.max(10, ((p.endMin - p.startMin) / 60) * HOUR_PX - 2);
              const width = `calc((100% - ${GUTTER + 10}px) / ${p.lanes})`;
              return (
                <button
                  key={p.key}
                  className={`tblock ${r.planned ? 'planned' : ''} ${r.live ? 'live' : ''} ${r.drift ? 'drift' : ''} ${height < 24 ? 'tiny' : ''}`}
                  style={{
                    top: top(p.startMin) + 1, height, left: `calc(${GUTTER}px + ${width} * ${p.lane})`, width, right: 'auto',
                    background: r.planned ? 'transparent' : `color-mix(in srgb, ${r.color} 55%, var(--card))`,
                    borderColor: r.planned ? r.color : undefined,
                  }}
                  tabIndex={brush ? -1 : 0}
                  onClick={() => setEdit(r.target)}
                >
                  <strong>{r.title}</strong>
                  {height >= 36 && <span className="muted">{r.sub}</span>}
                </button>
              );
            })}
            {miles.map((m) => (
              <button key={m.id} type="button" className="ms-chip" tabIndex={brush ? -1 : 0} style={{ top: clampTop(m.min) - 11 }} onClick={() => setMEdit({ day, id: m.id })} aria-label={`${milestoneName(m)} at ${fmtMilestone(m.min)}, edit`}>
                <MilestoneIcon kind={m.kind} size={12} />{fmtMilestone(m.min).replace(/ (am|pm)$/, '')} {milestoneName(m)}
              </button>
            ))}
            {nowMin !== null && nowMin >= h0 * 60 && nowMin <= h1 * 60 && <div className="now-line" style={{ top: top(nowMin) }} aria-label={`Now, ${fmtHM(nowMin)}`} />}
            {brush && (
              <div className="paint-layer" aria-hidden="true" style={{ left: GUTTER }} {...handlers}>
                {drag && (() => {
                  const lo = Math.min(drag.a, drag.b);
                  const hi = Math.max(drag.a, drag.b) + SLOT;
                  return (
                    <div className={`paint-preview ${brush === ERASE ? 'erase' : ''}`} style={{ top: top(lo), height: top(hi) - top(lo), background: brushCat ? brushCat.color : undefined }}>
                      <span>{fmtHM(lo)} – {fmtHM(hi)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          {h1 < 24 && <button className="card-link more-hours" onClick={() => setExtra({ ...extra, after: extra.after + 2 })}>Show later</button>}
        </div>

        {totals.total > 0 && (
          <Card title={day === today ? 'Where today went' : 'Where the day went'} action={<button className="card-link quiet" onClick={() => setDial(!dial)} aria-pressed={dial}>{dial ? 'Bar' : 'Dial'}</button>}>
            {dial ? (
              <Dial day={day} entries={entries} cats={data.timeCategories} milestones={miles} now={now} total={totals.total} isToday={day === today} />
            ) : (
              <Bar height={10} segments={[...dayCats.map((c) => ({ value: totals.byCat[c.id], color: c.color })), { value: unlogged, color: 'var(--track)' }]} max={totals.total + unlogged} />
            )}
            <div className="legend">
              {dayCats.map((c) => <span key={c.id}><span className="dot" style={{ background: c.color }} />{c.name} {fmtDuration(totals.byCat[c.id])}</span>)}
              {unlogged > 0 && <span><span className="dot" style={{ background: 'var(--track)', outline: '1px solid var(--line)' }} />Unlogged {fmtDuration(unlogged)}</span>}
            </div>
          </Card>
        )}
        <p className="small muted" style={{ padding: '0 4px' }}>
          {brush ? 'Scroll by dragging the times on the left.' : 'Pick a colour below, then drag down the day. Tap a block to add a note, or the flag to add a milestone.'}
        </p>
        <div className="dock-spacer" aria-hidden="true" />
      </div>
      <PaintDock />
      <EntryEditor target={edit} onClose={() => setEdit(null)} />
      <MilestoneEditor target={mEdit} onClose={() => setMEdit(null)} />
    </>
  );
}
