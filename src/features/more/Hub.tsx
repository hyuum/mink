// More: what's due today across pages, the list of pages, and the way into Settings.
import { useEffect, useState, type FormEvent } from 'react';
import { actions, useData } from '../../data/store';
import { dueTrackers, pageItems, pageSummary, type PageItem } from '../../data/logic';
import { todayISO } from '../../lib/dates';
import { moreView, showToast, useNow } from '../../app/ui-state';
import { Band, Sheet } from '../../ui/kit';
import { FOLDER_ICONS } from '../../data/icons';
import { IconChoice, ThingIcon } from '../../ui/things';
import { SETTINGS_PAGES, Settings } from './More';
import { Lines, PageView } from './Page';

export function More() {
  const view = moreView.use();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);
  if (view.kind === 'settings') return <Settings page={view.page} />;
  if (view.kind === 'folder') return <PageView id={view.id} />;
  return <Hub />;
}

function Hub() {
  const data = useData();
  const today = todayISO(useNow(60_000));
  const [making, setMaking] = useState(false);
  // Repeats due today or overdue, from every page.
  const due: PageItem[] = dueTrackers(data.trackers, today).map(({ item }) => ({ kind: 'repeat', id: item.id, order: 0, tracker: item }));
  const pageName = (i: PageItem) => (i.kind === 'repeat' || i.kind === 'since' ? data.lists.find((l) => l.id === i.tracker.folderId)?.name ?? '' : '');

  return (
    <>
      <Band>
        <div className="band-row">
          <h1>More</h1>
          <button type="button" className="round-btn" aria-label="New page" onClick={() => setMaking(true)}>+</button>
        </div>
      </Band>
      <div className="content">
        {due.length > 0 && (
          <>
            <p className="section-label">Due today</p>
            <div className="card page-sheet"><Lines items={due} today={today} pageOf={pageName} /></div>
          </>
        )}
        <p className="section-label">Pages</p>
        <div className="card rows">
          {data.lists.map((l) => (
            <button key={l.id} type="button" className="rowbtn" onClick={() => moreView.set({ kind: 'folder', id: l.id })}>
              <span className="ico"><ThingIcon name={l.icon} /></span>
              <span className="grow"><b>{l.name}</b><small>{pageSummary(data, l.id, today)}</small></span>
              <span className="count">{pageItems(data, l.id).filter((i) => i.kind !== 'heading' && !(i.kind === 'todo' && i.task.done)).length}</span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <p className="section-label">Settings</p>
        <div className="card rows">
          {SETTINGS_PAGES.map((p) => (
            <button key={p.page} type="button" className="rowbtn short" onClick={() => moreView.set({ kind: 'settings', page: p.page })}>
              <span className="grow"><b>{p.title}</b><small>{p.desc}</small></span><span className="chev" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
      <NewPageSheet open={making} onClose={() => setMaking(false)} />
    </>
  );
}

function NewPageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(FOLDER_ICONS[0]);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = actions.addList(name.trim(), icon);
    moreView.set({ kind: 'folder', id });
    showToast(`Made ${name.trim()}`);
    setName(''); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} label="New page">
      <form className="stack" style={{ gap: 12 }} onSubmit={save}>
        <h2>New page</h2>
        <input className="field-input" aria-label="Page name" placeholder="Name, e.g. Friends, Home life, Trip" value={name} onChange={(e) => setName(e.target.value)} />
        <IconChoice icons={FOLDER_ICONS} value={icon} onPick={setIcon} />
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn green grow">Make page</button>
        </div>
      </form>
    </Sheet>
  );
}

/**
 * Rename a page, change its icon, or delete it. Deleting asks once, naming what goes with it;
 * Undo is offered afterwards.
 */
export function FolderOptionsSheet({ open, onClose, name: initial, icon, contents, onRename, onIcon, onDelete, cantDelete }: {
  open: boolean; onClose: () => void; name: string; icon: string; contents: string;
  onRename: (name: string) => void; onIcon: (icon: string) => void; onDelete: () => void; cantDelete?: string;
}) {
  const [name, setName] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (open) { setName(initial); setConfirm(false); } }, [open, initial]);
  const save = () => { if (name.trim() && name.trim() !== initial) onRename(name.trim()); };
  return (
    <Sheet open={open} onClose={() => { save(); onClose(); }} label="Page options">
      <div className="stack" style={{ gap: 12 }}>
        <h2>Page</h2>
        <input className="field-input" aria-label="Page name" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
        <IconChoice icons={FOLDER_ICONS} value={icon} onPick={onIcon} />
        {confirm ? (
          <div className="confirm" role="alert">
            <p style={{ fontSize: 14 }}>Delete {initial}{contents ? ` and its ${contents}` : ''}? You can undo straight after.</p>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn danger" onClick={() => { onDelete(); onClose(); }}>Delete</button>
              <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn danger" disabled={Boolean(cantDelete)} onClick={() => setConfirm(true)}>Delete page</button>
            <button type="button" className="btn green grow" onClick={() => { save(); onClose(); }}>Done</button>
          </div>
        )}
        {cantDelete && <p className="small muted">{cantDelete}</p>}
      </div>
    </Sheet>
  );
}
