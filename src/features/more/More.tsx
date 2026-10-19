// Settings and data tools. Kept deliberately plain; the More screen gets its proper design in a later round.
import { useState, type ChangeEvent } from 'react';
import { actions, getData, storageKind, useData } from '../../data/store';
import { moreView, showToast } from '../../app/ui-state';
import { Band, Card, ChipGroup } from '../../ui/kit';
import { IconArrowDown, IconTrash } from '../../ui/icons';
import { CATEGORY_COLORS } from '../../data/seed';
import { PhoneSettingsCard } from '../time/phone';
import { phoneAvailable } from '../../lib/phone';
import type { TimeCategory } from '../../data/types';

const STORAGE_TEXT = {
  indexeddb: 'Saved on this device.',
  localstorage: 'Saved on this device (basic browser storage).',
  memory: 'This browser is blocking storage, so changes last until you close the page. Export a backup to keep them.',
};

/** Settings: display, activities, phone tracking and your data. Opened from the More hub. */
export function Settings() {
  const data = useData();
  const s = data.settings;
  const [backup, setBackup] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [confirm, setConfirm] = useState<'erase' | 'example' | null>(null);
  const [newCat, setNewCat] = useState('');

  const showBackup = () => setBackup(JSON.stringify(getData(), null, 1));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(backup ?? '');
      showToast('Backup copied');
    } catch {
      (document.getElementById('backup-text') as HTMLTextAreaElement | null)?.select();
      showToast('Select all and copy the text');
    }
  };
  const download = () => {
    const blob = new Blob([backup ?? ''], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const restore = (text: string) => {
    try {
      if (actions.importData(JSON.parse(text))) { showToast('Backup restored'); setPaste(''); return; }
    } catch { /* fall through */ }
    showToast("That doesn't look like a planner backup");
  };
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) restore(await f.text());
    e.target.value = '';
  };

  return (
    <>
      <Band>
        <button type="button" className="backlink" onClick={() => moreView.set({ kind: 'hub' })}>‹ More</button>
        <h1>Settings</h1>
      </Band>

      <div className="content two">
        <Card title="Display" id="set-display">
          <div className="stack" style={{ gap: 12 }}>
            <p className="label">Theme</p>
            <ChipGroup label="Theme" value={s.theme} onChange={(theme) => actions.updateSettings({ theme })} options={[{ value: 'system', label: 'Match device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
            <p className="label">Timeline starts at</p>
            <ChipGroup<string> label="Timeline start" value={String(s.dayStartHour)} onChange={(v) => actions.updateSettings({ dayStartHour: Number(v) })} options={[6, 7, 8, 9].map((h) => ({ value: String(h), label: `${h} am` }))} />
            <p className="label">Timeline ends at</p>
            <ChipGroup<string> label="Timeline end" value={String(s.dayEndHour)} onChange={(v) => actions.updateSettings({ dayEndHour: Number(v) })} options={[20, 21, 22, 23].map((h) => ({ value: String(h), label: `${h - 12} pm` }))} />
            <label className="field" htmlFor="goal">Daily time goal
              <select id="goal" value={s.dailyGoalMin} onChange={(e) => actions.updateSettings({ dailyGoalMin: Number(e.target.value) })}>
                <option value={0}>No goal</option>
                {[2, 3, 4, 5, 6, 7, 8].map((h) => <option key={h} value={h * 60}>{h} hours</option>)}
              </select>
            </label>
            <label className="row" htmlFor="stickers" style={{ minHeight: 44, gap: 10, fontSize: 15 }}>
              <input id="stickers" type="checkbox" checked={s.stickers} onChange={(e) => actions.updateSettings({ stickers: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--done)' }} />
              Show stickers on Home
            </label>
          </div>
        </Card>

        <Card title="Time categories" id="set-activities">
          <div className="stack">
            <p className="small muted">Tap a colour dot to change it. The arrow button draws an activity as a thin arrow on the day, like travel.</p>
            {data.timeCategories.map((c) => <CategoryRow key={c.id} c={c} all={data.timeCategories} />)}
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (newCat.trim()) { actions.addTimeCategory(newCat.trim()); setNewCat(''); } }}>
              <label htmlFor="new-tc" className="sr-only">New category</label>
              <input id="new-tc" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" className="grow" style={{ minHeight: 40, border: '1.5px dashed var(--line)', borderRadius: 10, padding: '0 10px', background: 'transparent', color: 'var(--ink)', fontSize: 15 }} />
              <button className="btn" type="submit">Add</button>
            </form>
            <p className="small muted">The weekly allowance is set on the Money screen (tap the allowance under the total).</p>
          </div>
        </Card>

        <div id="set-phone"><PhoneSettingsCard /></div>

        <Card title="Your data" id="set-data">
          <div className="stack">
            <p style={{ fontSize: 14 }}>{STORAGE_TEXT[storageKind]}</p>
            {backup === null ? (
              <button className="btn" onClick={showBackup}>Back up my data</button>
            ) : (
              <>
                <label className="field" htmlFor="backup-text">Backup (keep this text somewhere safe)
                  <textarea id="backup-text" readOnly value={backup} rows={4} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }} />
                </label>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button className="btn" onClick={copy}>Copy</button>
                  {!__PREVIEW__ && <button className="btn" onClick={download}>Download file</button>}
                  <button className="btn ghost" onClick={() => setBackup(null)}>Close</button>
                </div>
              </>
            )}
            <label className="field" htmlFor="restore-text">Restore from a backup
              <textarea id="restore-text" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste backup text here" rows={3} />
            </label>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn" disabled={!paste.trim()} onClick={() => restore(paste)}>Restore</button>
              <label className="btn ghost" htmlFor="restore-file" style={{ cursor: 'pointer' }}>Choose file…</label>
              <input id="restore-file" type="file" accept="application/json,.json" onChange={onFile} className="sr-only" />
            </div>

            {confirm ? (
              <div className="confirm" role="alert">
                <p style={{ fontSize: 14 }}>{confirm === 'erase' ? 'Erase all your time, spending and tasks? Categories and settings stay.' : 'Replace everything with the example week?'}</p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn primary" onClick={() => { if (confirm === 'erase') actions.startFresh(); else actions.loadExample(); showToast(confirm === 'erase' ? 'Everything erased' : 'Example week loaded'); setConfirm(null); }}>
                    {confirm === 'erase' ? 'Erase' : 'Load example'}
                  </button>
                  <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button className="btn ghost" onClick={() => setConfirm('example')}>Load example week</button>
                <button className="btn danger" onClick={() => setConfirm('erase')}>Erase everything</button>
              </div>
            )}
          </div>
        </Card>
        <p className="small muted" style={{ textAlign: 'center' }}>{builtLabel()}</p>
      </div>
    </>
  );
}

/** Which build this is, e.g. "Android app · version 19 Oct, 1:28 pm". */
function builtLabel() {
  const d = new Date(__BUILT_AT__);
  const when = `${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
  return `${phoneAvailable() ? 'Android app' : 'Web app'} · version ${when}`;
}

/** One activity: colour, name, drawn as an arrow or a block, and delete (moving its time somewhere else). */
function CategoryRow({ c, all }: { c: TimeCategory; all: TimeCategory[] }) {
  const data = useData();
  const [colours, setColours] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const others = all.filter((x) => x.id !== c.id);
  const [moveTo, setMoveTo] = useState<string>(others[0]?.id ?? '');
  const used = data.entries.filter((e) => e.categoryId === c.id).length
    + data.planned.filter((p) => p.categoryId === c.id).length
    + data.templates.reduce((n, t) => n + t.blocks.filter((b) => b.categoryId === c.id).length, 0);
  const remove = () => {
    const before = actions.deleteTimeCategory(c.id, used ? moveTo || null : null);
    showToast(used && moveTo ? `Deleted ${c.name}. Its time moved to ${all.find((x) => x.id === moveTo)?.name}.` : `Deleted ${c.name}`, before);
  };
  return (
    <div className="cat-row">
      <div className="row">
        <button type="button" className="cat-dot" style={{ background: c.color }} aria-label={`Colour for ${c.name}`} aria-expanded={colours} onClick={() => setColours(!colours)} />
        <label className="sr-only" htmlFor={`tc-${c.id}`}>Name</label>
        <input id={`tc-${c.id}`} defaultValue={c.name} onBlur={(e) => e.target.value.trim() && actions.renameTimeCategory(c.id, e.target.value.trim())} className="grow cat-name" />
        <button type="button" className="icon-btn cat-tool" aria-pressed={Boolean(c.arrow)} aria-label={`Draw ${c.name} as an arrow`} title="Draw as an arrow" onClick={() => actions.updateTimeCategory(c.id, { arrow: !c.arrow })}><IconArrowDown size={18} /></button>
        {others.length > 0 && <button type="button" className="icon-btn cat-tool" aria-label={`Delete ${c.name}`} aria-expanded={deleting} onClick={() => setDeleting(!deleting)}><IconTrash size={18} /></button>}
      </div>
      {colours && (
        <div className="cat-colours" role="radiogroup" aria-label={`Colour for ${c.name}`}>
          {CATEGORY_COLORS.map((col) => (
            <button key={col} type="button" role="radio" aria-checked={col.toUpperCase() === c.color.toUpperCase()} aria-label={col} style={{ background: col }}
              onClick={() => { actions.updateTimeCategory(c.id, { color: col }); setColours(false); }} />
          ))}
        </div>
      )}
      {deleting && (
        <div className="cat-delete">
          {used > 0 ? (
            <label htmlFor={`mv-${c.id}`} className="small">
              {c.name} is used {used} {used === 1 ? 'time' : 'times'}. Move that time to
              <select id={`mv-${c.id}`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                <option value="">Nothing (delete that time too)</option>
              </select>
            </label>
          ) : <p className="small">{c.name} isn't used anywhere yet.</p>}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn danger" onClick={remove}>Delete {c.name}</button>
            <button type="button" className="btn ghost" onClick={() => setDeleting(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
