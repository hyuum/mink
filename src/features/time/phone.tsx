// Phone tracking, in the Android app: stretches of phone use show up on the Day view as suggestions.
// You review them (one at a time, or all at once) and approve or dismiss them. Settings live in More.
import { useEffect, useMemo, useState } from 'react';
import { actions, useData } from '../../data/store';
import { phoneCategory, phoneSuggestions, type PhoneSession, type PhoneSuggestion } from '../../data/logic';
import type { ID, TimeCategory } from '../../data/types';
import { addDays, dayStartMs, fmtDuration, fmtHM, minutesOfDay } from '../../lib/dates';
import { hasPhoneAccess, openPhoneAccessSettings, phoneAvailable, phoneSessions } from '../../lib/phone';
import { showToast } from '../../app/ui-state';
import { Card, Sheet } from '../../ui/kit';

/** Re-reads phone use when the app comes back to the front, and every few minutes while open. */
function usePhoneSessions(from: number, to: number, on: boolean): PhoneSession[] {
  const [sessions, setSessions] = useState<PhoneSession[]>([]);
  useEffect(() => {
    if (!on) { setSessions([]); return; }
    let live = true;
    const load = () => { phoneSessions(from, to).then((s) => { if (live) setSessions(s); }); };
    load();
    const onShow = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onShow);
    const timer = setInterval(load, 5 * 60_000);
    return () => { live = false; document.removeEventListener('visibilitychange', onShow); clearInterval(timer); };
  }, [from, to, on]);
  return sessions;
}

/** Suggestions for one day (empty outside the Android app or when tracking is off). */
export function usePhoneSuggestions(day: string, today: string): PhoneSuggestion[] {
  const data = useData();
  const on = phoneAvailable() && data.settings.phone.enabled && day <= today;
  const from = dayStartMs(day);
  const to = dayStartMs(addDays(day, 1));
  const sessions = usePhoneSessions(from, to, on);
  return useMemo(
    () => (on ? phoneSuggestions(sessions, data.entries, data.settings.phone, data.phoneDismissed, Date.now()) : []),
    [on, sessions, data.entries, data.settings.phone, data.phoneDismissed],
  );
}

const appsText = (s: PhoneSuggestion) => s.apps.slice(0, 3).map((a) => `${a.label} ${fmtDuration(a.min)}`).join(' · ') + (s.apps.length > 3 ? ` · +${s.apps.length - 3}` : '');
const minOf = (ms: number) => minutesOfDay(ms);

/** Review sheet: every suggestion with a tick and an activity; approve or dismiss the ticked ones. */
export function PhoneReview({ open, suggestions, focus, cats, onClose }: {
  open: boolean; suggestions: PhoneSuggestion[]; focus?: string | null; cats: TimeCategory[]; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Phone use to review">
      {open && <ReviewBody key={focus ?? 'all'} suggestions={focus ? suggestions.filter((s) => s.key === focus) : suggestions} cats={cats} onClose={onClose} />}
    </Sheet>
  );
}

function ReviewBody({ suggestions, cats, onClose }: { suggestions: PhoneSuggestion[]; cats: TimeCategory[]; onClose: () => void }) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(suggestions.map((s) => s.key)));
  const [cat, setCat] = useState<Record<string, ID>>(() => Object.fromEntries(suggestions.map((s) => [s.key, s.categoryId])));
  const chosen = suggestions.filter((s) => ticked.has(s.key));
  const toggle = (k: string) => setTicked((t) => { const n = new Set(t); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const approve = () => {
    const before = actions.approvePhone(chosen.map((s) => ({ key: s.key, start: s.start, end: s.end, categoryId: cat[s.key], label: s.apps[0]?.label ?? 'Phone' })));
    showToast(`Approved ${chosen.length} · ${fmtDuration(chosen.reduce((t, s) => t + (s.end - s.start) / 60_000, 0))}`, before);
    onClose();
  };
  const dismiss = () => {
    const before = actions.dismissPhone(chosen.map((s) => s.key));
    showToast(`Dismissed ${chosen.length}`, before);
    onClose();
  };
  if (!suggestions.length) return <p className="small muted">Nothing left to review.</p>;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <h2>Phone use</h2>
        <p className="small muted">{suggestions.length === 1 ? 'Approve it as a block, or dismiss it.' : 'Untick any you want to treat differently, then approve or dismiss the ticked ones.'}</p>
      </div>
      <div className="phone-list">
        {suggestions.map((s) => (
          <div key={s.key} className="phone-row">
            {suggestions.length > 1 && <input type="checkbox" id={`ph-${s.key}`} checked={ticked.has(s.key)} onChange={() => toggle(s.key)} aria-label={`Include ${fmtHM(minOf(s.start))}`} />}
            <label htmlFor={`ph-${s.key}`} className="grow" style={{ minWidth: 0 }}>
              <b>{fmtHM(minOf(s.start))} – {fmtHM(minOf(s.end))} · {fmtDuration((s.end - s.start) / 60_000)}</b>
              <small>{appsText(s)}</small>
            </label>
            <select aria-label="Counts as" value={cat[s.key]} onChange={(e) => setCat({ ...cat, [s.key]: e.target.value })}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn green grow" disabled={!chosen.length} onClick={approve}>Approve {chosen.length > 1 ? chosen.length : ''}</button>
        <button type="button" className="btn ghost" disabled={!chosen.length} onClick={dismiss}>Dismiss</button>
      </div>
    </div>
  );
}

/** More › Phone tracking. In the browser it explains that it needs the Android app. */
export function PhoneSettingsCard() {
  const data = useData();
  const p = data.settings.phone;
  const cats = data.timeCategories;
  const native = phoneAvailable();
  const [access, setAccess] = useState<boolean | null>(null);
  const [week, setWeek] = useState<PhoneSession[]>([]);

  useEffect(() => {
    if (!native) return;
    const check = () => { hasPhoneAccess().then(setAccess); };
    check();
    const onShow = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [native]);
  useEffect(() => {
    if (!native || !access) return;
    phoneSessions(Date.now() - 7 * 86_400_000, Date.now()).then(setWeek);
  }, [native, access]);

  // Apps used in the last week, most used first.
  const apps = useMemo(() => {
    const m = new Map<string, { pkg: string; label: string; min: number }>();
    for (const s of week) {
      const cur = m.get(s.pkg) ?? { pkg: s.pkg, label: s.label, min: 0 };
      cur.min += (s.end - s.start) / 60_000;
      m.set(s.pkg, cur);
    }
    return [...m.values()].sort((a, b) => b.min - a.min);
  }, [week]);

  if (!native) {
    return (
      <Card title="Phone tracking">
        <p className="small muted">In the Android app, long stretches of phone use can show up on your day as suggestions to approve. It isn't available in the browser.</p>
      </Card>
    );
  }
  const setApp = (pkg: string, v: string) => actions.updatePhoneSettings({ apps: { ...p.apps, [pkg]: v === '' ? null : v } });
  return (
    <Card title="Phone tracking">
      <div className="stack">
        <label className="row" htmlFor="phone-on" style={{ minHeight: 44, gap: 10, fontSize: 15 }}>
          <input id="phone-on" type="checkbox" checked={p.enabled} onChange={(e) => actions.updatePhoneSettings({ enabled: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--done)' }} />
          Suggest blocks from phone use
        </label>
        {p.enabled && access === false && (
          <div className="phone-access">
            <p className="small">Turn on <b>Usage access</b> for Matcha Planner so it can see which app was open and when. It never sees what you did inside an app.</p>
            <button type="button" className="btn" onClick={() => openPhoneAccessSettings()}>Open Usage access</button>
          </div>
        )}
        {p.enabled && (
          <>
            <div className="grid2">
              <label className="field" htmlFor="phone-min">A block needs at least
                <select id="phone-min" value={p.minMin} onChange={(e) => actions.updatePhoneSettings({ minMin: Number(e.target.value) })}>
                  {[2, 3, 5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </label>
              <label className="field" htmlFor="phone-gap">Join breaks shorter than
                <select id="phone-gap" value={p.gapMin} onChange={(e) => actions.updatePhoneSettings({ gapMin: Number(e.target.value) })}>
                  {[1, 2, 3, 5, 10].map((m) => <option key={m} value={m}>{m} {m === 1 ? 'minute' : 'minutes'}</option>)}
                </select>
              </label>
            </div>
            <label className="field" htmlFor="phone-default">Other apps count as
              <select id="phone-default" value={p.defaultCategoryId ?? ''} onChange={(e) => actions.updatePhoneSettings({ defaultCategoryId: e.target.value || null })}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="">Don't count</option>
              </select>
            </label>
            {access && (
              <div className="stack" style={{ gap: 6 }}>
                <p className="small muted">Your apps this week</p>
                {apps.length === 0 && <p className="small muted">No app use recorded yet.</p>}
                {apps.map((a) => (
                  <div key={a.pkg} className="row phone-app">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <b>{a.label}</b>
                      <small>{fmtDuration(a.min)} this week</small>
                    </div>
                    <select aria-label={`${a.label} counts as`} value={phoneCategory(p, a.pkg) ?? ''} onChange={(e) => setApp(a.pkg, e.target.value)}>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value="">Don't count</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
