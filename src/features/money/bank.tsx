// Bank notifications, in the Android app: purchases your bank or wallet app tells you about become
// spends to review, once a day, from a card on Home and Money. Settings live in More › Settings.
import { useEffect, useMemo, useState } from 'react';
import { actions, useData } from '../../data/store';
import { bankHistory, bankPattern, bankSuggestions, spendName, type BankHistoryRow, type BankNote, type BankSuggestion } from '../../data/logic';
import type { SpendKind } from '../../data/types';
import { relativeDay, todayISO } from '../../lib/dates';
import { fmtMoney } from '../../lib/money';
import { bankNotes, bankSeenApps, hasBankAccess, openAppInfo, openBankAccessSettings, rebindBank, setBankApps } from '../../lib/bank';
import { phoneAvailable } from '../../lib/phone';
import { showToast } from '../../app/ui-state';
import { Card, Sheet, TagPicker } from '../../ui/kit';

const KEEP_MS = 30 * 86_400_000;

/** Re-reads kept notifications when the app comes back to the front, and every few minutes while open. */
function useBankNotes(on: boolean): BankNote[] {
  const [notes, setNotes] = useState<BankNote[]>([]);
  useEffect(() => {
    if (!on) { setNotes([]); return; }
    let live = true;
    // Pick up anything still in the notification shade first, then read what's kept.
    const load = () => { rebindBank().then(() => bankNotes(Date.now() - KEEP_MS)).then((n) => { if (live) setNotes(n); }); };
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
    () => (on ? bankSuggestions(notes, data.expenses, b.merchants, data.bankDismissed, (ms) => todayISO(ms), b.ignore) : []),
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
        <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
          <button type="button" className="btn green" onClick={() => setOpen(true)}>Review</button>
          <button type="button" className="card-link quiet" onClick={() => dismissAll(suggestions)}>Dismiss all</button>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} label="Spends to review">
        {open && <ReviewBody suggestions={suggestions} onClose={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

interface Row { on: boolean; note: string; kind: SpendKind; tags: string[] }

/** Clears the whole review at once, for days when none of it was a real spend. */
function dismissAll(suggestions: BankSuggestion[]) {
  const before = actions.dismissBank(suggestions.map((s) => s.key));
  showToast(`Dismissed all ${suggestions.length}`, before);
}

function ReviewBody({ suggestions, onClose }: { suggestions: BankSuggestion[]; onClose: () => void }) {
  const today = todayISO();
  // Everything starts unticked: you tick the real spends.
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(suggestions.map((s) => [s.key, { on: false, note: s.note, kind: s.kind, tags: s.tags }])));
  // Your most used tags, offered when you add tags to a spend.
  const expenses = useData().expenses;
  const topTags = useMemo(() => {
    const n = new Map<string, number>();
    for (const e of expenses) for (const t of e.tags) n.set(t, (n.get(t) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 8);
  }, [expenses]);
  // Which spend's tags are open for editing.
  const [tagging, setTagging] = useState<string | null>(null);
  const set = (key: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));
  // Which spend's original notification is showing.
  const [shown, setShown] = useState<string | null>(null);
  const chosen = suggestions.filter((s) => rows[s.key]?.on);
  const sum = chosen.reduce((t, s) => t + s.amount, 0);
  const approve = () => {
    const before = actions.approveBank(chosen.map((s) => ({ key: s.key, day: s.day, amount: s.amount, kind: rows[s.key].kind, tags: rows[s.key].tags, note: rows[s.key].note || s.merchant, merchant: s.merchant })));
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
        <p className="small muted">Tick the real spends, then approve them. Tap a name to change it, and "+ tag" to tag it; next time that shop starts with your name, need or want, and tags.</p>
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
                  {r.tags.map((t) => <span key={t} className="chip-mini">#{t}</span>)}
                  <button type="button" className="bank-src-btn" aria-expanded={tagging === s.key} onClick={() => setTagging(tagging === s.key ? null : s.key)}>{tagging === s.key ? 'Done' : r.tags.length ? 'Tags' : '+ tag'}</button>
                  {s.logged && <span className="warn-mini">Already logged?</span>}
                  <button type="button" className="bank-src-btn" aria-expanded={shown === s.key} onClick={() => setShown(shown === s.key ? null : s.key)}>{shown === s.key ? 'Hide notification' : 'Notification'}</button>
                </div>
                {tagging === s.key && (
                  <div className="bank-tags">
                    <TagPicker id={`bank-tag-${s.key}`} value={r.tags} onChange={(tags) => set(s.key, { tags })} suggestions={topTags} />
                  </div>
                )}
                {shown === s.key && (
                  <div className="bank-src">
                    <blockquote>
                      <small>{s.app}</small>
                      {s.source.title && <b>{s.source.title}</b>}
                      <span>{s.source.text}</span>
                    </blockquote>
                    <button type="button" className="card-link" onClick={() => {
                      const before = actions.ignoreBankPattern(bankPattern(s.source.title, s.source.text));
                      actions.dismissBank([s.key]);
                      setShown(null);
                      showToast('Notifications like this won’t be suggested again', before);
                    }}>Not a spend: never show ones like this</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn ghost" disabled={!chosen.length} onClick={dismiss}>Dismiss</button>
        <button type="button" className="btn ghost" onClick={() => { dismissAll(suggestions); onClose(); }}>Dismiss all</button>
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
  const [history, setHistory] = useState(false);

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
  // A newly ticked app's notifications still in the shade are picked up straight away.
  useEffect(() => {
    if (!native) return;
    setBankApps(b.enabled ? b.apps : []).then(() => rebindBank()).then(() => bankSeenApps()).then((a) => setSeen(a.sort((x, y) => y.count - x.count)));
  }, [native, b.enabled, b.apps]);

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
          <input id="bank-on" type="checkbox" checked={b.enabled} onChange={(e) => actions.updateBankSettings({ enabled: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--done)' }} />
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
            {b.apps.length > 0 && (
              <button type="button" className="card-link" style={{ justifySelf: 'start' }} onClick={() => setHistory(true)}>Notification history</button>
            )}
          </div>
        )}
        <Sheet open={history} onClose={() => setHistory(false)} label="Notification history">
          {history && <HistoryBody />}
        </Sheet>
        {(b.ignore?.length ?? 0) > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <p className="small muted">Hidden notifications</p>
              <button type="button" className="card-link" onClick={() => { const before = actions.unignoreBankPattern(null); showToast('All hidden notifications can show again', before); }}>Reset</button>
            </div>
            {b.ignore!.map((p) => (
              <div key={p} className="row bank-hidden">
                {/* The wording with its numbers taken out, as it's matched. */}
                <span className="grow">{p.replace(/#+/g, '…')}</span>
                <button type="button" className="icon-btn" aria-label={`Show notifications like “${p.replace(/#+/g, '…')}” again`}
                  onClick={() => { const before = actions.unignoreBankPattern(p); showToast('That kind of notification can show again', before); }}>×</button>
              </div>
            ))}
            <p className="small muted">Ones you already dismissed stay dismissed; new ones like these will be suggested again.</p>
          </div>
        )}
      </div>
    </Card>
  );
}

const STATUS: Record<BankHistoryRow['status'], string> = {
  review: 'Waiting for review', logged: 'Logged', dismissed: 'Dismissed', hidden: 'Hidden (never show ones like this)',
  repeat: 'Repeat of an earlier one', skipped: 'Skipped',
};

/** Every notification kept from the ticked apps (30 days), newest first, with what happened to it and why. */
function HistoryBody() {
  const data = useData();
  const b = data.settings.bank;
  const notes = useBankNotes(true);
  const [only, setOnly] = useState<'all' | 'skipped'>('all');
  const rows = useMemo(() => bankHistory(notes, data.expenses, data.bankDismissed, b.ignore).reverse(), [notes, data.expenses, data.bankDismissed, b.ignore]);
  const shown = only === 'all' ? rows : rows.filter((r) => r.status !== 'review' && r.status !== 'logged');
  const today = todayISO();
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        <h2>Notification history</h2>
        <p className="small muted">Everything kept from the apps you ticked over the last 30 days, including ones you dismissed, and what the app made of each. Only notifications with a dollar amount are kept.</p>
      </div>
      <div className="seg" role="tablist" aria-label="Show" style={{ alignSelf: 'flex-start' }}>
        <button role="tab" aria-selected={only === 'all'} onClick={() => setOnly('all')}>All {rows.length}</button>
        <button role="tab" aria-selected={only === 'skipped'} onClick={() => setOnly('skipped')}>Not suggested {rows.filter((r) => r.status !== 'review' && r.status !== 'logged').length}</button>
      </div>
      {shown.length === 0 && <p className="small muted">{notes.length ? 'Nothing here.' : 'Nothing kept yet. Notifications with a dollar amount from the ticked apps appear here as they arrive.'}</p>}
      <ul className="bank-history">
        {shown.map((r) => {
          const d = todayISO(r.note.postedAt);
          return (
            <li key={r.note.key} className={`bh-${r.status}`}>
              <div className="row small" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span className="muted">{r.note.label} · {relativeDay(d, today)} {new Date(r.note.postedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</span>
                {r.amount !== undefined && <b className="num">{fmtMoney(r.amount)}</b>}
              </div>
              <blockquote>
                {r.note.title && <b>{r.note.title}</b>}
                <span>{r.note.text}</span>
              </blockquote>
              <div className="row small" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span className="bh-status">{STATUS[r.status]}{r.reason ? `: ${r.reason}` : ''}{r.merchant && r.status !== 'skipped' ? ` · shop "${r.merchant}"` : ''}</span>
                {r.status === 'dismissed' && (
                  <button type="button" className="card-link" onClick={() => { const before = actions.undismissBank([r.note.key]); showToast('Back up for review', before); }}>Review again</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
