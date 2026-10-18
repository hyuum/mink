// Line icons, 24px grid. Decorative by default; give the button an aria-label instead.
import type { ReactNode } from 'react';

type P = { size?: number };
const S = ({ size = 22, children, fill = 'none' }: P & { children: ReactNode; fill?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconHome = (p: P) => <S {...p}><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" /></S>;
export const IconClock = (p: P) => <S {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></S>;
export const IconPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconWallet = (p: P) => <S {...p}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16 15h2" /></S>;
export const IconMore = (p: P) => <S {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></S>;
export const IconTasks = (p: P) => <S {...p}><rect x="4" y="5" width="5" height="5" rx="1.5" /><rect x="4" y="14" width="5" height="5" rx="1.5" /><path d="M13 7.5h7M13 16.5h7" /></S>;
export const IconPause = (p: P) => <S {...p}><path d="M9 6v12M15 6v12" /></S>;
export const IconStop = (p: P) => <S {...p}><rect x="7" y="7" width="10" height="10" rx="2" /></S>;
export const IconPlay = (p: P) => <S {...p} fill="currentColor"><path d="M8 5.5v13l10.5-6.5z" stroke="none" /></S>;
export const IconCheck = (p: P) => <S {...p}><path d="M5 12l4 4 10-10" /></S>;
export const IconLeft = (p: P) => <S {...p}><path d="M15 5l-7 7 7 7" /></S>;
export const IconRight = (p: P) => <S {...p}><path d="M9 5l7 7-7 7" /></S>;
export const IconClose = (p: P) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;

export function Sakura({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="#F8C9D5">
        {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="12" cy="6.5" rx="3" ry="4" transform={`rotate(${r} 12 12)`} />)}
      </g>
      <circle cx="12" cy="12" r="2.2" fill="#F2C86B" />
    </svg>
  );
}

/* Milestones and painting */
export const IconSun = (p: P) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></S>;
export const IconLeave = (p: P) => <S {...p}><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9" /></S>;
export const IconPin = (p: P) => <S {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.2" /></S>;
export const IconLunch = (p: P) => <S {...p}><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2.2 1.2-3 3.8-3 7h3" /></S>;
export const IconBus = (p: P) => <S {...p}><rect x="5" y="3.5" width="14" height="14" rx="3" /><path d="M5 10.5h14M8 17.5v3M16 17.5v3M8.5 14h.01M15.5 14h.01" /></S>;
export const IconTrash = (p: P) => <S {...p}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" /></S>;
export const IconArrowDown = (p: P) => <S {...p}><path d="M12 4v15M6 13l6 6 6-6" /></S>;
export const IconMoon = (p: P) => <S {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></S>;
export const IconFlag = (p: P) => <S {...p}><path d="M5 21V4M5 4h11l-2.5 4L16 12H5" /></S>;
export const IconStar = (p: P) => <S {...p}><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" /></S>;
export const IconEraser = (p: P) => <S {...p}><path d="M16 3l5 5-10 10H6l-3-3z" /><path d="M11 18h9" /></S>;
export const IconLabels = (p: P) => <S {...p}><circle cx="5" cy="7" r="2" /><circle cx="5" cy="17" r="2" /><path d="M10 7h10M10 17h10" /></S>;
export const IconDots = (p: P) => <S {...p}><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></S>;
