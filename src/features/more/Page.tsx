// A page in More, written like a note: each line is a to-do, a repeat, a days-since count, a heading or
// a plain note. Tap ○ to tick; hold ↻ or a count to mark it done (the line fills while you hold); tap
// them for their history; tap the words to edit; swipe a line right for its options, or a ticked
// to-do left to remove it; hold the words to drag the line somewhere else; type or paste at the end.
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { actions, getData, useData } from '../../data/store';
import { WEEKDAY_NAMES, lineKind, pageItems, pageSummary, pastAim, repeatText, trackerStatus, type PageItem } from '../../data/logic';
import type { AppData, ID, LineKind, RepeatUnit, TrackerItem } from '../../data/types';
import { addDays, fmtDayShort, todayISO } from '../../lib/dates';
import { moreView, showToast, useNow } from '../../app/ui-state';
import { Band, Sheet } from '../../ui/kit';
import { ThingIcon } from '../../ui/things';
import { FolderOptionsSheet } from './Hub';

const HOLD_MS = 700;
const SWIPE_OPTIONS = 70;
const SWIPE_REMOVE = 90;
const LIFT_MS = 420;
const KIND_NAMES: Record<LineKind, string> = { todo: 'To-do', repeat: 'Repeat', since: 'Days since', heading: 'Heading', note: 'Note' };
const AIMS: [number, string][] = [[0, 'None'], [7, '1 week'], [14, '2 weeks'], [21, '3 weeks'], [30, 'A month'], [90, '3 months']];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

const IconRepeat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
);
const IconTick = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
);
const IconFold = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);

const textOf = (i: PageItem) => ('task' in i ? i.task.title : 'tracker' in i ? i.tracker.name : i.line.text);

/** "due today", "in 3 days", "2 days overdue", "done today". */
function repeatStatus(t: TrackerItem, today: string): { text: string; tone: '' | 'today' | 'late' } {
  const s = trackerStatus(t, today);
  if (s.kind !== 'every') return { text: '', tone: '' };
  if (s.doneToday) return { text: 'done today', tone: '' };
  if (s.daysLeft < 0) return { text: `${plural(-s.daysLeft, 'day')} overdue`, tone: 'late' };
  if (s.daysLeft === 0) return { text: 'due today', tone: 'today' };
  return { text: s.daysLeft === 1 ? 'due tomorrow' : `in ${s.daysLeft} days`, tone: '' };
}

/* ---------- A page ---------- */

export function PageView({ id }: { id: ID }) {
  const data = useData();
  const today = todayISO(useNow(60_000));
  const page = data.lists.find((l) => l.id === id);
  const [opts, setOpts] = useState(false);
  if (!page) return null;
  const items = pageItems(data, id);
  const count = items.filter((i) => i.kind !== 'heading').length;
  return (
    <>
      <Band>
        <button type="button" className="backlink" onClick={() => moreView.set({ kind: 'hub' })}>‹ More</button>
        <div className="band-row">
          <h1 className="folder-title"><ThingIcon name={page.icon} size={24} />{page.name}</h1>
          <button type="button" className="round-btn" aria-label={`${page.name} options`} onClick={() => setOpts(true)}>⋯</button>
        </div>
        <p className="band-sub">{pageSummary(data, id, today)}</p>
      </Band>
      <div className="content">
        <div className="card page-sheet">
          <Lines items={items} pageId={id} today={today} />
          <NewLine pageId={id} />
        </div>
      </div>
      <FolderOptionsSheet
        open={opts} onClose={() => setOpts(false)} name={page.name} icon={page.icon} contents={count ? plural(count, 'line') : ''}
        onRename={(name) => actions.updateList(id, { name })} onIcon={(icon) => actions.updateList(id, { icon })}
        onDelete={() => { const before = actions.deleteList(id); moreView.set({ kind: 'hub' }); showToast(`Deleted ${page.name}`, before); }}
        cantDelete={data.lists.length < 2 ? 'This is your only page, so it stays.' : undefined}
      />
    </>
  );
}

/** The empty line at the end of a page: type a line (its kind shows as you type), or paste several. */
function NewLine({ pageId }: { pageId: ID }) {
  const [draft, setDraft] = useState('');
  const kind = lineKind(draft);
  const add = (texts: string[]) => { actions.addLines(pageId, texts); setDraft(''); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); add([draft]); } };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n')) return;
    e.preventDefault();
    // Bullets, numbers and checkboxes from other apps are dropped; "- " stays, as it makes a note.
    add(text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[*•]|\d+[.)]|\[[ xX]?\])\s+/, '')).filter((l) => l.trim()));
  };
  return (
    <div className="pl newline">
      <span className="mark" aria-hidden="true">{draft && (kind === 'repeat' ? <IconRepeat /> : kind === 'since' ? <span className="num">0</span> : kind === 'todo' ? <span className="circle" /> : null)}</span>
      <span className="pl-new">
        <input id={`new-line-${pageId}`} className="pl-edit" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onPaste={onPaste}
          aria-label="New line" placeholder="New line…" autoComplete="off" enterKeyHint="done" />
        {draft && <span className="pl-guess">{KIND_NAMES[kind].toLowerCase()}</span>}
      </span>
    </div>
  );
}

/* ---------- Lines, and everything you can do to them ---------- */

/**
 * A run of lines. With `pageId` they can be dragged to reorder and headings fold; without it (More's
 * "Due today") they can still be completed, looked into and edited, and `pageOf` names each one's page.
 */
export function Lines({ items, pageId, today, pageOf }: { items: PageItem[]; pageId?: ID; today: string; pageOf?: (i: PageItem) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<ID | null>(null);
  const [history, setHistory] = useState<ID | null>(null);
  const [options, setOptions] = useState<ID | null>(null);
  const [undo, setUndo] = useState<{ id: ID; before: AppData } | null>(null);
  const [spun, setSpun] = useState<ID | null>(null);
  const [lifted, setLifted] = useState<ID | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  // Lines under a folded heading are hidden, up to the next heading.
  const shown: PageItem[] = [];
  let folded = false;
  for (const i of items) {
    if (i.kind === 'heading') { folded = Boolean(pageId && i.line.collapsed); shown.push(i); continue; }
    if (!folded) shown.push(i);
  }
  const hiddenUnder = (hid: ID) => {
    const at = items.findIndex((i) => i.id === hid);
    let n = 0;
    for (let j = at + 1; j < items.length && items[j].kind !== 'heading'; j++) n++;
    return n;
  };

  /* Hold ↻ or a count to complete it; a quick tap shows its history instead. */
  const hold = useRef<{ id: ID; t0: number; raf: number; line: HTMLElement } | null>(null);
  const complete = (tid: ID) => {
    const t = getData().trackers.find((x) => x.id === tid);
    if (!t) return;
    if (t.hits.includes(today)) { showToast(t.kind === 'since' ? 'Already reset today' : 'Already done today'); return; }
    const before = actions.hitTracker(tid, today);
    try { navigator.vibrate?.(15); } catch { /* not supported */ }
    setSpun(tid);
    setTimeout(() => setSpun((s) => (s === tid ? null : s)), 700);
    setUndo({ id: tid, before });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 4000);
  };
  const startHold = (e: RPointerEvent<HTMLElement>, tid: ID) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const line = e.currentTarget.closest<HTMLElement>('.pl')!;
    const h = { id: tid, t0: performance.now(), raf: 0, line };
    hold.current = h;
    const step = (t: number) => {
      if (hold.current !== h) return;
      const p = Math.min(1, (t - h.t0) / HOLD_MS);
      line.style.setProperty('--p', String(p));
      if (p >= 1) { hold.current = null; line.style.setProperty('--p', '0'); complete(tid); return; }
      h.raf = requestAnimationFrame(step);
    };
    h.raf = requestAnimationFrame(step);
  };
  const endHold = () => {
    const h = hold.current;
    if (!h) return;
    hold.current = null;
    cancelAnimationFrame(h.raf);
    h.line.style.setProperty('--p', '0');
    if (performance.now() - h.t0 < 250) setHistory((x) => (x === h.id ? null : h.id));
  };

  /* Swipe right for options; swipe a ticked to-do left to remove it; hold the words to drag. */
  const g = useRef<{ id: ID; el: HTMLElement; x: number; y: number; t0: number; swipe: boolean; dx: number; done: boolean; lift: boolean; timer?: ReturnType<typeof setTimeout>; pointer: number; onText: boolean } | null>(null);
  const reset = (el: HTMLElement) => { el.classList.remove('swiping', 'to-options', 'to-remove', 'ready'); el.style.transform = ''; el.style.opacity = ''; };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, [data-hold], [data-tick], [data-fold], .pl-undo')) return;
    const el = t.closest<HTMLElement>('.pl[data-line]');
    if (!el) return;
    const s = { id: el.dataset.line!, el, x: e.clientX, y: e.clientY, t0: performance.now(), swipe: false, dx: 0, done: el.classList.contains('done'), lift: false, pointer: e.pointerId, onText: Boolean(t.closest('[data-text]')) } as NonNullable<typeof g.current>;
    if (pageId) {
      s.timer = setTimeout(() => {
        s.lift = true;
        setLifted(s.id);
        try { navigator.vibrate?.(10); } catch { /* not supported */ }
        box.current?.setPointerCapture(s.pointer);
      }, LIFT_MS);
    }
    g.current = s;
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (s.lift) {
      // Drop the line before whichever line the finger is over.
      const lines = [...(box.current?.querySelectorAll<HTMLElement>('.pl[data-line]') ?? [])].filter((n) => n.dataset.line !== s.id);
      const before = lines.find((n) => { const r = n.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      const beforeId = before?.dataset.line ?? null;
      const nextNow = items[items.findIndex((i) => i.id === s.id) + 1]?.id ?? null;
      if (pageId && beforeId !== nextNow) actions.moveLine(pageId, s.id, beforeId);
      return;
    }
    if (!s.swipe) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
        s.swipe = true;
        clearTimeout(s.timer);
        box.current?.setPointerCapture(s.pointer);
        s.el.classList.add('swiping');
      } else if (Math.hypot(dx, dy) > 8) { clearTimeout(s.timer); g.current = null; return; }
      else return;
    }
    s.dx = dx;
    const move = dx > 0 ? Math.min(dx, SWIPE_OPTIONS + (dx - SWIPE_OPTIONS) * 0.3) : s.done ? dx : dx * 0.15;
    s.el.style.transform = `translateX(${move}px)`;
    s.el.classList.toggle('to-options', dx > 0);
    s.el.classList.toggle('to-remove', dx < 0 && s.done);
    s.el.classList.toggle('ready', dx >= SWIPE_OPTIONS || (s.done && dx <= -SWIPE_REMOVE));
    if (s.done && dx < 0) s.el.style.opacity = String(1 - Math.min(0.6, -dx / 250));
  };
  const onUp = () => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (s.lift) { setLifted(null); return; }
    if (s.swipe) {
      reset(s.el);
      if (s.dx >= SWIPE_OPTIONS) setOptions(s.id);
      else if (s.done && s.dx <= -SWIPE_REMOVE) {
        const i = items.find((x) => x.id === s.id);
        const before = actions.deleteLine(s.id);
        showToast(`Removed ${i ? textOf(i) : 'it'}`, before);
      }
      return;
    }
    if (s.onText && performance.now() - s.t0 < LIFT_MS) setEditing(s.id);
  };
  const onCancel = () => {
    const s = g.current;
    g.current = null;
    if (s) { clearTimeout(s.timer); reset(s.el); if (s.lift) setLifted(null); }
    endHold();
  };

  return (
    <div ref={box} className="pl-lines" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
      onContextMenu={(e) => e.preventDefault()}>
      {shown.map((i) => (
        <LineRow
          key={i.id} item={i} today={today} page={pageOf?.(i)} editing={editing === i.id} lifted={lifted === i.id} spun={spun === i.id}
          showHistory={history === i.id} undo={undo?.id === i.id} hidden={i.kind === 'heading' && i.line.collapsed && pageId ? hiddenUnder(i.id) : 0}
          onHoldStart={startHold} onHoldEnd={endHold} onComplete={complete}
          onUndo={() => { if (undo) { actions.restore(undo.before); setUndo(null); } }}
          onDoneEditing={() => setEditing(null)}
          canFold={Boolean(pageId)}
        />
      ))}
      {options && <LineOptions id={options} today={today} onClose={() => setOptions(null)} />}
    </div>
  );
}

function LineRow({ item: i, today, page, editing, lifted, spun, showHistory, undo, hidden, onHoldStart, onHoldEnd, onComplete, onUndo, onDoneEditing, canFold }: {
  item: PageItem; today: string; page?: string; editing: boolean; lifted: boolean; spun: boolean; showHistory: boolean; undo: boolean; hidden: number;
  onHoldStart: (e: RPointerEvent<HTMLElement>, id: ID) => void; onHoldEnd: () => void; onComplete: (id: ID) => void; onUndo: () => void; onDoneEditing: () => void; canFold: boolean;
}) {
  const cls = ['pl', i.kind === 'heading' && 'pl-h', i.kind === 'note' && 'pl-note', i.kind === 'todo' && i.task.done && 'done', lifted && 'lifted'].filter(Boolean).join(' ');
  const text = textOf(i);
  const words = editing
    ? <EditWords id={i.id} text={text} heading={i.kind === 'heading'} onDone={onDoneEditing} />
    : <span className="pl-t" data-text={i.id}>{text}{page && <span className="pl-aside"> · {page}</span>}{aside(i, today)}{undo && <button type="button" className="pl-undo" onClick={onUndo}>Undo</button>}</span>;

  let mark;
  if (i.kind === 'heading') {
    mark = canFold
      ? <button type="button" className={`pl-fold ${i.line.collapsed ? 'shut' : ''}`} data-fold={i.id} aria-expanded={!i.line.collapsed} aria-label={`${i.line.collapsed ? 'Open' : 'Fold'} ${text}`} onClick={() => actions.toggleHeading(i.id)}><IconFold /></button>
      : <span />;
  } else if (i.kind === 'note') mark = <span className="pl-bullet" aria-hidden="true" />;
  else if (i.kind === 'todo') {
    mark = (
      <button type="button" className="mark" data-tick={i.id} aria-label={`${i.task.done ? 'Untick' : 'Tick'} ${text}`} onClick={() => actions.toggleTask(i.id)}>
        <span className="circle">{i.task.done && <IconTick />}</span>
      </button>
    );
  } else if ('tracker' in i) {
    const t = i.tracker;
    const s = trackerStatus(t, today);
    const over = pastAim(t, today);
    mark = (
      <button
        type="button" className={`mark ${spun ? (i.kind === 'repeat' ? 'spin' : 'bump') : ''}`} data-hold={i.id}
        aria-label={i.kind === 'repeat' ? `${text}: hold to mark done, tap for history` : `${text}, ${s.kind === 'since' ? s.days : 0} days: hold to reset, tap for history`}
        onPointerDown={(e) => onHoldStart(e, i.id)} onPointerUp={onHoldEnd} onPointerCancel={onHoldEnd}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onComplete(i.id); } }}
      >
        {i.kind === 'repeat' ? <IconRepeat /> : <span className={`num ${over ? 'over' : ''}`}>{s.kind === 'since' ? s.days : 0}</span>}
      </button>
    );
  }
  return (
    <>
      <div className={cls} data-line={i.id}>
        <span className="pl-fill" aria-hidden="true" />
        {mark}
        {words}
        {hidden > 0 && <span className="pl-hidden">{hidden}</span>}
      </div>
      {showHistory && (i.kind === 'repeat' || i.kind === 'since') && <History t={i.tracker} today={today} />}
    </>
  );
}

/** The quiet words after a line: when a repeat is due, how long a count has run and its aim. */
function aside(i: PageItem, today: string) {
  if (i.kind === 'repeat') {
    const st = repeatStatus(i.tracker, today);
    return <span className={`pl-aside ${st.tone}`}> · {st.text} · {repeatText(i.tracker)}</span>;
  }
  if (i.kind === 'since') {
    const s = trackerStatus(i.tracker, today);
    const days = s.kind === 'since' ? s.days : 0;
    const over = pastAim(i.tracker, today);
    return <span className={`pl-aside ${over ? 'late' : ''}`}> · {days === 1 ? 'day' : 'days'} since{i.tracker.aim ? ` · aim ${AIMS.find(([d]) => d === i.tracker.aim)?.[1].toLowerCase() ?? `${i.tracker.aim} days`}` : ''}</span>;
  }
  if (i.kind === 'todo' && i.task.due && !i.task.done) {
    const tone = i.task.due < today ? 'late' : i.task.due === today ? 'today' : '';
    return <span className={`pl-aside ${tone}`}> · {i.task.due === today ? 'today' : fmtDayShort(i.task.due)}</span>;
  }
  return null;
}

function EditWords({ id, text, heading, onDone }: { id: ID; text: string; heading: boolean; onDone: () => void }) {
  const [v, setV] = useState(text);
  const done = useRef(false);
  const save = () => { if (done.current) return; done.current = true; if (v.trim() && v.trim() !== text) actions.editLine(id, v); onDone(); };
  return (
    <input className={`pl-edit ${heading ? 'h' : ''}`} value={v} autoFocus aria-label="Edit line" enterKeyHint="done"
      onChange={(e) => setV(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { done.current = true; onDone(); } }} />
  );
}

/** The last 30 days as a row of squares, with how often and the longest gap. */
function History({ t, today }: { t: TrackerItem; today: string }) {
  const hits = new Set(t.hits);
  const days = Array.from({ length: 30 }, (_, k) => addDays(today, k - 29));
  const recent = t.hits.filter((h) => h > addDays(today, -30)).length;
  const s = trackerStatus(t, today);
  let gap = 0;
  const points = [t.since, ...t.hits];
  for (let k = 1; k < points.length; k++) gap = Math.max(gap, Math.round((Date.parse(points[k]) - Date.parse(points[k - 1])) / 86_400_000));
  if (s.kind === 'since') gap = Math.max(gap, s.days);
  return (
    <div className="pl-history">
      <div className="pl-dots" aria-label="Last 30 days">{days.map((d) => <i key={d} className={hits.has(d) ? 'hit' : ''} title={d} />)}</div>
      <span>Last 30 days · {plural(recent, 'time')}{gap ? ` · longest gap ${plural(gap, 'day')}` : ''}</span>
    </div>
  );
}

/* ---------- Options for one line ---------- */

function LineOptions({ id, today, onClose }: { id: ID; today: string; onClose: () => void }) {
  const data = useData();
  const t = data.trackers.find((x) => x.id === id);
  const task = data.tasks.find((x) => x.id === id);
  const line = data.lines.find((x) => x.id === id);
  const kind: LineKind | null = task ? 'todo' : t ? (t.kind === 'since' ? 'since' : 'repeat') : line ? line.kind : null;
  const name = task?.title ?? t?.name ?? line?.text ?? '';
  const [n, setN] = useState(t?.every?.n ?? 1);
  const [unit, setUnit] = useState<RepeatUnit>(t?.every?.unit ?? 'week');
  if (!kind) return null;
  const last = t?.hits.length ? t.hits[t.hits.length - 1] : '';
  return (
    <Sheet open onClose={onClose} label="Line options">
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <h2>{name}</h2>
          <p className="small muted">{KIND_NAMES[kind]}</p>
        </div>

        {kind === 'since' && t && (
          <div className="stack" style={{ gap: 6 }}>
            <p className="label">Aim: flag it after</p>
            <div className="chip-row">
              {AIMS.map(([d, l]) => <button key={d} type="button" className="chip-btn" aria-pressed={(t.aim ?? 0) === d} onClick={() => actions.updateTracker(id, { aim: d || undefined })}>{l}</button>)}
            </div>
          </div>
        )}

        {kind === 'repeat' && t && (
          <div className="stack" style={{ gap: 8 }}>
            <p className="label">Comes due</p>
            <div className="chip-row">
              <button type="button" className="chip-btn" aria-pressed={t.weekday === undefined} onClick={() => actions.updateTracker(id, { weekday: undefined, every: { n, unit } })}>A set time after it's done</button>
              <button type="button" className="chip-btn" aria-pressed={t.weekday !== undefined} onClick={() => actions.updateTracker(id, { weekday: t.weekday ?? 6, every: { n: 1, unit: 'week' }, onDay: undefined })}>On a set day each week</button>
            </div>
            {t.weekday === undefined ? (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="small">Every</span>
                <select className="field-input auto" aria-label="How many" value={n} onChange={(e) => { const v = Number(e.target.value); setN(v); actions.updateTracker(id, { every: { n: v, unit } }); }}>
                  {[1, 2, 3, 4, 5, 6].map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <select className="field-input auto" aria-label="Unit" value={unit} onChange={(e) => { const u = e.target.value as RepeatUnit; setUnit(u); actions.updateTracker(id, { every: { n, unit: u }, ...(u !== 'month' ? { onDay: undefined } : {}) }); }}>
                  <option value="day">{n === 1 ? 'day' : 'days'}</option><option value="week">{n === 1 ? 'week' : 'weeks'}</option><option value="month">{n === 1 ? 'month' : 'months'}</option>
                </select>
              </div>
            ) : (
              <select className="field-input auto" aria-label="Which day" value={t.weekday} onChange={(e) => actions.updateTracker(id, { weekday: Number(e.target.value) })}>
                {WEEKDAY_NAMES.map((d, k) => <option key={d} value={k}>{d}</option>)}
              </select>
            )}
          </div>
        )}

        {(kind === 'repeat' || kind === 'since') && t && (
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="row small" htmlFor={`last-${id}`} style={{ gap: 8 }}>
              Last time
              <input id={`last-${id}`} type="date" className="field-input auto" max={today} value={last}
                onChange={(e) => { if (e.target.value) { const before = actions.setTrackerLast(id, e.target.value); showToast('Last time changed', before); } }} />
            </label>
            <button type="button" className="act" onClick={() => actions.updateTracker(id, { pinned: !t.pinned })}>{t.pinned ? '★ Pinned to Home' : '☆ Pin to Home'}</button>
          </div>
        )}

        {kind === 'todo' && task && (
          <label className="row small" htmlFor={`due-${id}`} style={{ gap: 8 }}>
            Due
            <input id={`due-${id}`} type="date" className="field-input auto" value={task.due ?? ''} onChange={(e) => actions.updateTask(id, { due: e.target.value || null })} />
            {task.due && <button type="button" className="card-link" onClick={() => actions.updateTask(id, { due: null })}>Clear</button>}
          </label>
        )}

        <div className="stack" style={{ gap: 6 }}>
          <p className="label">Turn into</p>
          <div className="chip-row">
            {(Object.keys(KIND_NAMES) as LineKind[]).filter((k) => k !== kind).map((k) => (
              <button key={k} type="button" className="chip-btn" onClick={() => { actions.convertLine(id, k); onClose(); }}>{KIND_NAMES[k]}</button>
            ))}
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn danger" onClick={() => { const before = actions.deleteLine(id); onClose(); showToast(`Deleted ${name}`, before); }}>Delete</button>
          <button type="button" className="btn green grow" onClick={onClose}>Done</button>
        </div>
      </div>
    </Sheet>
  );
}
