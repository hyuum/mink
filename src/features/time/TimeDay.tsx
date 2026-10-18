// The day timeline. Drag down the day to select some time, then pick what it was. Blocks are solid:
// drag one to move it, tap it for handles to resize. Planned blocks still ahead show dashed; hold one
// to fill it in. "Edit plan" switches the timeline to the plan on its own, with templates.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { actions, getData, useData } from '../../data/store';
import { bedOf, dayTotals, donePlanIds, entriesForDay, entryEnd, planForDay, runningEntry, templateFor, unloggedMin, wakeOf, weekDays } from '../../data/logic';
import { DRIFT_ID } from '../../data/seed';
import type { ID, TimeCategory } from '../../data/types';
import { addDays, dayNum, dayStartMs, fmtClock, fmtDuration, fmtHM, hourLabel, minutesOfDay, msAt, relativeDay, todayISO, weekdayShort, weekdayLong } from '../../lib/dates';
import { showToast, timeDay, useNow } from '../../app/ui-state';
import { Band, Bar, Card, Sheet } from '../../ui/kit';
import { IconEye, IconLabels, IconLeft, IconMoon, IconPencil, IconPhone, IconRight, IconStop, IconSun } from '../../ui/icons';
import { PhoneReview, usePhoneSuggestions } from './phone';
import { EntryEditor, type EditTarget } from './EntryEditor';
import { fmtMilestone } from './Milestones';
import { Dial } from './Dial';
import { TimeTabs } from './TimeTabs';
import { PlanControls } from './PlanControls';
import { drawPenLines } from './doodles';

const HOUR_PX = 52;
const TOP_PAD = 12;
const GUTTER = 58;
const SLOT = 15;
const HOLD_MS = 1100;

type Kind = 'entry' | 'plan';
interface Block {
  kind: Kind;
  id: ID;
  startMin: number;
  endMin: number;
  categoryId: ID;
  label: string;
  /** Can't be dragged: a running timer, or a block that crosses midnight. Tapping opens the editor. */
  fixed: boolean;
  live: boolean;
  /** A planned block shown while recording: dashed, and hold to fill it. */
  ghost: boolean;
}
type Gesture =
  | { type: 'range'; a: number; b: number; y0: number; cy: number; moved: boolean }
  | { type: 'press' | 'move' | 'resize-top' | 'resize-bot' | 'fixed'; block: Block; lo: number; hi: number; y0: number; cy: number; moved: boolean };
interface Pick { title: string; sub: string; clear: boolean; apply: (categoryId: ID | null) => void }

const TIP_KEY = 'matcha.dayTip';
const readTipSeen = () => { try { return localStorage.getItem(TIP_KEY) === '1'; } catch { return false; } };

/** Activities picked recently come first in the picker. */
let recent: ID[] = [];
const noteRecent = (id: ID) => { recent = [id, ...recent.filter((r) => r !== id)].slice(0, 3); };

export function TimeDay() {
  const data = useData();
  const running = runningEntry(data.entries);
  const now = useNow(running ? 1000 : 30_000);
  const today = todayISO(now);
  const day = timeDay.use() ?? today;
  const setDay = (d: string) => timeDay.set(d === today ? null : d);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [sleepDrag, setSleepDrag] = useState<{ kind: 'wake' | 'bed'; min: number } | null>(null);
  const [tipSeen, setTipSeen] = useState(readTipSeen);
  // The week strip stays tucked away: it shows while planning, after a swipe to another day, or when you tap the date.
  const [strip, setStrip] = useState(false);
  const stripTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const flashStrip = (ms = 2500) => {
    setStrip(true);
    clearTimeout(stripTimer.current);
    if (ms) stripTimer.current = setTimeout(() => setStrip(false), ms);
  };
  useEffect(() => () => clearTimeout(stripTimer.current), []);
  const [dial, setDial] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [peek, setPeek] = useState(false);
  const [planMenu, setPlanMenu] = useState(false);
  const [review, setReview] = useState<{ focus: string | null } | null>(null);
  const [sel, setSel] = useState<{ kind: Kind; id: ID } | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [moving, setMoving] = useState<{ id: ID; startMin: number; endMin: number } | null>(null);
  const [holding, setHolding] = useState<ID | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const col = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const hold = useRef<{ block: Block; t0: number; x: number; y: number; raf: number; water: HTMLElement | null } | null>(null);
  const cat = (id: ID): TimeCategory | undefined => data.timeCategories.find((c) => c.id === id);
  const s = data.settings;

  useEffect(() => { setSel(null); setPick(null); setRange(null); setPlanMenu(false); }, [day, planMode]);
  // Keep toasts clear of the selection bar while it's showing.
  useEffect(() => {
    if (!sel) return;
    document.documentElement.style.setProperty('--dock-space', '64px');
    return () => { document.documentElement.style.removeProperty('--dock-space'); };
  }, [sel !== null]);

  const stripOpen = planMode || strip;
  const phone = usePhoneSuggestions(day, today);
  const dayStart = dayStartMs(day);
  const nowMin = day === today ? minutesOfDay(now) : null;
  const entries = entriesForDay(data.entries, day, now);
  const plan = planForDay(data, day);
  const done = donePlanIds(data.entries);
  const doneCount = plan.filter((p) => done.has(p.id)).length;
  const ahead = (endMin: number) => day > today || (nowMin !== null && endMin > nowMin);
  const shownPlans = planMode ? plan : plan.filter((p) => !done.has(p.id) && (peek || ahead(p.endMin)));

  const toMin = (ms: number) => (ms - dayStart) / 60_000;
  const logged: Block[] = planMode ? [] : entries.map((e) => {
    const end = entryEnd(e, now);
    return {
      kind: 'entry', id: e.id, categoryId: e.categoryId, label: e.label,
      startMin: Math.max(0, toMin(e.start)), endMin: Math.min(24 * 60, Math.max(toMin(end), toMin(e.start) + 1)),
      fixed: e.end === null || e.start < dayStart || end > dayStart + 24 * 3_600_000, live: e.end === null, ghost: false,
    };
  });
  const loggedSorted = [...logged].sort((a, b) => a.startMin - b.startMin);
  // While recording, a planned block shows only from where logged time stops covering it.
  const visibleFrom = (start: number) => { let s = start; for (const b of loggedSorted) if (b.startMin <= s + 0.5 && b.endMin > s) s = b.endMin; return s; };
  const plans: Block[] = shownPlans
    .map((p): Block => ({ kind: 'plan', id: p.id, categoryId: p.categoryId, label: p.label, startMin: planMode ? p.startMin : Math.ceil(visibleFrom(p.startMin)), endMin: p.endMin, fixed: false, live: false, ghost: !planMode }))
    .filter((b) => b.endMin - b.startMin >= 5);
  const withMove = (b: Block) => (moving && moving.id === b.id ? { ...b, startMin: moving.startMin, endMin: moving.endMin } : b);
  const loggedV = logged.map(withMove);
  const plansV = plans.map(withMove);
  const all = [...plansV, ...loggedV];

  const wake = wakeOf(data.milestones, day);
  const bed = bedOf(data.milestones, day);
  const wakeMin = sleepDrag?.kind === 'wake' ? sleepDrag.min : wake?.min;
  const bedMin = sleepDrag?.kind === 'bed' ? sleepDrag.min : bed?.min;
  // The day runs from waking up to bedtime, with an hour of room either side to drag them further.
  let h0 = wakeMin !== undefined ? Math.floor(wakeMin / 60) - 1 : s.dayStartHour;
  let h1 = bedMin !== undefined ? Math.ceil(Math.min(bedMin, 24 * 60) / 60) + 1 : s.dayEndHour;
  for (const b of all) { h0 = Math.min(h0, Math.floor(b.startMin / 60)); h1 = Math.max(h1, Math.ceil(b.endMin / 60)); }
  if (nowMin !== null) { h0 = Math.min(h0, Math.floor(nowMin / 60)); h1 = Math.max(h1, Math.ceil(nowMin / 60)); }
  h0 = Math.max(0, h0); h1 = Math.min(24, Math.max(h1, h0 + 1));
  const top = (min: number) => TOP_PAD + ((min - h0 * 60) / 60) * HOUR_PX;
  const clampTop = (min: number) => top(Math.max(h0 * 60, Math.min(h1 * 60, min)));
  const hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  const isArrow = (b: Block) => Boolean(cat(b.categoryId)?.arrow);

  const totals = dayTotals(data.entries, day, now);
  const unlogged = unloggedMin(data.entries, day, s.dayStartHour, s.dayEndHour, day === today ? now : Infinity);

  // Open on "now" (or the first block) the first time the day is shown.
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const target = nowMin ?? all[0]?.startMin ?? h0 * 60;
    const y = el.getBoundingClientRect().top + window.scrollY + top(target) - window.innerHeight * 0.4;
    window.scrollTo({ top: Math.max(0, y) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  /* ---------- Gestures ---------- */
  const minAt = (clientY: number) => {
    const r = grid.current!.getBoundingClientRect();
    return h0 * 60 + ((clientY - r.top - TOP_PAD) / HOUR_PX) * 60;
  };
  const slotAt = (clientY: number) => Math.max(h0 * 60, Math.min(h1 * 60 - SLOT, Math.floor(minAt(clientY) / SLOT) * SLOT));
  const boundsOf = (b: Block) => {
    const others = (b.kind === 'plan' ? plans : logged).filter((o) => o.id !== b.id);
    let lo = h0 * 60, hi = h1 * 60;
    for (const o of others) { if (o.endMin <= b.startMin) lo = Math.max(lo, o.endMin); if (o.startMin >= b.endMin) hi = Math.min(hi, o.startMin); }
    return { lo, hi };
  };

  const openPick = (from: number, to: number) => {
    const kind: Kind = planMode ? 'plan' : 'entry';
    const overlaps = (kind === 'plan' ? plans : logged).some((b) => b.startMin < to && b.endMin > from);
    setRange({ from, to });
    setPick({
      title: `${kind === 'plan' ? 'Plan' : 'Log'} ${fmtHM(from)} – ${fmtHM(to)}`,
      sub: `${fmtDuration(to - from)} · what ${kind === 'plan' ? 'will it be' : 'was it'}?`,
      clear: overlaps,
      apply: (categoryId) => {
        if (kind === 'plan') {
          const { before, id } = actions.planPaint(day, from, to, categoryId);
          setSel(id ? { kind: 'plan', id } : null);
          showToast(categoryId ? `Planned ${cat(categoryId)?.name} · ${fmtDuration(to - from)}` : `Cleared ${fmtDuration(to - from)} of the plan`, before);
        } else {
          const a = msAt(day, from), b = msAt(day, to);
          const before = actions.paint(a, b, categoryId, Date.now());
          const made = categoryId ? getData().entries.find((e) => e.categoryId === categoryId && e.start <= a && e.end !== null && e.end >= b) : undefined;
          setSel(made ? { kind: 'entry', id: made.id } : null);
          showToast(categoryId ? `Logged ${cat(categoryId)?.name} · ${fmtDuration(to - from)}` : `Cleared ${fmtDuration(to - from)}`, before);
        }
        if (categoryId) noteRecent(categoryId);
      },
    });
  };

  const onMove = (clientY: number) => {
    const g = gesture.current;
    if (!g) return;
    g.cy = clientY;
    const dy = clientY - g.y0;
    if (Math.abs(dy) > 6) g.moved = true;
    if (g.type === 'range') {
      if (!g.moved) return;
      g.b = slotAt(clientY);
      setRange({ from: Math.min(g.a, g.b), to: Math.max(g.a, g.b) + SLOT });
      return;
    }
    if (!g.moved || g.type === 'fixed') return;
    if (g.type === 'press') { g.type = 'move'; setSel({ kind: g.block.kind, id: g.block.id }); }
    const dm = Math.round(((dy / HOUR_PX) * 60) / SLOT) * SLOT;
    const { startMin: s0, endMin: e0 } = g.block;
    let a = s0, b = e0;
    if (g.type === 'move') { a = Math.max(g.lo, Math.min(g.hi - (e0 - s0), s0 + dm)); b = a + (e0 - s0); }
    else if (g.type === 'resize-top') a = Math.max(g.lo, Math.min(e0 - SLOT, s0 + dm));
    else b = Math.min(g.hi, Math.max(s0 + SLOT, e0 + dm));
    setMoving({ id: g.block.id, startMin: a, endMin: b });
  };

  // Scroll the page while a finger drags near the top or bottom edge.
  const autoScroll = () => {
    const tick = () => {
      const g = gesture.current;
      if (!g) return;
      const bottom = window.innerHeight - 150;
      const step = g.cy > bottom ? Math.min(14, (g.cy - bottom) / 4 + 3) : g.cy < 90 ? -Math.min(14, (90 - g.cy) / 4 + 3) : 0;
      if (step) { window.scrollBy(0, step); onMove(g.cy); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const startHold = (e: RPointerEvent<HTMLElement>, block: Block, el: HTMLElement) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (sel) setSel(null);
    const water = el.querySelector<HTMLElement>('.water');
    if (water) water.style.transition = 'none';
    setHolding(block.id);
    const h = { block, t0: performance.now(), x: e.clientX, y: e.clientY, raf: 0, water };
    hold.current = h;
    const step = (t: number) => {
      if (hold.current !== h) return;
      const k = Math.min(1, (t - h.t0) / HOLD_MS);
      const v = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (h.water) h.water.style.height = `${v * 100}%`;
      if (k >= 1) finishHold(); else h.raf = requestAnimationFrame(step);
    };
    h.raf = requestAnimationFrame(step);
  };
  const cancelHold = (quick: boolean) => {
    const h = hold.current;
    if (!h) return;
    hold.current = null;
    cancelAnimationFrame(h.raf);
    if (h.water) { h.water.style.transition = 'height .35s ease-in'; h.water.style.height = '0%'; }
    setHolding(null);
    if (quick) showToast('Hold the block until it fills');
  };
  const finishHold = () => {
    const h = hold.current;
    if (!h) return;
    hold.current = null;
    const b = h.block;
    const { before } = actions.completePlan(b.id, Date.now(), b.startMin);
    setHolding(null);
    try { navigator.vibrate?.(18); } catch { /* not supported */ }
    showToast(`${b.label || cat(b.categoryId)?.name} done · ${fmtDuration(b.endMin - b.startMin)} logged`, before);
    const colour = cat(b.categoryId)?.color ?? '#8DBA78';
    const x0 = 0;
    requestAnimationFrame(() => {
      const layer = fx.current, c = col.current;
      if (layer && c) drawPenLines(layer, { x: x0, y: top(b.startMin), w: c.clientWidth - x0, h: top(b.endMin) - top(b.startMin) }, colour);
    });
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button > 0 || gesture.current || hold.current) return;
    const t = e.target as HTMLElement;
    const ph = t.closest<HTMLElement>('[data-phone]');
    if (ph) { setReview({ focus: ph.dataset.phone! }); return; }
    const gap = t.closest<HTMLElement>('[data-gap]');
    if (gap) {
      const [a, b] = gap.dataset.gap!.split('-').map(Number);
      openPick(a, b);
      return;
    }
    const el = t.closest<HTMLElement>('[data-block]');
    const block = el ? all.find((b) => b.id === el.dataset.block) : undefined;
    if (el && block?.ghost) { startHold(e, block, el); return; }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (block) {
      const handle = t.closest<HTMLElement>('[data-handle]')?.dataset.handle;
      const type = block.fixed ? 'fixed' : handle === 'top' ? 'resize-top' : handle === 'bot' ? 'resize-bot' : 'press';
      gesture.current = { type, block, ...boundsOf(block), y0: e.clientY, cy: e.clientY, moved: false };
    } else {
      const a = slotAt(e.clientY);
      gesture.current = { type: 'range', a, b: a, y0: e.clientY, cy: e.clientY, moved: false };
    }
    autoScroll();
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const h = hold.current;
    if (h) { if (Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) cancelHold(false); return; }
    onMove(e.clientY);
  };
  const onPointerUp = () => {
    const h = hold.current;
    if (h) { cancelHold(performance.now() - h.t0 < 250); return; }
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.type === 'range') {
      if (!g.moved) { setRange(null); if (sel) setSel(null); else showToast('Drag down the day to add some time'); return; }
      openPick(Math.min(g.a, g.b), Math.max(g.a, g.b) + SLOT);
      return;
    }
    if (g.type === 'fixed') { if (!g.moved) setEdit({ kind: 'entry', id: g.block.id }); return; }
    if (g.type === 'press') { setSel(sel?.id === g.block.id ? null : { kind: g.block.kind, id: g.block.id }); return; }
    const m = moving;
    setMoving(null);
    if (!m || (m.startMin === g.block.startMin && m.endMin === g.block.endMin)) return;
    const before = getData();
    if (g.block.kind === 'entry') {
      actions.updateEntry(g.block.id, { start: msAt(day, m.startMin), end: msAt(day, m.endMin) });
    } else {
      const id = actions.updatePlanned(g.block.id, { startMin: m.startMin, endMin: m.endMin });
      setSel({ kind: 'plan', id });
    }
    showToast(`${g.type === 'move' ? 'Moved' : 'Resized'} to ${fmtHM(m.startMin)} – ${fmtHM(m.endMin)}`, before);
  };
  const onPointerCancel = () => {
    cancelHold(false);
    gesture.current = null;
    setMoving(null);
    if (!pick) setRange(null);
  };

  /* ---------- Wake-up and bedtime tags ---------- */
  const sleepGesture = useRef<{ kind: 'wake' | 'bed'; y0: number; at: number; moved: boolean } | null>(null);
  const saveSleep = (kind: 'wake' | 'bed', min: number) => {
    const before = getData();
    actions.addMilestone({ kind, label: '', day, min });
    showToast(`${kind === 'wake' ? 'Woke up' : 'Bed'} ${fmtMilestone(min)}`, before);
  };
  const startSleepDrag = (e: RPointerEvent<HTMLButtonElement>, kind: 'wake' | 'bed', at: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    sleepGesture.current = { kind, y0: e.clientY, at, moved: false };
  };
  const moveSleepDrag = (e: RPointerEvent<HTMLButtonElement>) => {
    const g = sleepGesture.current;
    if (!g) return;
    const dy = e.clientY - g.y0;
    if (Math.abs(dy) > 4) g.moved = true;
    if (!g.moved) return;
    const min = Math.max(0, Math.min(24 * 60, Math.round((Math.min(g.at, 24 * 60) + (dy / HOUR_PX) * 60) / 5) * 5));
    setSleepDrag({ kind: g.kind, min });
  };
  const endSleepDrag = (kind: 'wake' | 'bed', current: number | undefined, at: number) => {
    const g = sleepGesture.current;
    sleepGesture.current = null;
    const dragged = sleepDrag?.kind === kind ? sleepDrag.min : null;
    setSleepDrag(null);
    if (g?.moved && dragged !== null) saveSleep(kind, dragged);
    else if (current === undefined) saveSleep(kind, at);
    else showToast(`Drag the tag to change your ${kind === 'wake' ? 'wake-up time' : 'bedtime'}`);
  };

  /* ---------- Rendering ---------- */
  const joins = (b: Block, list: Block[]) => {
    if (isArrow(b)) return { jt: false, jb: false };
    const solid = list.filter((o) => o.id !== b.id && !isArrow(o));
    return { jt: solid.some((o) => Math.abs(o.endMin - b.startMin) < 0.5), jb: solid.some((o) => Math.abs(o.startMin - b.endMin) < 0.5) };
  };

  const renderBlock = (b: Block, list: Block[]) => {
    const c = cat(b.categoryId);
    const { jt, jb } = joins(b, list);
    const y = top(b.startMin) + (jt ? 0 : 1);
    const height = Math.max(8, top(b.endMin) - top(b.startMin) - (jt ? 0 : 1) - (jb ? 0 : 1));
    const r = height < 24 ? 6 : 10;
    const arrow = isArrow(b);
    const selected = sel?.id === b.id;
    const title = b.label || c?.name || 'Untitled';
    // An arrow reaches down to the next block when it starts soon after, so it points at where you went.
    const next = arrow ? all.filter((o) => !isArrow(o) && o.startMin >= b.endMin - 0.5 && o.startMin - b.endMin <= 30).reduce((m, o) => Math.min(m, o.startMin), Infinity) : Infinity;
    const reach = Number.isFinite(next) ? Math.max(height, top(next) - y) : height;
    const cls = ['tblock', b.kind, b.ghost && 'ghost', arrow && 'arrow', jt && 'jt', jb && 'jb', selected && 'sel',
      b.live && 'live', b.categoryId === DRIFT_ID && 'drift', height < 24 && 'tiny', moving?.id === b.id && 'lifted', holding === b.id && 'holding'].filter(Boolean).join(' ');
    return (
      <div
        key={b.id} className={cls} data-block={b.id}
        style={{ top: y, height, ['--c' as string]: c?.color ?? '#ccc', borderRadius: arrow ? 6 : `${jt ? 0 : r}px ${jt ? 0 : r}px ${jb ? 0 : r}px ${jb ? 0 : r}px` }}
        role="button" tabIndex={0} aria-label={`${b.ghost ? 'Planned: ' : ''}${title}, ${fmtHM(b.startMin)} to ${fmtHM(b.endMin)}${b.ghost ? '. Hold to fill in.' : ''}`}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          if (b.ghost) { const { before } = actions.completePlan(b.id, Date.now(), b.startMin); showToast(`${title} done`, before); }
          else if (b.kind === 'entry') setEdit({ kind: 'entry', id: b.id });
          else setSel({ kind: 'plan', id: b.id });
        }}
      >
        {b.ghost && <span className="water" aria-hidden="true"><svg className="wave" viewBox="0 0 120 8" preserveAspectRatio="none"><path d="M0 4Q15 0 30 4T60 4T90 4T120 4V8H0Z" /></svg></span>}
        {arrow ? (
          <>
            {(() => {
              // A thick, round, see-through stroke down the middle of the day, like a highlighter pen.
              const tip = reach - (Number.isFinite(next) ? 2 : 5);
              const head = Math.min(7, Math.max(3, (reach - 8) / 2));
              return (
                <svg className="arr" viewBox={`0 0 28 ${reach}`} style={{ height: reach }} aria-hidden="true">
                  <g className="hl-pen">
                    {tip - head > 6 && <path className="hl shaft" d={`M14 5V${tip - 1}`} />}
                    <path className="hl" d={`M${14 - head} ${tip - head}L14 ${tip}L${14 + head} ${tip - head}`} />
                  </g>
                </svg>
              );
            })()}
          </>
        ) : (
          <span className="lbl"><strong>{title}</strong></span>
        )}
        {selected && !b.fixed && <><i className="hd top" data-handle="top" /><i className="hd bot" data-handle="bot" /></>}
      </div>
    );
  };

  // A + in each unlogged gap between two logged blocks, for time that has already passed.
  const gaps: { from: number; to: number }[] = [];
  if (!planMode && day <= today) {
    const sorted = [...loggedV].sort((a, b) => a.startMin - b.startMin);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = Math.ceil(sorted[i].endMin), b = Math.floor(sorted[i + 1].startMin);
      if (b - a < SLOT || (nowMin !== null && b > nowMin) || plansV.some((p) => p.startMin < b && p.endMin > a)) continue;
      gaps.push({ from: a, to: b });
    }
  }

  const selBlock = sel ? all.find((b) => b.id === sel.id) : undefined;
  const dayCats = data.timeCategories.filter((c) => totals.byCat[c.id]).sort((a, b) => totals.byCat[b.id] - totals.byCat[a.id]);
  const sub = planMode
    ? 'Editing the plan for this day'
    : `${day === today ? `Today · ${fmtHM(minutesOfDay(now))}` : relativeDay(day, today)}${plan.length ? ` · ${doneCount} of ${plan.length} done` : ''}`;

  return (
    <>
      <Band>
        <div className="band-row">
          <TimeTabs current="time" />
        </div>
        <div
          className="band-row day-head swipe-zone"
          onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={(e) => {
            const st = swipe.current;
            swipe.current = null;
            if (!st) return;
            const dx = e.clientX - st.x, dy = e.clientY - st.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(dy)) { setDay(addDays(day, dx < 0 ? 1 : -1)); flashStrip(); }
          }}
          onPointerCancel={() => { swipe.current = null; }}
        >
          <div style={{ minWidth: 0 }}>
            <h1>
              <button type="button" className="day-title" aria-expanded={stripOpen} aria-label={`${weekdayLong(day)} ${dayNum(day)}. Show the week`} onClick={() => (strip ? setStrip(false) : flashStrip(0))}>
                {weekdayLong(day)} {dayNum(day)}<span className="chev" aria-hidden="true"><IconRight size={16} /></span>
              </button>
            </h1>
            <p className="band-sub">{sub}</p>
          </div>
        </div>
        {stripOpen && <div className="row week-strip" style={{ gap: 2 }}>
          <button className="icon-btn" aria-label="Previous week" onClick={() => setDay(addDays(day, -7))}><IconLeft size={18} /></button>
          <div className="days grow">
            {weekDays(day).map((d) => {
              const t = templateFor(data.templates, d);
              return (
                <button key={d} className="day" aria-pressed={d === day} aria-label={`${weekdayLong(d)} ${dayNum(d)}${t ? `, ${t.name}` : ''}`} onClick={() => setDay(d)}>
                  <small>{weekdayShort(d)}</small>
                  <b>{dayNum(d)}</b>
                  {planMode && <em>{t ? t.name.split(' ')[0] : ''}</em>}
                  {d === today && d !== day && <span className="has" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <button className="icon-btn" aria-label="Next week" onClick={() => setDay(addDays(day, 7))}><IconRight size={18} /></button>
        </div>}
        {planMode && <PlanControls day={day} />}
      </Band>

      <div className="content">
        {running && !planMode && (
          <div className="card row">
            <span className="pulse" />
            <div className="grow">
              <p style={{ fontSize: 14 }}>{running.label || cat(running.categoryId)?.name}</p>
              <p className="small muted">Timer running</p>
            </div>
            <span className="num" style={{ fontSize: 18 }}>{fmtClock(now - running.start)}</span>
            <button className="btn" onClick={() => { actions.stopTimer(); showToast('Timer stopped'); }}><IconStop size={14} /> Stop</button>
          </div>
        )}

        {!tipSeen && (
          <div className="card day-tip">
            <p>Drag down the day to add time. Drag a block to move it, tap it to resize. Hold a dashed block to fill it in. Drag the <IconSun size={12} /> and <IconMoon size={12} /> tags to set when you woke up and went to bed. Scroll by dragging the times on the left, and swipe the date sideways to change day.</p>
            <button type="button" className="btn" onClick={() => { setTipSeen(true); try { localStorage.setItem(TIP_KEY, '1'); } catch { /* storage blocked */ } }}>Got it</button>
          </div>
        )}
        {!planMode && phone.length > 0 && (
          <button type="button" className="card phone-banner" onClick={() => setReview({ focus: null })}>
            <IconPhone size={18} />
            <span className="grow">{phone.length === 1 ? '1 stretch' : `${phone.length} stretches`} of phone use to review</span>
            <b>Review</b>
          </button>
        )}
        <div className="card" style={{ padding: '4px 0 6px' }}>
          <div className="row small muted" style={{ justifyContent: 'space-between', padding: '8px 16px 4px', flexWrap: 'wrap', gap: '2px 10px' }}>
            <span>
              {planMode
                ? `${plan.length} planned · ${fmtDuration(plan.reduce((t, p) => t + p.endMin - p.startMin, 0))}`
                : <>{fmtDuration(totals.total)} logged{unlogged > 0 && ` · ${fmtDuration(unlogged)} unlogged`}</>}
            </span>
            {day !== today && <button className="card-link" onClick={() => setDay(today)}>Back to today</button>}
          </div>
          <div className={`timeline ${planMode ? 'planning' : ''}`} ref={grid} style={{ height: TOP_PAD + (h1 - h0) * HOUR_PX + 8 }}>
            {hours.map((hr) => (
              <div key={hr} className={`hr ${hr % 2 ? 'odd' : ''}`} style={{ top: top(hr * 60) }}>
                {hr % 2 === 0 && <span className="hour-label">{hourLabel(hr)}</span>}
              </div>
            ))}
            {!planMode && wakeMin !== undefined && wakeMin > h0 * 60 && <div className="sleep-band" style={{ top: top(h0 * 60), height: clampTop(wakeMin) - top(h0 * 60) }} aria-hidden="true" />}
            {!planMode && bedMin !== undefined && bedMin < h1 * 60 && <div className="sleep-band" style={{ top: clampTop(bedMin), height: top(h1 * 60) - clampTop(bedMin) }} aria-hidden="true" />}
            <div
              className="tl-col" ref={col} style={{ left: GUTTER }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
              onContextMenu={(e) => e.preventDefault()}
            >
              {plansV.map((b) => renderBlock(b, plansV))}
              {loggedV.map((b) => renderBlock(b, loggedV))}
              {!planMode && phone.map((s) => {
                const a = (s.start - dayStart) / 60_000, z = (s.end - dayStart) / 60_000;
                const h = Math.max(10, top(z) - top(a) - 2);
                return (
                  <div key={s.key} className={`tblock phone ${h < 24 ? 'tiny' : ''}`} data-phone={s.key} style={{ top: top(a) + 1, height: h, ['--c' as string]: cat(s.categoryId)?.color ?? '#ccc' }}
                    role="button" tabIndex={0} aria-label={`Phone use, ${fmtHM(a)} to ${fmtHM(z)}: ${s.apps.map((x) => x.label).join(', ')}. Review.`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReview({ focus: s.key }); } }}>
                    <span className="lbl"><strong><IconPhone size={12} />{s.apps[0]?.label}{s.apps.length > 1 ? ` +${s.apps.length - 1}` : ''}</strong></span>
                  </div>
                );
              })}
              {gaps.map((g) => {
                const small = top(g.to) - top(g.from) < 30;
                return (
                  <button key={g.from} type="button" className={`gap-add ${small ? 'small' : ''}`} data-gap={`${g.from}-${g.to}`}
                    style={{ top: (top(g.from) + top(g.to)) / 2 - (small ? 10 : 14) }} aria-label={`Log ${fmtHM(g.from)} to ${fmtHM(g.to)}`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPick(g.from, g.to); } }}>+</button>
                );
              })}
              {range && (
                <div className="range-preview" style={{ top: top(range.from), height: top(range.to) - top(range.from) }} aria-hidden="true">
                  <span>{fmtHM(range.from)} – {fmtHM(range.to)}</span><span>{fmtDuration(range.to - range.from)}</span>
                </div>
              )}
              <div className="fx-layer" ref={fx} aria-hidden="true" />
            </div>
            {!planMode && (['wake', 'bed'] as const).map((kind) => {
              const min = kind === 'wake' ? wakeMin : bedMin;
              const at = min ?? (kind === 'wake' ? h0 * 60 : h1 * 60);
              return (
                <div key={kind} className={`sleep-marker ${kind} ${min === undefined ? 'unset' : ''} ${sleepDrag?.kind === kind ? 'dragging' : ''}`} style={{ top: clampTop(at) }}>
                  <button
                    type="button" className="sm-tab"
                    aria-label={min === undefined ? `Set ${kind === 'wake' ? 'wake-up' : 'bedtime'}` : `${kind === 'wake' ? 'Woke up' : 'Bed'} at ${fmtMilestone(min)}. Drag to change.`}
                    onPointerDown={(e) => startSleepDrag(e, kind, at)} onPointerMove={moveSleepDrag} onPointerUp={() => endSleepDrag(kind, min, at)} onPointerCancel={() => { sleepGesture.current = null; setSleepDrag(null); }}
                    onKeyDown={(e) => {
                      const step = e.key === 'ArrowUp' ? -5 : e.key === 'ArrowDown' ? 5 : 0;
                      if (step) { e.preventDefault(); saveSleep(kind, Math.max(0, Math.min(24 * 60, at + step))); }
                    }}
                  >
                    {kind === 'wake' ? <IconSun size={12} /> : <IconMoon size={12} />}
                    {min === undefined ? (kind === 'wake' ? 'Up?' : 'Bed?') : fmtMilestone(min).replace(/ (am|pm)$/, '')}
                  </button>
                </div>
              );
            })}
            {nowMin !== null && nowMin >= h0 * 60 && nowMin <= h1 * 60 && <div className="now-line" style={{ top: top(nowMin) }} aria-label={`Now, ${fmtHM(nowMin)}`} />}
          </div>
        </div>

        {selBlock && (
          <div className="selbar" role="toolbar" aria-label="Selected block">
            <div className="grow" style={{ minWidth: 0 }}>
              <b>{selBlock.label || cat(selBlock.categoryId)?.name}{selBlock.kind === 'plan' ? ' · planned' : ''}</b>
              <small>{fmtHM(selBlock.startMin)} – {fmtHM(selBlock.endMin)} · {fmtDuration(selBlock.endMin - selBlock.startMin)}</small>
            </div>
            {selBlock.kind === 'entry'
              ? <button type="button" className="btn" onClick={() => setEdit({ kind: 'entry', id: selBlock.id })}>Details</button>
              : <button type="button" className="btn" onClick={() => setPick({
                  title: 'Change activity', sub: `${fmtHM(selBlock.startMin)} – ${fmtHM(selBlock.endMin)}`, clear: false,
                  apply: (c) => { if (!c) return; const before = getData(); const id = actions.updatePlanned(selBlock.id, { categoryId: c }); setSel({ kind: 'plan', id }); noteRecent(c); showToast('Plan updated', before); },
                })}>Activity</button>}
            <button type="button" className="btn danger" onClick={() => {
              const before = selBlock.kind === 'entry' ? actions.deleteEntry(selBlock.id) : actions.deletePlanned(selBlock.id);
              setSel(null);
              showToast('Deleted', before);
            }}>Delete</button>
            <button type="button" className="btn green" onClick={() => setSel(null)}>Done</button>
          </div>
        )}

        {!planMode && totals.total > 0 && (
          <Card title={day === today ? 'Where today went' : 'Where the day went'} action={<button className="card-link quiet" onClick={() => setDial(!dial)} aria-pressed={dial}>{dial ? 'Bar' : 'Dial'}</button>}>
            {dial ? (
              <Dial day={day} entries={entries} cats={data.timeCategories} milestones={[wake, bed].filter((m): m is NonNullable<typeof m> => Boolean(m))} now={now} total={totals.total} isToday={day === today} />
            ) : (
              <Bar height={10} segments={[...dayCats.map((c) => ({ value: totals.byCat[c.id], color: c.color })), { value: unlogged, color: 'var(--track)' }]} max={totals.total + unlogged} />
            )}
            <div className="legend">
              {dayCats.map((c) => <span key={c.id}><span className="dot" style={{ background: c.color }} />{c.name} {fmtDuration(totals.byCat[c.id])}</span>)}
              {unlogged > 0 && <span><span className="dot" style={{ background: 'var(--track)', outline: '1px solid var(--line)' }} />Unlogged {fmtDuration(unlogged)}</span>}
            </div>
          </Card>
        )}
      </div>
      {/* The plan lives behind one button in the bottom corner: tap it for the full plan or to edit it. */}
      {!selBlock && (
        <div className="plan-corner">
          {planMode ? (
            <button type="button" className="plan-toggle on" onClick={() => setPlanMode(false)}>Done</button>
          ) : (
            <>
              {planMenu && <button type="button" className="plan-scrim" aria-label="Close" tabIndex={-1} onClick={() => setPlanMenu(false)} />}
              {planMenu && (
                <div className="plan-menu" role="menu" aria-label="Plan">
                  {plan.length > 0 && (
                    <button type="button" role="menuitemcheckbox" aria-checked={peek} onClick={() => { setPeek(!peek); setPlanMenu(false); }}>
                      <IconEye size={16} />{peek ? 'Hide full plan' : 'Show full plan'}
                    </button>
                  )}
                  <button type="button" role="menuitem" onClick={() => { setPlanMode(true); setPlanMenu(false); }}>
                    <IconPencil size={16} />Edit plan
                  </button>
                </div>
              )}
              <button type="button" className="plan-toggle" aria-haspopup="menu" aria-expanded={planMenu} onClick={() => setPlanMenu(!planMenu)}>
                <IconLabels size={16} />Plan{peek && <span className="plan-dot" aria-label="showing the full plan" />}
              </button>
            </>
          )}
        </div>
      )}
      <PhoneReview open={review !== null} suggestions={phone} focus={review?.focus} cats={data.timeCategories} onClose={() => setReview(null)} />
      <ActivityPicker pick={pick} cats={data.timeCategories} onClose={() => { setPick(null); setRange(null); }} />
      <EntryEditor target={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function ActivityPicker({ pick, cats, onClose }: { pick: Pick | null; cats: TimeCategory[]; onClose: () => void }) {
  const ordered = [...recent.map((id) => cats.find((c) => c.id === id)).filter((c): c is TimeCategory => Boolean(c)), ...cats.filter((c) => !recent.includes(c.id))];
  return (
    <Sheet open={pick !== null} onClose={onClose} label={pick?.title ?? 'Pick an activity'}>
      {pick && (
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <h2>{pick.title}</h2>
            <p className="small muted">{pick.sub}</p>
          </div>
          <div className="act-grid">
            {ordered.map((c) => (
              <button key={c.id} type="button" className={`act-chip ${recent.includes(c.id) ? 'recent' : ''}`} onClick={() => { pick.apply(c.id); onClose(); }}>
                <span className="swatch" style={{ background: c.color }} />{c.name}
              </button>
            ))}
            {pick.clear && <button type="button" className="act-chip clear" onClick={() => { pick.apply(null); onClose(); }}>Clear this time</button>}
          </div>
          <button type="button" className="btn ghost block" onClick={onClose}>Cancel</button>
        </div>
      )}
    </Sheet>
  );
}
