// Wake-up and bedtime (and older milestone kinds): their icons, and the clock text for a milestone minute.
import type { ReactNode } from 'react';
import type { MilestoneKind } from '../../data/types';
import { fmtHM } from '../../lib/dates';
import { IconHome, IconLeave, IconLunch, IconMoon, IconPin, IconStar, IconSun } from '../../ui/icons';

export function MilestoneIcon({ kind, size = 14 }: { kind: MilestoneKind; size?: number }) {
  const map: Record<MilestoneKind, ReactNode> = {
    wake: <IconSun size={size} />, leave: <IconLeave size={size} />, arrive: <IconPin size={size} />, lunch: <IconLunch size={size} />,
    home: <IconHome size={size} />, bed: <IconMoon size={size} />, custom: <IconStar size={size} />,
  };
  return <>{map[kind]}</>;
}

/** Clock text for a milestone minute, which can run past midnight. */
export const fmtMilestone = (min: number) => fmtHM(min % (24 * 60));
