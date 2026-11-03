// Dailies: a few things to do each day that pay gems as soon as they're done (no claiming), plus a bigger
// bonus for doing them all, which grows with a strict streak. Gems buy colour themes in the Store.
import { useEffect, useRef, useState } from 'react';
import { actions, useData, useReady } from '../../data/store';
import { PALETTES, SKINS, bonusFor, dailies, streakBefore, streakNow, type Daily } from '../../data/logic';
import { addDays, todayISO } from '../../lib/dates';
import { phoneAvailable } from '../../lib/phone';
import { celebrate, celebration, go, moreView, showToast, tryOn, useNow } from '../../app/ui-state';
import { loadSkinFont } from '../../lib/fonts';
import { Band, Sheet } from '../../ui/kit';
import { usePhoneSuggestions } from '../time/phone';
import { useBankSuggestions } from '../money/bank';

export const IconGem = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" /></svg>
);
const IconTick = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
);

/** Today's dailies, worked out from the data and what's waiting for review. */
function useToday() {
  const data = useData();
  const now = useNow(60_000);
  const today = todayISO(now);
  const native = phoneAvailable();
  const phone = usePhoneSuggestions(today, today);
  const bank = useBankSuggestions();
  const list = dailies(data, today, now, {
    phoneOn: native && data.settings.phone.enabled, phonePending: phone.length,
    bankOn: native && data.settings.bank.enabled && data.settings.bank.apps.length > 0, bankPending: bank.length,
  });
  return { data, today, list };
}

/**
 * Pays for dailies the moment they're done, and the bonus once they all are, with a short celebration.
 * Runs once, from App, whatever screen is open.
 */
export function useDailyRewards() {
  const ready = useReady();
  const { data, today, list } = useToday();
  const done = list.filter((d) => d.done).map((d) => d.id).join(',');
  const first = useRef(true);
  useEffect(() => {
    if (!ready) return;
    // On opening the app, dailies finished earlier are paid quietly; after that each one celebrates.
    const quiet = first.current;
    first.current = false;
    for (const d of list) {
      if (d.done && actions.awardDaily(today, d.id, d.gems) && !quiet) celebrate(DONE_TEXT[d.id], d.gems);
    }
    if (list.length && list.every((d) => d.done)) {
      const streak = streakBefore(data.rewards, today);
      const gems = bonusFor(streak);
      if (actions.awardBonus(today, gems)) celebrate(`All dailies done · ${streak + 1}-day streak`, gems, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, today, done]);
}

const DONE_TEXT: Record<Daily['id'], string> = {
  phone: 'Phone use reviewed',
  bank: 'Spends reviewed',
  hours: 'All of yesterday filled in',
  note: 'Today’s note written',
};

/** The card at the top of Home. */
/** A small chip by the Home greeting: a ring that fills as dailies get done, and your gems. Tap it for the list. */
export function DailiesChip() {
  const { data, list } = useToday();
  const [open, setOpen] = useState(false);
  const doneCount = list.filter((d) => d.done).length;
  return (
    <>
      <button type="button" className="dailies-chip" onClick={() => setOpen(true)} aria-label={`Dailies: ${doneCount} of ${list.length} done, ${data.rewards.gems} gems. Open`}>
        <span className="dailies-ring" style={{ ['--done-k' as string]: list.length ? doneCount / list.length : 0 }} aria-hidden="true" />
        <span>{doneCount}/{list.length}</span>
        <span className="dailies-gems"><IconGem size={12} />{data.rewards.gems}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Today's dailies">
        <DailiesList onStore={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function DailiesList({ onStore }: { onStore: () => void }) {
  const { data, today, list } = useToday();
  const paid = data.rewards.days[today];
  const doneCount = list.filter((d) => d.done).length;
  const streak = streakNow(data.rewards, today);
  const bonus = paid?.bonus ?? bonusFor(streakBefore(data.rewards, today));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <section className="stack dailies" aria-label="Today's dailies">
      <div className="card-head">
        <h2>Today’s dailies</h2>
        <button type="button" className="gem-count" onClick={() => { onStore(); moreView.set({ kind: 'store' }); go('more'); }} aria-label={`${data.rewards.gems} gems. Open the store`}>
          <IconGem />{data.rewards.gems}
        </button>
      </div>
      <div className="daily-bar" aria-hidden="true"><i style={{ width: `${list.length ? (doneCount / list.length) * 100 : 0}%` }} /></div>
      <ul className="daily-list">
        {list.map((d) => (
          <li key={d.id} className={`daily ${d.done ? 'done' : ''}`}>
            <span className="daily-tick" aria-hidden="true">{d.done && <IconTick />}</span>
            <span className="daily-text">
              <b>{d.name}</b>
              <small>{d.detail}</small>
              {d.progress !== undefined && !d.done && <span className="daily-hours" aria-hidden="true">{Array.from({ length: 24 }, (_, h) => <i key={h} className={h < Math.floor((d.progress ?? 0) * 24) ? 'on' : ''} />)}</span>}
            </span>
            <span className="daily-gems"><IconGem size={12} />{d.done ? `+${d.gems}` : d.gems}</span>
          </li>
        ))}
      </ul>
      <div className={`daily-bonus ${paid?.bonus ? 'got' : ''}`}>
        <span><b>{paid?.bonus ? 'All done today' : 'Finish them all'}</b><small>{paid?.bonus ? 'Back tomorrow' : streak ? `Bonus grows with your ${streak}-day streak` : 'Every day in a row adds to the bonus'}</small></span>
        <span className="daily-gems"><IconGem size={12} />{paid?.bonus ? `+${bonus}` : bonus}</span>
      </div>
      <div className="daily-streak" aria-label={`Streak: ${streak} ${streak === 1 ? 'day' : 'days'}`}>
        {week.map((d) => <i key={d} className={data.rewards.days[d]?.bonus ? 'on' : d === today ? 'today' : ''} title={d} />)}
        <span>{streak ? `${streak}-day streak` : 'No streak yet'}</span>
      </div>
    </section>
  );
}

/** More › Store: colour themes to buy with gems, and the ones already bought. */
export function Store() {
  const data = useData();
  const { gems, owned } = data.rewards;
  const current = data.settings.palette;
  const trying = tryOn.use();
  const buy = (id: string, price: number, name: string) => {
    tryOn.set(null);
    if (actions.buyPalette(id, price)) showToast(owned.includes(id) ? `Using ${name}` : `Bought ${name}`);
  };
  // Trying something on lasts only while you're in the Store.
  useEffect(() => { loadSkinFont(); return () => tryOn.set(null); }, []);
  return (
    <>
      <Band>
        <button type="button" className="backlink" onClick={() => moreView.set({ kind: 'hub' })}>‹ More</button>
        <div className="band-row">
          <h1>Store</h1>
          <span className="gem-count big" aria-label={`${gems} gems`}><IconGem />{gems}</span>
        </div>
        <p className="band-sub">Gems come from dailies. Tap a theme’s colours, or “Try it on”, to see it before you buy.</p>
      </Band>
      <div className="content">
        <h2 className="section-label">Skins</h2>
        {SKINS.map((k) => {
          const has = owned.includes(k.id);
          const on = k.id === current;
          return (
            <div key={k.id} className={`theme-card skin-card ${on ? 'on' : ''}`}>
              <div className="skin-preview" aria-hidden="true">
                <span className="sp-title">Good evening</span>
                <span className="sp-blk" style={{ ['--c' as string]: '#8DBA78' }}>Uni</span>
                <span className="sp-blk" style={{ ['--c' as string]: '#F4DDB0' }}>Meals</span>
                <span className="sp-blk" style={{ ['--c' as string]: '#E58AA6' }}>Exercise</span>
                <span className="sp-gem"><IconGem size={12} />{gems}</span>
              </div>
              <div className="theme-row">
                <b>{k.name}</b>
                {on ? <span className="small muted">In use</span>
                  : has ? <button type="button" className="btn" onClick={() => buy(k.id, k.price, k.name)}>Use</button>
                  : <button type="button" className="btn green" disabled={gems < k.price} onClick={() => buy(k.id, k.price, k.name)}><IconGem size={12} /> {k.price}</button>}
              </div>
              <small className="muted">{k.blurb} Always uses its own colours, whatever the light or dark setting.</small>
              {!on && (
                <button type="button" className="btn ghost" aria-pressed={trying === k.id} onClick={() => tryOn.set(trying === k.id ? null : k.id)}>
                  {trying === k.id ? 'Stop trying on' : 'Try it on'}
                </button>
              )}
              {!has && gems < k.price && <small className="muted">{k.price - gems} more gems</small>}
            </div>
          );
        })}
        <h2 className="section-label">Colours</h2>
        <div className="themes">
          {PALETTES.map((p) => {
            const has = owned.includes(p.id);
            return (
              <div key={p.id} className={`theme-card ${p.id === current ? 'on' : ''}`}>
                <button type="button" className="theme-swatch" aria-pressed={trying === p.id} aria-label={`Try ${p.name} on`} disabled={p.id === current} onClick={() => tryOn.set(trying === p.id ? null : p.id)}>
                  {p.swatch.map((c) => <span key={c} style={{ background: c }} />)}
                </button>
                <div className="theme-row">
                  <b>{p.name}</b>
                  {p.id === current ? <span className="small muted">In use</span>
                    : has ? <button type="button" className="btn" onClick={() => buy(p.id, p.price, p.name)}>Use</button>
                    : <button type="button" className="btn green" disabled={gems < p.price} onClick={() => buy(p.id, p.price, p.name)}><IconGem size={12} /> {p.price}</button>}
                </div>
                {!has && gems < p.price && <small className="muted">{p.price - gems} more gems</small>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** The celebration when a daily finishes: a pill that drops in at the top with gems flying out. */
export function CelebrationHost() {
  const c = celebration.use();
  if (!c) return null;
  return (
    <div key={c.key} className={`celebrate ${c.big ? 'big' : ''}`} role="status" aria-live="polite">
      <span className="celebrate-gems" aria-hidden="true">{Array.from({ length: c.big ? 8 : 5 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${(360 / (c.big ? 8 : 5)) * i}deg` }}><IconGem size={10} /></i>)}</span>
      <IconGem size={c.big ? 20 : 16} />
      <span><b>+{c.gems}</b> {c.text}</span>
    </div>
  );
}
