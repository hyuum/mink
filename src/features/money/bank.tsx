// Bank notifications, in the Android app: purchases your bank or wallet app tells you about become
// spends to review, once a day, from a card on Home and Money. Settings live in More › Settings.
import { useEffect, useMemo, useState } from 'react';
import { actions, useData } from '../../data/store';
import { bankSuggestions, spendName, type BankNote, type BankSuggestion } from '../../data/logic';
import type { SpendKind } from '../../data/types';
import { relativeDay, todayISO } from '../../lib/dates';
import { fmtMoney } from '../../lib/money';
import { bankNotes, bankSeenApps, hasBankAccess, openAppInfo, openBankAccessSettings, rebindBank, setBankApps } from '../../lib/bank';
import { phoneAvailable } from '../../lib/phone';
import { showToast } from '../../app/ui-state';
import { Card, Sheet } from '../../ui/kit';

const KEEP_MS = 30 * 86_400_000;

/** Re-reads kept notifications when the app comes back to the front, and every few minutes while open. */
function useBankNotes(on: boolean): BankNote[] {
  const [notes, setNotes] = useState<BankNote[]>([]);
  useEffect(() => {
    if (!on) { setNotes([]); return; }
    let live = true;
    const load = () => { bankNotes(Date.now() - KEEP_MS).then((n) => { if (live) setNotes(n); }); };
    load();
    const onShow = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onShow);
    const timer = setInterval(load, 5 * 60_000);
    return () => { live = false; document.removeEventListener('visibilitychange', onShow); clearInterval(timer); };
  }, [on]);
  return notes;
}

/** Spends waiting for review (empty outside the Android app or when it's off). */
export function useBankSuggestions(): BankSuggestion[] {
  const data = useData();
  const b = data.settings.bank;
  const on = phoneAvailable() && b.enabled && b.apps.length > 0;
  const notes = useBankNotes(on);
  return useMemo(
    () => (on ? bankSuggestions(notes, data.expenses, b.merchants, data.bankDismissed, (ms) => todayISO(ms)) : []),
    [on, notes, data.expenses, b.merchants, data.bankDismissed],
  );
}

/** The once-a-day card: how many spends wait, and their total. Opens the review. */
export function BankReviewCard({ suggestions }: { suggestions: BankSuggestion[] }) {
  const [open, setOpen] = useState(false);
  if (!suggestions.length) return null;
  const total = suggestions.reduce((t, s) => t + s.amount, 0);
  return (
    <>
      <div className="card bank-card">
        <div className="grow">
          <p className="small muted">Spends to review</p>
          <p className="num" style={{ fontSize: 24 }}>{fmtMoney(total)}</p>
          <p className="small muted">{suggestions.length === 1 ? '1 from your notifications' : `${suggestions.length} from your notifications`}</p>
        </div>
        <button type="button" className="btn green" onClick={() => setOpen(true)}>Review</button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} label="Spends to review">
        {open && <ReviewBody suggestions={suggestions} onClose={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

interface Row { on: boolean; note: string; kind: SpendKind }

function ReviewBody({ suggestions, onClose }: { suggestions: BankSuggestion[]; onClose: () => void }) {
  const today = todayISO();
  // Anything that looks already logged by hand starts unticked.
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(suggestions.map((s) => [s.key, { on: !s.logged, note: s.note, kind: s.kind }])));
  const set = (key: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));
  const chosen = suggestions.filter((s) => rows[s.key]?.on);
  const sum = chosen.reduce((t, s) => t + s.amount, 0);
  const approve = () => {
    const before = actions.approveBank(chosen.map((s) => ({ key: s.key, day: s.day, amount: s.amount, kind: rows[s.key].kind, tags: s.tags, note: rows[s.key].note || s.merchant, merchant: s.merchant })));
    showToast(`Logged ${chosen.length} · ${fmtMoney(sum)}`, before);
    onClose();
  };
  const dismiss = () => {
    const before = actions.dismissBank(chosen.map((s) => s.key));
    showToast(`Dismissed ${chosen.length}`, before);
    onClose();
  };
  if (!suggestions.length) return <p className="small muted">Nothing left to review.</p>;
  let lastDay = '';
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        <h2>Spends to review</h2>
        <p className="small muted">Untick any you don't want logged. Tap a name to change it; next time that shop starts with your name and need or want.</p>
      </div>
      <div className="bank-list">
        {suggestions.map((s) => {
          const r = rows[s.key];
          const head = s.day !== lastDay ? relativeDay(s.day, today) : null;
          lastDay = s.day;
          return (
            <div key={s.key}>
              {head && <p className="section-label">{head}</p>}
              <div className={`bank-row ${r.on ? '' : 'off'}`}>
                <input type="checkbox" checked={r.on} onChange={(e) => set(s.key, { on: e.target.checked })} aria-label={`Include ${r.note || s.merchant} ${fmtMoney(s.amount)}`} />
                <input className="bank-name" value={r.note} placeholder={s.merchant || 'name'} aria-label="Name for this spend" autoComplete="off" spellCheck={false}
                  onChange={(e) => set(s.key, { note: e.target.value.toLowerCase() })} onBlur={(e) => set(s.key, { note: spendName(e.target.value) })} />
                <span className="num bank-amt">{fmtMoney(s.amount)}</span>
                <div className="bank-meta">
                  <span>{new Date(s.at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} · {s.app}</span>
                  <span className="seg-mini" role="group" aria-label="Need or want">
                    {(['need', 'want'] as const).map((k) => <button key={k} type="button" className={k} aria-pressed={r.kind === k} onClick={() => set(s.key, { kind: k })}>{k === 'need' ? 'Need' : 'Want'}</button>)}
                  </span>
                  {s.tags.map((t) => <span key={t} className="chip-mini">#{t}</span>)}
                  {s.logged && <span className="warn-mini">Already logged?</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn ghost" disabled={!chosen.length} onClick={dismiss}>Dismiss</button>
        <button type="button" className="btn green grow" disabled={!chosen.length} onClick={approve}>{chosen.length ? `Approve ${chosen.length} · ${fmtMoney(sum)}` : 'Approve'}</button>
      </div>
    </div>
  );
}

/** More › Settings › Bank notifications. In the browser it explains that it needs the Android app. */
export function BankSettingsCard() {
  const data = useData();
  const b = data.settings.bank;
  const native = phoneAvailable();
  const [access, setAccess] = useState<boolean | null>(null);
  const [seen, setSeen] = useState<{ pkg: string; label: string; count: number; last: number }[]>([]);

  useEffect(() => {
    if (!native) return;
    const check = () => {
      hasBankAccess().then(setAccess);
      bankSeenApps().then((a) => setSeen(a.sort((x, y) => y.count - x.count)));
    };
    check();
    const onShow = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [native]);
  // Keep the Android side's list of apps in step with settings (it only keeps notifications from these).
  useEffect(() => { if (native) setBankApps(b.enabled ? b.apps : []); }, [native, b.enabled, b.apps]);

  if (!native) {
    return (
      <Card title="Bank notifications">
        <p className="small muted">In the Android app, purchases your bank or wallet app notifies you about can become spends to review once a day. It isn't available in the browser.</p>
      </Card>
    );
  }
  const toggleApp = (pkg: string, on: boolean) => actions.updateBankSettings({ apps: on ? [...b.apps, pkg] : b.apps.filter((p) => p !== pkg) });
  // Apps you picked that haven't shown an amount since still appear, so they can be unticked.
  const listed = [...seen, ...b.apps.filter((p) => !seen.some((s) => s.pkg === p)).map((pkg) => ({ pkg, label: pkg, count: 0, last: 0 }))];
  return (
    <Card title="Bank notifications">
      <div className="stack">
        <label className="row" htmlFor="bank-on" style={{ minHeight: 44, gap: 10, fontSize: 15 }}>
          <input id="bank-on" type="checkbox" checked={b.enabled} onChange={(e) => { actions.updateBankSettings({ enabled: e.target.checked }); if (e.target.checked) rebindBank(); }} style={{ width: 20, height: 20, accentColor: 'var(--done)' }} />
          Suggest spends from notifications
        </label>
        {b.enabled && access === false && (
          <div className="phone-access">
            <p className="small">Turn on <b>Notification access</b> for Matcha Planner. It only keeps notifications with a dollar amount from the apps you tick below, for 30 days, on this phone.</p>
            <p className="small muted">If Android says it's a restricted setting: open App info, tap ⋮ in the corner, choose Allow restricted settings, then try again.</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => openBankAccessSettings()}>Open Notification access</button>
              <button type="button" className="btn ghost" onClick={() => openAppInfo()}>Open App info</button>
            </div>
          </div>
        )}
        {b.enabled && access && (
          <div className="stack" style={{ gap: 6 }}>
            <p className="small muted">Read these apps</p>
            {listed.length === 0 && <p className="small muted">No app has shown a dollar amount yet. Once your bank or wallet app sends a purchase notification, it appears here to tick.</p>}
            {listed.map((a) => (
              <label key={a.pkg} className="row bank-app" htmlFor={`bank-${a.pkg}`}>
                <input id={`bank-${a.pkg}`} type="checkbox" checked={b.apps.includes(a.pkg)} onChange={(e) => toggleApp(a.pkg, e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--done)' }} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <b>{a.label}</b>
                  <small>{a.count ? `${a.count} with an amount` : 'nothing yet'}{b.apps.includes(a.pkg) ? '' : ' · not read'}</small>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
