// Money: one weekly allowance (Monday–Sunday). Every spend is a need or a want; tags are optional.
// Month view totals the calendar month against 4 × the weekly allowance.
import { useState } from 'react';
import { actions, useData } from '../../data/store';
import { monthSpend, upcomingBills, weekSpend, type SpendSplit } from '../../data/logic';
import type { Expense, SpendKind } from '../../data/types';
import { addDays, addMonths, dayNum, fmtDayShort, monthName, monthOf, monthShort, relativeDay, todayISO, weekStart, weekdayShort } from '../../lib/dates';
import { fmtMoney, fmtMoneyShort } from '../../lib/money';
import { openQuickAdd, showToast, useNow } from '../../app/ui-state';
import { Band, Bar, Card } from '../../ui/kit';
import { IconLeft, IconRight } from '../../ui/icons';
import { AllowanceEditor, BillEditor, ExpenseEditor } from './MoneyEditors';
import { BankReviewCard, useBankSuggestions } from './bank';

type Filter = { kind: SpendKind } | { tag: string } | { untagged: true } | null;

const BAR_H = 124;

function SpendBars({ cols, pace, label }: { cols: (SpendSplit & { key: string; label: string; strong: boolean })[]; pace: number; label: string }) {
  const max = Math.max(pace, ...cols.map((c) => c.total), 1);
  return (
    <figure className="bars" style={{ margin: 0, gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }} role="img"
      aria-label={`${label}: ${cols.map((c) => `${c.label} ${fmtMoney(c.total)}`).join(', ')}. Dashed line is the allowance pace, ${fmtMoney(pace)}.`}>
      {cols.map((c) => (
        <div className="col" key={c.key}>
          <span>{c.total > 0 ? fmtMoneyShort(c.total) : ''}</span>
          <div className="stackbar" style={{ position: 'relative' }}>
            {c.need > 0 && <span style={{ height: (c.need / max) * BAR_H, background: 'var(--need)' }} />}
            {c.want > 0 && <span style={{ height: (c.want / max) * BAR_H, background: 'var(--want)' }} />}
            <i className="pace" style={{ bottom: (pace / max) * BAR_H }} />
          </div>
          <span style={{ color: c.strong ? 'var(--accent)' : undefined, fontWeight: c.strong ? 700 : 400 }}>{c.label}</span>
        </div>
      ))}
    </figure>
  );
}

export function Money() {
  const data = useData();
  const bank = useBankSuggestions();
  const now = useNow(60_000);
  const today = todayISO(now);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(today);
  const [filter, setFilter] = useState<Filter>(null);
  const [editExpense, setEditExpense] = useState<string | null>(null);
  const [editBill, setEditBill] = useState<string | null>(null);
  const [allowanceOpen, setAllowanceOpen] = useState(false);

  const weekly = data.settings.weeklyAllowance;
  const ws = weekStart(anchor);
  const we = addDays(ws, 6);
  const ym = monthOf(anchor);
  const week = weekSpend(data.expenses, anchor, weekly, today);
  const month = monthSpend(data.expenses, ym, weekly);
  const sum = mode === 'week' ? week : month;
  const allowance = sum.allowance;
  const left = allowance - sum.total;
  const isCurrent = mode === 'week' ? ws === weekStart(today) : ym === monthOf(today);
  const rangeLabel = mode === 'week' ? `${dayNum(ws)} ${monthShort(monthOf(ws))} – ${dayNum(we)} ${monthShort(monthOf(we))}` : `${monthName(ym)} ${ym.slice(0, 4)}`;
  const step = (n: number) => { setAnchor(mode === 'week' ? addDays(anchor, 7 * n) : `${addMonths(ym, n)}-01`); setFilter(null); };
  const bills = upcomingBills(data.bills, today, 21);

  const inRange = (e: Expense) => (mode === 'week' ? e.day >= ws && e.day <= we : monthOf(e.day) === ym);
  const matches = (e: Expense) =>
    !filter || ('kind' in filter ? e.kind === filter.kind : 'tag' in filter ? e.tags.includes(filter.tag) : e.tags.length === 0);
  const txns = data.expenses.filter((e) => inRange(e) && matches(e)).sort((a, b) => b.day.localeCompare(a.day) || b.createdAt - a.createdAt);
  const byDay: [string, Expense[]][] = [];
  for (const t of txns) {
    const last = byDay[byDay.length - 1];
    if (last && last[0] === t.day) last[1].push(t);
    else byDay.push([t.day, [t]]);
  }
  const filterName = !filter ? null : 'kind' in filter ? (filter.kind === 'need' ? 'Needs' : 'Wants') : 'tag' in filter ? `#${filter.tag}` : 'Untagged';
  const isOn = (f: Filter) => JSON.stringify(f) === JSON.stringify(filter);
  const toggle = (f: Filter) => setFilter(isOn(f) ? null : f);
  const pctOf = (v: number) => (sum.total ? Math.round((v / sum.total) * 100) : 0);
  const maxTag = Math.max(1, ...sum.byTag.map((t) => t.total), sum.untagged);

  return (
    <>
      <Band>
        <div className="band-row">
          <h1>Money</h1>
          <div className="seg" role="tablist" aria-label="View">
            <button role="tab" aria-selected={mode === 'week'} onClick={() => { setMode('week'); setFilter(null); }}>Week</button>
            <button role="tab" aria-selected={mode === 'month'} onClick={() => { setMode('month'); setFilter(null); }}>Month</button>
          </div>
        </div>
        <div className="band-row">
          <button className="icon-btn" aria-label={`Previous ${mode}`} onClick={() => step(-1)}><IconLeft size={18} /></button>
          <div style={{ textAlign: 'center' }} className="grow">
            <p className="band-sub">{isCurrent ? (mode === 'week' ? `This week · ${rangeLabel}` : `This month · ${monthName(ym)}`) : rangeLabel}</p>
            <p className="num" style={{ fontSize: 38, lineHeight: 1.1 }}>{fmtMoney(sum.total)}</p>
            <button className="band-sub" onClick={() => setAllowanceOpen(true)} style={{ background: 'none', border: 'none', padding: '4px 0', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
              of {fmtMoney(allowance)}{mode === 'month' ? ` (4 × ${fmtMoneyShort(weekly)})` : ' allowance'}
            </button>
          </div>
          <button className="icon-btn" aria-label={`Next ${mode}`} onClick={() => step(1)}><IconRight size={18} /></button>
        </div>
        <div>
          <div className="split" style={{ height: 8, background: 'var(--band-chip)' }}>
            {sum.need > 0 && <span style={{ width: `${(sum.need / Math.max(allowance, sum.total)) * 100}%`, background: '#BFD8AE' }} />}
            {sum.want > 0 && <span style={{ width: `${(sum.want / Math.max(allowance, sum.total)) * 100}%`, background: '#F4B4C4' }} />}
          </div>
          <div className="row band-sub" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <span>{left >= 0 ? `${fmtMoney(left)} left` : `${fmtMoney(-left)} over`}</span>
            {mode === 'week' && isCurrent && week.daysLeft > 0 && left > 0 && <span>{fmtMoney(week.perDayLeft)} a day for {week.daysLeft} {week.daysLeft === 1 ? 'day' : 'days'}</span>}
          </div>
        </div>
      </Band>

      <div className="content two">
        <BankReviewCard suggestions={bank} />
        <Card title="Need vs want">
          {sum.total === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>Nothing spent {isCurrent ? (mode === 'week' ? 'yet this week' : 'yet this month') : 'in this ' + mode}.</p>
          ) : (
            <>
              <div className="split" role="img" aria-label={`Needs ${pctOf(sum.need)}%, wants ${pctOf(sum.want)}%`}>
                {sum.need > 0 && <span style={{ width: `${pctOf(sum.need)}%`, background: 'var(--need)' }} />}
                {sum.want > 0 && <span style={{ width: `${100 - pctOf(sum.need)}%`, background: 'var(--want)' }} />}
              </div>
              <div className="grid2" style={{ marginTop: 12 }}>
                {(['need', 'want'] as const).map((k) => (
                  <button key={k} className="kind-card" aria-pressed={isOn({ kind: k })} onClick={() => toggle({ kind: k })}>
                    <span className="small muted"><span className="dot" style={{ background: `var(--${k})` }} />{k === 'need' ? 'Needs' : 'Wants'} · {pctOf(sum[k])}%</span>
                    <span className="num" style={{ fontSize: 22, display: 'block', marginTop: 2 }}>{fmtMoney(sum[k])}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title={mode === 'week' ? 'Each day' : 'Each week'}>
          {mode === 'week' ? (
            <SpendBars label="Spending per day" pace={weekly / 7} cols={week.days.map((d) => ({ ...d, key: d.day, label: weekdayShort(d.day).slice(0, 1), strong: d.day === today }))} />
          ) : (
            <SpendBars label="Spending per week" pace={weekly} cols={month.weeks.map((w) => ({ ...w, key: w.start, label: `${dayNum(w.start)} ${monthShort(monthOf(w.start))}`, strong: w.start === weekStart(today) }))} />
          )}
          <div className="legend">
            <span><span className="dot" style={{ background: 'var(--need)' }} />Need</span>
            <span><span className="dot" style={{ background: 'var(--want)' }} />Want</span>
            <span style={{ marginLeft: 'auto' }}>- - {mode === 'week' ? `${fmtMoneyShort(Math.round(weekly / 7))} a day` : `${fmtMoneyShort(weekly)} a week`}</span>
          </div>
          {mode === 'month' && <p className="small muted" style={{ marginTop: 6 }}>Weeks that cross into another month only count this month's days.</p>}
        </Card>

        <Card title="Tags">
          {sum.byTag.length === 0 && sum.untagged === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>Add tags like #groceries or #friends when you log spending to see them here.</p>
          ) : (
            <div className="stack" style={{ gap: 4 }}>
              {[...sum.byTag.map((t) => ({ f: { tag: t.tag } as Filter, name: `#${t.tag}`, total: t.total })), ...(sum.untagged ? [{ f: { untagged: true } as Filter, name: 'No tag', total: sum.untagged }] : [])].map((r) => (
                <button key={r.name} className="tag-row" aria-pressed={isOn(r.f)} onClick={() => toggle(r.f)}>
                  <span className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                    <span className={r.name === 'No tag' ? 'muted' : ''}>{r.name}</span>
                    <span className="muted">{fmtMoney(r.total)}</span>
                  </span>
                  <Bar height={5} segments={[{ value: r.total, color: 'var(--check)' }]} max={maxTag} />
                </button>
              ))}
              <p className="small muted" style={{ marginTop: 4 }}>Tags can overlap, so these can add up to more than the total. Tap one to filter.</p>
            </div>
          )}
        </Card>

        <Card title="Upcoming bills" action={<button className="card-link" onClick={() => setEditBill('new')}>+ Bill</button>}>
          {bills.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>No bills due in the next three weeks.</p>
          ) : (
            <ul className="items">
              {bills.map(({ bill, overdue }) => (
                <li className="item" key={bill.id}>
                  <button className="item-main" onClick={() => setEditBill(bill.id)}>
                    <p className="item-title">{bill.name}</p>
                    <p className={`item-meta ${overdue ? 'warn' : ''}`}>{overdue ? `Overdue · was due ${relativeDay(bill.nextDue, today)}` : `Due ${relativeDay(bill.nextDue, today)}`} · {bill.cadence} · {bill.kind}</p>
                  </button>
                  <span className="num" style={{ fontSize: 15 }}>{fmtMoney(bill.amount)}</span>
                  <button className="btn" style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }} onClick={() => showToast(`Paid ${bill.name}`, actions.payBill(bill.id, today))}>Paid</button>
                </li>
              ))}
            </ul>
          )}
          {data.bills.length > bills.length && <p className="small muted" style={{ marginTop: 6 }}>{data.bills.length - bills.length} more later on.</p>}
        </Card>

        <Card className="span" title={filterName ? `${filterName} · ${fmtMoney(txns.reduce((s, e) => s + e.amount, 0))}` : 'Spending'}
          action={filter ? <button className="card-link" onClick={() => setFilter(null)}>Show all</button> : <button className="card-link" onClick={() => openQuickAdd('spend')}>+ Add</button>}>
          {byDay.length === 0 && <p className="muted" style={{ fontSize: 14 }}>Nothing here yet.</p>}
          {byDay.map(([day, items]) => (
            <div key={day}>
              <p className="small muted" style={{ marginTop: 10 }}>{day === today ? 'Today' : fmtDayShort(day)}</p>
              <ul className="items">
                {items.map((e) => (
                  <li className="item" key={e.id} style={{ minHeight: 50 }}>
                    <button className="item-main" onClick={() => setEditExpense(e.id)}>
                      <span className="item-title" style={{ display: 'block' }}>{e.note || (e.tags[0] ? `#${e.tags[0]}` : 'Expense')}</span>
                      <span className="row" style={{ gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        <span className={`kind-pill ${e.kind}`}>{e.kind}</span>
                        {e.tags.map((t) => <span key={t} className="small muted">#{t}</span>)}
                      </span>
                    </button>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmtMoney(e.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      </div>

      <ExpenseEditor id={editExpense} onClose={() => setEditExpense(null)} />
      <BillEditor id={editBill} onClose={() => setEditBill(null)} />
      <AllowanceEditor open={allowanceOpen} onClose={() => setAllowanceOpen(false)} />
    </>
  );
}
