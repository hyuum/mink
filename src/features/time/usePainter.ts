// Drag-to-paint, shared by the Day timeline and the Week spread.
// The caller maps a pointer position to a (day, 15-minute slot); this hook tracks the drag,
// scrolls the page when the finger nears the top or bottom, and commits the range on release.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { actions } from '../../data/store';
import { fmtDuration, msAt } from '../../lib/dates';
import { ERASE, brush as brushStore, showToast } from '../../app/ui-state';
import type { AppData } from '../../data/types';

export const SLOT = 15;

export interface Drag { day: string; a: number; b: number }

export function usePainter(slotAt: (x: number, y: number, day?: string) => { day: string; min: number } | null, names: (id: string) => string) {
  const brush = brushStore.use();
  const [drag, setDrag] = useState<Drag | null>(null);
  const ref = useRef<(Drag & { x: number; y: number }) | null>(null);
  const slotRef = useRef(slotAt);
  slotRef.current = slotAt;

  const track = () => {
    const d = ref.current;
    if (!d) return;
    const s = slotRef.current(d.x, d.y, d.day);
    if (s && s.min !== d.b) { d.b = s.min; setDrag({ day: d.day, a: d.a, b: d.b }); }
  };

  // Edge scrolling while dragging. The bottom edge sits above the nav and the paint dock.
  useEffect(() => {
    if (!drag) return;
    let raf = 0;
    const tick = () => {
      const d = ref.current;
      if (d) {
        const bottom = window.innerHeight - 170;
        const step = d.y > bottom ? Math.min(14, (d.y - bottom) / 4 + 4) : d.y < 90 ? -Math.min(14, (90 - d.y) / 4 + 4) : 0;
        if (step) { window.scrollBy(0, step); track(); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  const onPointerDown = (e: RPointerEvent<HTMLElement>) => {
    if (!brush || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const s = slotRef.current(e.clientX, e.clientY);
    if (!s) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    ref.current = { day: s.day, a: s.min, b: s.min, x: e.clientX, y: e.clientY };
    setDrag({ day: s.day, a: s.min, b: s.min });
  };
  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    const d = ref.current;
    if (!d) return;
    d.x = e.clientX;
    d.y = e.clientY;
    track();
  };
  const onPointerUp = () => {
    const d = ref.current;
    ref.current = null;
    setDrag(null);
    if (!d || !brush) return;
    const lo = Math.min(d.a, d.b);
    const hi = Math.max(d.a, d.b) + SLOT;
    const before: AppData = actions.paint(msAt(d.day, lo), msAt(d.day, Math.min(hi, 24 * 60)), brush === ERASE ? null : brush);
    showToast(brush === ERASE ? `Erased ${fmtDuration(hi - lo)}` : `Painted ${names(brush)} · ${fmtDuration(hi - lo)}`, before);
  };
  const onPointerCancel = () => { ref.current = null; setDrag(null); };

  return { brush, drag, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
