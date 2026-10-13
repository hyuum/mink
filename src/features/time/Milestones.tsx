// Milestones: icons, the picker sheet, and the little tags drawn on the timeline.
import { useState, type FormEvent, type ReactNode } from 'react';
import { actions, useData } from '../../data/store';
import { bedMinFromClock, milestoneName, milestonesForDay } from '../../data/logic';
import { MILESTONE_KINDS } from '../../data/seed';
import type { Day, ID, MilestoneKind } from '../../data/types';
import { fmtDayShort, fmtHM, fromTimeInput, minutesOfDay, toTimeInput, todayISO } from '../../lib/dates';
import { showToast } from '../../app/ui-state';
import { Sheet } from '../../ui/kit';
import { IconFlag, IconHome, IconLeave, IconLunch, IconMoon, IconPin, IconPlus, IconStar, IconSun } from '../../ui/icons';

export function MilestoneIcon({ kind, size = 14 }: { kind: MilestoneKind; size?: number }) {
  const map: Record<MilestoneKind, ReactNode> = {
    wake: <IconSun size={size} />, leave: <IconLeave size={size} />, arrive: <IconPin size={size} />, lunch: <IconLunch size={size} />,
    home: <IconHome size={size} />, bed: <IconMoon size={size} />, custom: <IconStar size={size} />,
  };
  return <>{map[kind]}</>;
}

/** Clock text for a milestone minute, which can run past midnight. */
export const fmtMilestone = (min: number) => fmtHM(min % (24 * 60));

export type MilestoneTarget = { day: Day; id?: ID } | null;

export function MilestoneEditor({ target, onClose }: { target: MilestoneTarget; onClose: () => void }) {
  return (
    <Sheet open={target !== null} onClose={onClose} label="Milestone">
      {target && <Body key={`${target.day}-${target.id ?? 'new'}`} day={target.day} id={target.id} onClose={onClose} />}
    </Sheet>
  );
}

function Body({ day, id, onClose }: { day: Day; id?: ID; onClose: () => void }) {
  const data = useData();
  const existing = id ? data.milestones.find((m) => m.id === id) : undefined;
  const onDay = milestonesForDay(data.milestones, day);
  const isToday = day === todayISO();
  const nowMin = Math.round(minutesOfDay(Date.now()) / 5) * 5;
  // Suggest the first built-in kind not logged yet today.
  const firstMissing = MILESTONE_KINDS.find((k) => !onDay.some((m) => m.kind === k.kind))?.kind ?? 'custom';
  const [kind, setKind] = useState<MilestoneKind>(existing?.kind ?? firstMissing);
  const [label, setLabel] = useState(existing?.label ?? '');
  const [time, setTime] = useState(toTimeInput(existing ? existing.min % 1440 : isToday ? nowMin : 9 * 60));
  const [error, setError] = useState('');

  const save = (e: FormEvent) => {
    e.preventDefault();
    const clock = fromTimeInput(time);
    if (clock === null) return setError('Pick a time.');
    if (kind === 'custom' && !label.trim()) return setError('Give your milestone a name.');
    const min = kind === 'bed' ? bedMinFromClock(clock) : clock;
    const value = { kind, label: kind === 'custom' ? label.trim() : '', day, min };
    if (existing) actions.updateMilestone(existing.id, value);
    else actions.addMilestone(value);
    showToast(`${milestoneName(value)} · ${fmtMilestone(min)}`);
    onClose();
  };

  const tiles = [...MILESTONE_KINDS, { kind: 'custom' as const, name: 'Your own' }];

  return (
    <form onSubmit={save} className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2>{existing ? 'Edit milestone' : 'Milestone'}</h2>
        <span className="small muted">{isToday ? 'Today' : fmtDayShort(day)}</span>
      </div>
      <div className="ms-grid" role="radiogroup" aria-label="Milestone">
        {tiles.map((t) => {
          const logged = onDay.find((m) => m.kind === t.kind && t.kind !== 'custom');
          return (
            <button key={t.kind} type="button" role="radio" aria-checked={kind === t.kind} className="ms-tile" onClick={() => { setKind(t.kind); setError(''); }}>
              {t.kind === 'custom' ? <IconPlus size={20} /> : <MilestoneIcon kind={t.kind} size={20} />}
              <span className="ms-name">{t.name}</span>
              <span className="small muted">{logged ? fmtMilestone(logged.min) : t.kind === 'custom' ? 'e.g. Meds' : 'not yet'}</span>
            </button>
          );
        })}
      </div>
      {kind === 'custom' && (
        <label className="field" htmlFor="ms-label">Name<input id="ms-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Medication, Class starts" autoComplete="off" /></label>
      )}
      <div className="inline-input">
        <label htmlFor="ms-time" className="small muted">Time</label>
        <input id="ms-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="num" style={{ fontSize: 18 }} />
        {isToday && <button type="button" className="btn" style={{ minHeight: 38 }} onClick={() => setTime(toTimeInput(nowMin))}>Now</button>}
      </div>
      {kind === 'bed' && <p className="small muted">A bedtime after midnight still counts for {isToday ? 'tonight' : fmtDayShort(day)}.</p>}
      {(kind === 'wake' || kind === 'bed') && <p className="small muted">Wake up and Bed draw the sleep line on the Week view.</p>}
      {error && <p className="warn small" role="alert">{error}</p>}
      <button type="submit" className="btn primary block">{existing ? 'Save' : `Add ${milestoneName({ kind, label })}${time ? ` at ${fmtHM(fromTimeInput(time) ?? 0)}` : ''}`}</button>
      <div className="row">
        {existing && <button type="button" className="btn danger" onClick={() => { showToast('Milestone removed', actions.deleteMilestone(existing.id)); onClose(); }}>Remove</button>}
        <button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export function FlagButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="icon-btn flag-btn" aria-label="Add a milestone" onClick={onClick}><IconFlag size={18} /></button>;
}
