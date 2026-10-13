// Bottom sheet for adding, editing, planning or deleting a block of time.
import { useState, type FormEvent } from 'react';
import { actions, useData } from '../../data/store';
import type { Day, ID } from '../../data/types';
import { fmtDayShort, fromTimeInput, isoOf, minutesOfDay, msAt, toTimeInput } from '../../lib/dates';
import { ChipGroup, Sheet } from '../../ui/kit';
import { showToast } from '../../app/ui-state';

export type EditTarget = { kind: 'entry'; id: ID } | { kind: 'planned'; id: ID } | { kind: 'new'; day: Day; startMin: number };

export function EntryEditor({ target, onClose }: { target: EditTarget | null; onClose: () => void }) {
  return (
    <Sheet open={target !== null} onClose={onClose} label="Time block">
      {target && <EditorBody key={JSON.stringify(target)} target={target} onClose={onClose} />}
    </Sheet>
  );
}

function EditorBody({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  const data = useData();
  const entry = target.kind === 'entry' ? data.entries.find((e) => e.id === target.id) : undefined;
  const plan = target.kind === 'planned' ? data.planned.find((p) => p.id === target.id) : undefined;
  const running = entry?.end === null;

  const initDay = entry ? isoOf(entry.start) : plan ? plan.day : target.kind === 'new' ? target.day : '';
  const initStart = entry ? minutesOfDay(entry.start) : plan ? plan.startMin : target.kind === 'new' ? target.startMin : 9 * 60;
  const initEnd = entry ? (entry.end === null ? minutesOfDay(Date.now()) : minutesOfDay(entry.end)) : plan ? plan.endMin : initStart + 60;
  const isFutureNew = target.kind === 'new' && msAt(target.day, target.startMin) > Date.now();

  const [label, setLabel] = useState(entry?.label ?? plan?.label ?? '');
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? plan?.categoryId ?? data.timeCategories[0]?.id ?? '');
  const [day, setDay] = useState(initDay);
  const [start, setStart] = useState(toTimeInput(initStart));
  const [end, setEnd] = useState(toTimeInput(Math.min(initEnd, 24 * 60 - 1)));
  const [planned, setPlanned] = useState(target.kind === 'planned' || isFutureNew);
  const [error, setError] = useState('');

  const title = entry ? (running ? 'Running timer' : 'Edit block') : plan ? 'Planned block' : 'New block';

  const save = (e: FormEvent) => {
    e.preventDefault();
    const s = fromTimeInput(start);
    const t = fromTimeInput(end);
    if (s === null || (!running && t === null)) return setError('Enter a start and end time.');
    if (!running && t! <= s) return setError('The end time needs to be after the start time.');
    if (!day) return setError('Pick a day.');
    if (entry) {
      actions.updateEntry(entry.id, { label: label.trim(), categoryId, start: msAt(day, s), end: running ? null : msAt(day, t!) });
    } else if (plan && planned) {
      actions.updatePlanned(plan.id, { label: label.trim(), categoryId, day, startMin: s, endMin: t! });
    } else if (planned) {
      actions.addPlanned({ label: label.trim(), categoryId, day, startMin: s, endMin: t! });
    } else {
      if (plan) actions.deletePlanned(plan.id);
      actions.addEntry({ label: label.trim(), categoryId, start: msAt(day, s), end: msAt(day, t!) });
    }
    showToast(planned ? 'Plan saved' : 'Block saved');
    onClose();
  };

  const remove = () => {
    const before = entry ? actions.deleteEntry(entry.id) : plan ? actions.deletePlanned(plan.id) : null;
    if (before) showToast('Block deleted', before);
    onClose();
  };

  return (
    <form onSubmit={save} className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{title}</h2>
        {day && <span className="small muted">{fmtDayShort(day)}</span>}
      </div>
      <label className="field" htmlFor="entry-label">
        What
        <input id="entry-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. COMP2521 lecture" list="entry-label-suggestions" autoComplete="off" />
        <datalist id="entry-label-suggestions">
          {Array.from(new Set(data.entries.map((e) => e.label))).slice(-20).map((l) => <option key={l} value={l} />)}
        </datalist>
      </label>
      <ChipGroup label="Category" value={categoryId} onChange={setCategoryId} options={data.timeCategories.map((c) => ({ value: c.id, label: c.name, color: c.color }))} />
      <div className="grid2" style={{ gridTemplateColumns: running ? '1fr 1fr' : '1.3fr 1fr 1fr' }}>
        <label className="field" htmlFor="entry-day">Day<input id="entry-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} disabled={running} /></label>
        <label className="field" htmlFor="entry-start">From<input id="entry-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        {!running && <label className="field" htmlFor="entry-end">To<input id="entry-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>}
      </div>
      {!entry && (
        <label className="row small" htmlFor="entry-planned" style={{ gap: 10, minHeight: 44 }}>
          <input id="entry-planned" type="checkbox" checked={planned} onChange={(e) => setPlanned(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--done)' }} />
          Planned · not done yet (shows dashed on the timeline)
        </label>
      )}
      {error && <p className="warn small" role="alert">{error}</p>}
      <button type="submit" className="btn primary block">Save</button>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {running && <button type="button" className="btn green" onClick={() => { actions.stopTimer(); showToast('Timer stopped'); onClose(); }}>Stop timer</button>}
        {plan && <button type="button" className="btn green" onClick={() => { actions.startPlanned(plan.id); showToast(`Started ${plan.label || 'timer'}`); onClose(); }}>Start timer now</button>}
        {entry && !running && <button type="button" className="btn" onClick={() => { actions.startTimer(entry.label, entry.categoryId); showToast(`Started ${entry.label || 'timer'}`); onClose(); }}>Start again</button>}
        {(entry || plan) && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
        <button type="button" className="btn ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>Cancel</button>
      </div>
    </form>
  );
}
