// Money › Trends: the longer view. Weekly and monthly totals against the allowance, averages over the weeks
// you've finished, which weekdays cost the most, where the money goes, how tags are moving, and the biggest spends.
import { useData } from '../../data/store';
import { spendTrends } from '../../data/logic';
import { dayNum, fmtDayShort, monthOf, monthShort, todayISO } from '../../lib/dates';
import { fmtMoney, fmtMoneyShort } from '../../lib/money';
import { useNow } from '../../app/ui-state';
import { Bar, Card } from '../../ui/kit';

const BAR_H = 110;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function MoneyTrends({ onOpen }: { onOpen: (expenseId: string) => void }) {
  const data = useData();
  const now = useNow(60_000);
  const today = todayISO(now);
  const weekly = data.settings.weeklyAllowance;
  const t = spendTrends(data.expenses, today, weekly);
  const maxWeek = Math.max(weekly, ...t.weeks.map((w) => w.total), 1);
  const maxMonth = Math.max(weekly * 4, ...t.months.map((m) => m.total), 1);
  const maxDay = Math.max(1, ...t.byWeekday);
  const maxPlace = Math.max(1, ...t.places.map((p) => p.total));
  const priciest = t.byWeekday.indexOf(Math.max(...t.byWeekday));
  const dollars = (c: number) => `$${Math.round(c / 100)}`;
  // Twelve columns are too narrow for every amount: only this week's and the biggest week's are written.
  const peak = t.weeks.reduce((m, w, i) => (w.total > t.weeks[m].total ? i : m), 0);
  // Months from your first spend on.
  const firstYm = data.expenses.reduce((m, e) => (e.day.slice(0, 7) < m ? e.day.slice(0, 7) : m), '9999-99');
  const months = t.months.filter((m) => m.ym >= firstYm);

  if (!data.expenses.length) {
    return <div className="content"><Card title="Trends"><p className="muted" style={{ fontSize: 14 }}>Log some spending and the longer view shows up here.</p></Card></div>;
  }
  return (
    <div className="content two">
      <Card title="On average" className="span">
        {t.fullWeeks === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>Averages start once you've finished your first week of logging.</p>
        ) : (
          <div className="trend-tiles">
            <div><span className="small muted">A week</span><span className="num">{fmtMoney(t.avgWeek)}</span><small className="muted">{t.avgWeek <= weekly ? `${fmtMoney(weekly - t.avgWeek)} under` : `${fmtMoney(t.avgWeek - weekly)} over`} the allowance</small></div>
            <div><span className="small muted">A day</span><span className="num">{fmtMoney(Math.round(t.avgWeek / 7))}</span><small className="muted">{fmtMoney(Math.round(weekly / 7))} pace</small></div>
            <div><span className="small muted">Within allowance</span><span className="num">{t.underWeeks} of {t.fullWeeks}</span><small className="muted">{t.fullWeeks === 1 ? 'week' : 'weeks'}</small></div>
            <div><span className="small muted">Wants</span><span className="num">{t.avgWeek ? Math.round((t.avgWant / t.avgWeek) * 100) : 0}%</span><small className="muted">{fmtMoney(t.avgWant)} a week</small></div>
          </div>
        )}
        {t.fullWeeks > 0 && t.fullWeeks < 4 && <p className="small muted" style={{ marginTop: 8 }}>From {t.fullWeeks} finished {t.fullWeeks === 1 ? 'week' : 'weeks'} so far; this week isn't counted until it ends.</p>}
      </Card>

      <Card title="Each week" className="span">
        <figure className="bars" style={{ margin: 0, gridTemplateColumns: `repeat(${t.weeks.length}, minmax(0, 1fr))` }} role="img"
          aria-label={`Spending in each of the last ${t.weeks.length} weeks: ${t.weeks.map((w) => `${dayNum(w.start)} ${monthShort(monthOf(w.start))} ${fmtMoney(w.total)}`).join(', ')}. Dashed line is the weekly allowance.`}>
          {t.weeks.map((w, i) => (
            <div className="col" key={w.start}>
              <span className="bar-val">{w.total > 0 && (i === peak || i === t.weeks.length - 1) ? dollars(w.total) : ''}</span>
              <div className="stackbar" style={{ position: 'relative' }}>
                {w.need > 0 && <span style={{ height: (w.need / maxWeek) * BAR_H, background: 'var(--need)' }} />}
                {w.want > 0 && <span style={{ height: (w.want / maxWeek) * BAR_H, background: 'var(--want)' }} />}
                <i className="pace" style={{ bottom: (weekly / maxWeek) * BAR_H }} />
              </div>
              <span style={{ fontWeight: i === t.weeks.length - 1 ? 700 : 400 }}>{i % 2 === t.weeks.length % 2 || i === t.weeks.length - 1 ? dayNum(w.start) : '\u00a0'}</span>
            </div>
          ))}
        </figure>
        <div className="legend">
          <span><span className="dot" style={{ background: 'var(--need)' }} />Need</span>
          <span><span className="dot" style={{ background: 'var(--want)' }} />Want</span>
          <span style={{ marginLeft: 'auto' }}>- - {fmtMoneyShort(weekly)} a week · labels are each week's Monday</span>
        </div>
      </Card>

      <Card title="Each month">
        <div className="stack" style={{ gap: 8 }}>
          {months.map((m) => (
            <div key={m.ym}>
              <div className="row small" style={{ justifyContent: 'space-between' }}>
                <span>{monthShort(m.ym)}{m.ym === monthOf(today) ? ' (so far)' : ''}</span>
                <span className="muted">{fmtMoney(m.total)}</span>
              </div>
              <Bar height={6} segments={[{ value: m.need, color: 'var(--need)' }, { value: m.want, color: 'var(--want)' }]} max={maxMonth} />
            </div>
          ))}
          <p className="small muted">The bar's full width is the bigger of {fmtMoneyShort(weekly * 4)} (4 weeks of allowance) or your priciest month.</p>
        </div>
      </Card>

      <Card title="By weekday">
        {t.fullWeeks === 0 ? <p className="muted" style={{ fontSize: 14 }}>Shows once you've finished a week.</p> : (
          <>
            <figure className="bars" style={{ margin: 0, gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }} role="img"
              aria-label={`Average spent on each weekday: ${t.byWeekday.map((v, i) => `${WEEKDAY_NAMES[i]} ${fmtMoney(v)}`).join(', ')}`}>
              {t.byWeekday.map((v, i) => (
                <div className="col" key={i}>
                  <span className="bar-val">{v > 0 ? dollars(v) : ''}</span>
                  <div className="stackbar"><span style={{ height: (v / maxDay) * (BAR_H * 0.8), background: i === priciest ? 'var(--accent)' : 'var(--check)' }} /></div>
                  <span>{WEEKDAYS[i]}</span>
                </div>
              ))}
            </figure>
            <p className="small muted" style={{ marginTop: 6 }}>Average per weekday. {t.byWeekday[priciest] > 0 ? `${WEEKDAY_NAMES[priciest]}s cost the most.` : ''}</p>
          </>
        )}
      </Card>

      <Card title="Where it goes">
        <div className="stack" style={{ gap: 6 }}>
          {t.places.map((p) => (
            <div key={p.name}>
              <div className="row small" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span className="muted">{p.count}× · {fmtMoney(p.total)}</span>
              </div>
              <Bar height={5} segments={[{ value: p.total, color: 'var(--check)' }]} max={maxPlace} />
            </div>
          ))}
          <p className="small muted">By spend name, over the last {t.weeks.length} weeks.</p>
        </div>
      </Card>

      <Card title="Tags lately">
        {t.tags.length === 0 ? <p className="muted" style={{ fontSize: 14 }}>No tagged spending in the last eight weeks.</p> : (
          <div className="stack" style={{ gap: 6 }}>
            {t.tags.map((g) => {
              const diff = g.now - g.before;
              return (
                <div key={g.tag} className="row small" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <span>#{g.tag}</span>
                  <span className="muted">{fmtMoney(g.now)} <span className={g.before === 0 ? '' : diff > 0 ? 'trend-up' : diff < 0 ? 'trend-down' : ''}>{g.before === 0 ? '· new' : diff === 0 ? '· same' : `${diff > 0 ? '▲' : '▼'} ${fmtMoney(Math.abs(diff))}`}</span></span>
                </div>
              );
            })}
            <p className="small muted">The last four weeks (this one included), against the four before.</p>
          </div>
        )}
      </Card>

      <Card title="Biggest spends">
        <ul className="items">
          {t.biggest.map((e) => (
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
