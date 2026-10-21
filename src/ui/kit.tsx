// Shared building blocks used by every screen.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { IconCheck, IconClock, IconHome, IconMore, IconPlus, IconWallet } from './icons';
import { actions } from '../data/store';
import { go, moreView, openQuickAdd, toast, useRoute, type Route } from '../app/ui-state';
import type { SpendKind } from '../data/types';

export function Band({ children }: { children: ReactNode }) {
  return <header className="band">{children}</header>;
}

export function Card({ title, action, children, className = '', id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || action) && (
        <div className="card-head">
          {title ? <h2 className="card-title">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function CheckBox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" className="check" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}>
      <span className="box">{checked && <IconCheck size={13} />}</span>
    </button>
  );
}

export interface Option<T extends string> { value: T; label: string; color?: string }

export function ChipGroup<T extends string>({ options, value, onChange, label }: { options: Option<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
          {o.color && <span className="swatch" style={{ background: o.color }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Need or want: every expense has one, so neither is preselected. */
export function KindToggle({ value, onChange }: { value: SpendKind | null; onChange: (k: SpendKind) => void }) {
  return (
    <div className="kind-toggle" role="radiogroup" aria-label="Need or want">
      {(['need', 'want'] as const).map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={k} onClick={() => onChange(k)}>
          <span className="dot" />{k === 'need' ? 'Need' : 'Want'}
        </button>
      ))}
    </div>
  );
}

/** Optional tags: tap a suggestion or type a new one (Enter, comma or space adds it). */
export function TagPicker({ id, value, onChange, suggestions }: { id: string; value: string[]; onChange: (tags: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState('');
  const shown = Array.from(new Set([...value, ...suggestions])).slice(0, Math.max(8, value.length));
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const commit = () => {
    const t = text.trim().replace(/^#/, '').toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '');
    if (t && !value.includes(t)) onChange([...value, t]);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="chips tag-picker" role="group" aria-label="Tags">
      {shown.map((t) => (
        <button key={t} type="button" className="chip tag-chip" aria-pressed={value.includes(t)} onClick={() => toggle(t)}>#{t}</button>
      ))}
      <label htmlFor={id} className="sr-only">New tag</label>
      <input id={id} className="tag-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={commit} placeholder="+ tag" autoComplete="off" enterKeyHint="done" />
    </div>
  );
}

export function Bar({ segments, max, height = 6 }: { segments: { value: number; color: string }[]; max: number; height?: number }) {
  return (
    <div className="bar" style={{ height }} role="presentation">
      {segments.map((s, i) => (
        <span key={i} style={{ width: `${max > 0 ? Math.min(100, (s.value / max) * 100) : 0}%`, background: s.color }} />
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // Focus the sheet itself so phones don't pop the keyboard over the content.
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref} tabIndex={-1} style={{ outline: 'none' }}>
        <span className="grabber" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

const NAV: { route: Route; label: string; icon: ReactNode; match: Route[] }[] = [
  { route: 'home', label: 'Home', icon: <IconHome />, match: ['home', 'tasks'] },
  { route: 'time', label: 'Time', icon: <IconClock />, match: ['time', 'week', 'stats', 'journal'] },
  { route: 'money', label: 'Money', icon: <IconWallet />, match: ['money'] },
  { route: 'more', label: 'More', icon: <IconMore />, match: ['more'] },
];

export function BottomNav() {
  const route = useRoute();
  const link = (n: (typeof NAV)[number]) => (
    <a key={n.route} href={`#${n.route}`} aria-current={n.match.includes(route) ? 'page' : undefined} onClick={(e) => { e.preventDefault(); if (n.route === 'more') moreView.set({ kind: 'hub' }); go(n.route); }}>
      {n.icon}
      {n.label}
    </a>
  );
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        {link(NAV[0])}
        {link(NAV[1])}
        <button type="button" className="add" aria-label="Quick add" onClick={() => openQuickAdd(route === 'money' ? 'spend' : route === 'time' || route === 'week' || route === 'stats' || route === 'journal' ? 'time' : route === 'tasks' ? 'task' : 'spend')}>
          <IconPlus size={26} />
        </button>
        {link(NAV[2])}
        {link(NAV[3])}
      </div>
    </nav>
  );
}

export function ToastHost() {
  const t = toast.use();
  if (!t) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {t.text}
      {t.undo && (
        <button type="button" onClick={() => { actions.restore(t.undo!); toast.set(null); }}>
          Undo
        </button>
      )}
    </div>
  );
}
