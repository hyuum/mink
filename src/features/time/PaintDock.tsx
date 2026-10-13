// The paint palette, docked above the bottom nav. Collapsed: a row of colour dots.
// Tap the labels button to open it into named chips (remembered on this device).
import { useEffect } from 'react';
import { useData } from '../../data/store';
import { DRIFT_ID } from '../../data/seed';
import { ERASE, brush as brushStore, dockLabels, setDockLabels } from '../../app/ui-state';
import { IconClose, IconDots, IconEraser, IconLabels } from '../../ui/icons';

export function PaintDock() {
  const data = useData();
  const brush = brushStore.use();
  const labels = dockLabels.use();
  const cats = data.timeCategories;
  const current = brush && brush !== ERASE ? cats.find((c) => c.id === brush) : undefined;
  const pick = (id: string) => brushStore.set(brush === id ? null : id);

  // Keep toasts clear of the dock while it's on screen.
  useEffect(() => {
    document.documentElement.style.setProperty('--dock-space', `${(labels ? 136 : 76) + (brush ? 40 : 0)}px`);
    return () => { document.documentElement.style.removeProperty('--dock-space'); };
  }, [labels, brush !== null]);

  return (
    <div className="dock-wrap">
      {brush && (
        <div className="dock-hint" role="status">
          <span>{brush === ERASE ? 'Erasing · drag over blocks' : `Painting ${current?.name ?? ''} · drag on the day`}</span>
          <button type="button" aria-label="Stop painting" onClick={() => brushStore.set(null)}><IconClose size={14} /></button>
        </div>
      )}
      <div className={`dock ${labels ? 'open' : ''}`} role="group" aria-label="Paint with">
        <div className="dock-colors">
          {cats.map((c) => (
            <button
              key={c.id} type="button" className={`dock-btn ${c.id === DRIFT_ID ? 'is-drift' : ''}`} aria-pressed={brush === c.id}
              aria-label={labels ? undefined : `Paint with ${c.name}`} title={c.name} onClick={() => pick(c.id)}
              style={labels && brush === c.id ? { background: `color-mix(in srgb, ${c.color} 40%, var(--card))`, borderColor: c.color } : undefined}
            >
              <span className="pot" style={{ background: c.color }} />
              {labels && <span className="dock-name">{c.name}</span>}
            </button>
          ))}
          {labels && (
            <>
              <button type="button" className="dock-btn erase-btn" aria-pressed={brush === ERASE} onClick={() => pick(ERASE)}>
                <IconEraser size={14} /><span className="dock-name">Eraser</span>
              </button>
              <button type="button" className="dock-btn names-btn" aria-label="Hide names" onClick={() => setDockLabels(false)}>
                <IconDots size={14} /><span className="dock-name">Dots only</span>
              </button>
            </>
          )}
        </div>
        {!labels && (
          <div className="dock-tools">
            <button type="button" className="dock-tool" aria-pressed={brush === ERASE} aria-label="Eraser" onClick={() => pick(ERASE)}><IconEraser size={18} /></button>
            <button type="button" className="dock-tool" aria-label="Show names" onClick={() => setDockLabels(true)}><IconLabels size={18} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
