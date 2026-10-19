// Line icons for folders, lists and trackers, drawn from the paths in data/icons.ts.
import { ICON_PATHS, iconName } from '../data/icons';

export function ThingIcon({ name, size = 20 }: { name: string | undefined; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_PATHS[iconName(name)] }} />
  );
}

/** A row of icons to choose from. */
export function IconChoice({ icons, value, onPick }: { icons: string[]; value: string; onPick: (name: string) => void }) {
  return (
    <div className="icon-pick" role="group" aria-label="Icon">
      {icons.map((n) => (
        <button key={n} type="button" aria-pressed={value === n} aria-label={n.replace(/-/g, ' ')} onClick={() => onPick(n)}><ThingIcon name={n} /></button>
      ))}
    </div>
  );
}
