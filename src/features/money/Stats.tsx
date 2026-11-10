// Money › Stats: one period at a time (a week, a month or all time). A donut of where the money went by tag,
// spending over the period (days as bars for a week, weeks as a line for longer), top places and biggest spends.
import { useState, type PointerEvent as RPointerEvent } from 'react';
import { useData } from '../../data/store';
import { spendStats, topSpendTags } from '../../data/logic';
import type { Expense } from '../../data/types';
import { dayNum, fmtDayShort, monthOf, monthShort, todayISO, weekdayShort } from '../../lib/dates';
import { fmtMoney } from '../../lib/money';
import { Card } from '../../ui/kit';

export type StatsPeriod = 'week' | 'month' | 'all';

/** Fixed slots: a tag keeps its colour in every period. "Other" is a neutral grey. */
const SLOT = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)'];
const OTHER = 'var(--cat-other)';
const dollars = (c: number) => `$${Math.round(c / 100).toLocaleString('en-AU')}`;
const shortDay = (d: string) => `${dayNum(d)} ${monthShort(monthOf(d))}`;

export function MoneyStats({ period, from, to, onOpen }: { period: StatsPeriod; from: string; to: string; onOpen: (id: string) => void }) {
  const data = useData();
  const weekly = data.settings.weeklyAllowance;
  const tags = topSpendTags(data.expenses);
  const st = spendStats(data.expenses, from, to, tags, period === 'week' ? 'day' : 'week');
  const colour = (tag: string | null) => (tag === null ? OTHER : SLOT[tags.indexOf(tag)] ?? OTHER);
  // Weeks still to come would read as $0: the line stops at this week.
  const today = todayISO();
  const past = st.series.filter((w) => w.start <= today);
  const weeks = past.length;

  if (st.count === 0) {
    return <div className="content"><Card><p className="muted" style={{ fontSize: 14 }}>Nothing spent in this {period === 'all' ? 'time' : period}.</p></Card></div>;
  }
  const limit = period === 'week' ? weekly : period === 'month' ? weekly * 4 : weekly * weeks;
  return (
    <div className="content two">
      <Card className="span stats-hero">
        <Donut slices={st.slices.map((x) => ({ ...x, color: colour(x.tag) }))} total={st.total}
          caption={period === 'all' ? `about ${dollars(st.total / Math.max(1, weeks))} a week` : `of ${dollars(limit)}`} />
        <ul className="stats-legend">
          {st.slices.map((x) => (
            <li key={x.tag ?? 'other'}>
              <span className="sw" style={{ background: colour(x.tag) }} aria-hidden="true" />
              <span className="grow">{x.tag ? `#${x.tag}` : 'Other'}{x.tag === null && st.untagged > 0 && <small className="muted"> incl. {dollars(st.untagged)} untagged</small>}</span>
              <span className="muted">{Math.round((x.total / st.total) * 100)}%</span>
              <b>{fmtMoney(x.total)}</b>
            </li>
          ))}
        </ul>
        <div className="stats-split" aria-label={`Needs ${fmtMoney(st.need)}, wants ${fmtMoney(st.want)}`}>
          <span><i style={{ background: 'var(--need)' }} />Needs {fmtMoney(st.need)}</span>
          <span><i style={{ background: 'var(--want)' }} />Wants {fmtMoney(st.want)}</span>
        </div>
      </Card>

      <Card title={period === 'week' ? 'Each day' : 'Each week'} className="span">
        {period === 'week'
          ? <DayBars series={st.series} pace={weekly / 7} />
          : <WeekLine series={past} allowance={weekly} />}
      </Card>

      <Card title="Top places">
        <div className="stack" style={{ gap: 8 }}>
          {st.places.map((p) => (
            <div key={p.name}>
              <div className="row small" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.count > 1 && <span className="muted"> · {p.count}×</span>}</span>
                <span>{fmtMoney(p.total)}</span>
              </div>
              <div className="hbar"><span style={{ width: `${(p.total / st.places[0].total) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Biggest spends">
        <ul className="items">
          {st.biggest.map((e: Expense) => (
            <li className="item" key={e.id}>
              <button className="item-main" onClick={() => onOpen(e.id)}>
                <span className="item-title" style={{ display: 'block' }}>{e.note || (e.tags[0] ? `#${e.tags[0]}` : 'Expense')}</span>
                <span className="small muted">{fmtDayShort(e.day)} · {e.kind}</span>
              </button>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(e.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** A donut with a 2px gap between slices and the total in the middle. Tap a slice to read it. */
function Donut({ slices, total, caption }: { slices: { tag: string | null; total: number; color: string }[]; total: number; caption: string }) {
  const [on, setOn] = useState<number | null>(null);
  const R = 80, r = 54, C = 100;
  let a0 = -Math.PI / 2;
  const pt = (rad: number, a: number) => `${C + rad * Math.cos(a)} ${C + rad * Math.sin(a)}`;
  const arcs = slices.map((x, i) => {
    const sweep = (x.total / total) * Math.PI * 2;
    const a1 = a0 + sweep;
    const big = sweep > Math.PI ? 1 : 0;
    const d = slices.length === 1
      ? `M ${pt(R, -Math.PI / 2)} A ${R} ${R} 0 1 1 ${pt(R, Math.PI * 1.5 - 0.0001)} L ${pt(r, Math.PI * 1.5 - 0.0001)} A ${r} ${r} 0 1 0 ${pt(r, -Math.PI / 2)} Z`
      : `M ${pt(R, a0)} A ${R} ${R} 0 ${big} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${big} 0 ${pt(r, a0)} Z`;
    a0 = a1;
    return <path key={i} d={d} fill={x.color} stroke="var(--card)" strokeWidth={2} opacity={on === null || on === i ? 1 : 0.35}
      onClick={() => setOn(on === i ? null : i)} style={{ cursor: 'pointer' }}><title>{`${x.tag ? `#${x.tag}` : 'Other'}: ${fmtMoney(x.total)}`}</title></path>;
  });
  const shown = on === null ? null : slices[on];
  return (
    <svg className="donut" viewBox="0 0 200 200" role="img" aria-label={`Total ${fmtMoney(total)}: ${slices.map((x) => `${x.tag ? `#${x.tag}` : 'Other'} ${fmtMoney(x.total)}`).join(', ')}`}>
      {arcs}
      <text x={C} y={C - 4} textAnchor="middle" className="donut-total">{shown ? fmtMoney(shown.total) : fmtMoney(total)}</text>
      <text x={C} y={C + 18} textAnchor="middle" className="donut-cap">{shown ? (shown.tag ? `#${shown.tag}` : 'Other') : caption}</text>
    </svg>
  );
}

function DayBars({ series, pace }: { series: { start: string; total: number }[]; pace: number }) {
  const H = 120;
  const max = Math.max(pace, ...series.map((d) => d.total), 1);
  return (
    <>
      <figure className="bars" style={{ margin: 0, gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }} role="img"
        aria-label={`Spent each day: ${series.map((d) => `${weekdayShort(d.start)} ${fmtMoney(d.total)}`).join(', ')}`}>
        {series.map((d) => (
          <div className="col" key={d.start}>
            <span className="bar-val">{d.total > 0 ? dollars(d.total) : ' '}</span>
            <div className="stackbar" style={{ position: 'relative' }}>
              {d.total > 0 && <span style={{ height: (d.total / max) * H, background: 'var(--check)' }} />}
              <i className="pace" style={{ bottom: (pace / max) * H }} />
            </div>
            <span>{weekdayShort(d.start).slice(0, 1)}</span>
          </div>
        ))}
      </figure>
      <p className="small muted" style={{ marginTop: 6 }}>- - {dollars(pace)} a day keeps you within the allowance.</p>
    </>
  );
}

/** Each week as a point on one line, against the weekly allowance. Tap or drag across it to read a week. */
function WeekLine({ series, allowance }: { series: { start: string; total: number }[]; allowance: number }) {
  const [on, setOn] = useState<number | null>(null);
  const W = 320, H = 150, PL = 8, PR = 8, PT = 26, PB = 22;
  const max = Math.max(allowance, ...series.map((w) => w.total), 1) * 1.08;
  const n = series.length;
  const x = (i: number) => (n === 1 ? W / 2 : PL + (i / (n - 1)) * (W - PL - PR));
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const pts = series.map((w, i) => `${x(i)},${y(w.total)}`).join(' ');
  const pick = (e: RPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - fx) < Math.abs(x(best) - fx)) best = i;
    setOn(best);
  };
  const a = on === null ? null : series[on];
  return (
    <>
      <svg className="weekline" viewBox={`0 0 ${W} ${H}`} role="img" onPointerDown={pick} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'mouse') pick(e); }} onPointerLeave={() => setOn(null)}
        aria-label={`Spent each week: ${series.map((w) => `week of ${shortDay(w.start)} ${fmtMoney(w.total)}`).join(', ')}. Dashed line is the weekly allowance, ${fmtMoney(allowance)}.`}>
        <line x1={PL} x2={W - PR} y1={y(allowance)} y2={y(allowance)} className="wl-limit" />
        <text x={W - PR} y={y(allowance) - 4} textAnchor="end" className="wl-label">{dollars(allowance)} a week</text>
        <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} className="wl-axis" />
        {n > 1 && <polyline points={pts} className="wl-line" />}
        {series.map((w, i) => <circle key={w.start} cx={x(i)} cy={y(w.total)} r={on === i ? 5.5 : 4} className="wl-dot" />)}
        {a && on !== null && (
          <>
            <line x1={x(on)} x2={x(on)} y1={PT - 6} y2={H - PB} className="wl-guide" />
            <text x={Math.min(W - PR, Math.max(PL, x(on)))} y={12} textAnchor={x(on) < 70 ? 'start' : x(on) > W - 70 ? 'end' : 'middle'} className="wl-tip">{shortDay(a.start)} · {fmtMoney(a.total)}</text>
          </>
        )}
        <text x={PL} y={H - 6} className="wl-label">{shortDay(series[0].start)}</text>
        {n > 1 && <text x={W - PR} y={H - 6} textAnchor="end" className="wl-label">{shortDay(series[n - 1].start)}</text>}
      </svg>
      <p className="small muted" style={{ marginTop: 4 }}>Each dot is a Monday–Sunday week. Tap the line to read a week.</p>
    </>
  );
}
