// "What's new": after an update, the changes you haven't seen yet, once. Settings can open the full list.
import { useEffect, useState } from 'react';
import { useData, useReady } from '../../data/store';
import { CHANGELOG, LATEST_CHANGE } from '../../app/changelog';
import { whatsNew } from '../../app/ui-state';
import { Sheet } from '../../ui/kit';

const SEEN_KEY = 'matcha.seenChanges';
const readSeen = (): number | null => { try { const v = localStorage.getItem(SEEN_KEY); return v === null ? null : Number(v); } catch { return null; } };
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, String(LATEST_CHANGE)); } catch { /* storage blocked */ } };

/** Shows the unseen changes once after an update; also opens on request (everything) from Settings. */
export function WhatsNewHost() {
  const ready = useReady();
  const data = useData();
  const asked = whatsNew.use();
  const [auto, setAuto] = useState<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    const seen = readSeen();
    // A fresh install (still on the example week) has nothing to catch up on.
    if (seen === null && data.example) { markSeen(); return; }
    if ((seen ?? LATEST_CHANGE - 1) < LATEST_CHANGE) setAuto(seen ?? LATEST_CHANGE - 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const open = asked || auto !== null;
  const entries = asked ? CHANGELOG : CHANGELOG.filter((c) => c.id > (auto ?? LATEST_CHANGE));
  const close = () => { markSeen(); setAuto(null); whatsNew.set(false); };
  return (
    <Sheet open={open && entries.length > 0} onClose={close} label="What's new">
      <h2>What's new</h2>
      <div className="whatsnew">
        {entries.map((c) => (
          <section key={c.id}>
            <p className="section-label">{c.date}</p>
            <ul>{c.items.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        ))}
      </div>
      <button type="button" className="btn green block" onClick={close}>Got it</button>
    </Sheet>
  );
}
