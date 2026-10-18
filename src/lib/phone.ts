// The bridge to the Android app's phone-usage reader. In the browser none of this exists, and
// `phoneAvailable` is false, so the web app simply never shows phone tracking.
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PhoneSession } from '../data/logic';

interface PhoneUsagePlugin {
  hasAccess(): Promise<{ granted: boolean }>;
  openAccessSettings(): Promise<void>;
  sessions(options: { from: number; to: number }): Promise<{ sessions: PhoneSession[] }>;
}

const PhoneUsage = registerPlugin<PhoneUsagePlugin>('PhoneUsage');

/** True inside the installed Android app. */
export const phoneAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export async function hasPhoneAccess(): Promise<boolean> {
  if (!phoneAvailable()) return false;
  try { return (await PhoneUsage.hasAccess()).granted; } catch { return false; }
}

export const openPhoneAccessSettings = () => PhoneUsage.openAccessSettings().catch(() => undefined);

export async function phoneSessions(from: number, to: number): Promise<PhoneSession[]> {
  if (!phoneAvailable()) return [];
  try { return (await PhoneUsage.sessions({ from, to })).sessions; } catch { return []; }
}
