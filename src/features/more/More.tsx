// Settings and data tools. Kept deliberately plain; the More screen gets its proper design in a later round.
import { useState, type ChangeEvent } from 'react';
import { actions, getData, storageKind, useData } from '../../data/store';
import { go, showToast } from '../../app/ui-state';
import { Band, Card, ChipGroup } from '../../ui/kit';
import { IconRight } from '../../ui/icons';

const STORAGE_TEXT = {
  indexeddb: 'Saved on this device.',
  localstorage: 'Saved on this device (basic browser storage).',
  memory: 'This browser is blocking storage, so changes last until you close the page. Export a backup to keep them.',
};

export function More() {
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
        <h1>More</h1>
        <p className="band-sub">Settings and your data.</p>
      </Band>

      <div className="content two">
        <Card title="Planner">
          <button className="item-main row" style={{ width: '100%', minHeight: 48 }} onClick={() => go('tasks')}>
            <span className="grow" style={{ fontSize: 15 }}>Tasks</span>
            <span className="small muted">{data.tasks.filter((t) => !t.done).length} open</span>
            <IconRight size={16} />
          </button>
          <p className="small muted" style={{ marginTop: 8 }}>Trackers, Lists and Journal are being redesigned and will come in a later build.</p>
        </Card>

        <Card title="Display">
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

        <Card title="Time categories">
          <div className="stack">
            {data.timeCategories.map((c) => (
              <label key={c.id} className="row" htmlFor={`tc-${c.id}`}>
                <span className="swatch" style={{ background: c.color, width: 14, height: 14 }} />
                <span className="sr-only">Name</span>
                <input id={`tc-${c.id}`} defaultValue={c.name} onBlur={(e) => e.target.value.trim() && actions.renameTimeCategory(c.id, e.target.value.trim())} className="grow" style={{ minHeight: 40, border: '1.5px solid var(--line)', borderRadius: 10, padding: '0 10px', background: 'var(--card)', color: 'var(--ink)', fontSize: 15 }} />
              </label>
            ))}
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (newCat.trim()) { actions.addTimeCategory(newCat.trim()); setNewCat(''); } }}>
              <label htmlFor="new-tc" className="sr-only">New category</label>
              <input id="new-tc" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" className="grow" style={{ minHeight: 40, border: '1.5px dashed var(--line)', borderRadius: 10, padding: '0 10px', background: 'transparent', color: 'var(--ink)', fontSize: 15 }} />
              <button className="btn" type="submit">Add</button>
            </form>
            <p className="small muted">The weekly allowance is set on the Money screen (tap the allowance under the total).</p>
          </div>
        </Card>

        <Card title="Your data">
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
      </div>
    </>
  );
}
