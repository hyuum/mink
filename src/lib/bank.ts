// The bridge to the Android app's bank-notification reader. In the browser none of this exists, and
// `phoneAvailable` is false, so the web app never shows it.
import { registerPlugin } from '@capacitor/core';
import type { BankNote } from '../data/logic';
import { phoneAvailable } from './phone';

interface BankNotesPlugin {
  hasAccess(): Promise<{ granted: boolean }>;
  openAccessSettings(): Promise<void>;
  openAppInfo(): Promise<void>;
  setWatched(options: { packages: string[] }): Promise<void>;
  seenApps(): Promise<{ apps: { pkg: string; label: string; count: number; last: number }[] }>;
  items(options: { since: number }): Promise<{ items: BankNote[] }>;
  rebind(): Promise<void>;
}

const BankNotes = registerPlugin<BankNotesPlugin>('BankNotes');

export async function hasBankAccess(): Promise<boolean> {
  if (!phoneAvailable()) return false;
  try { return (await BankNotes.hasAccess()).granted; } catch { return false; }
}

export const openBankAccessSettings = () => BankNotes.openAccessSettings().catch(() => undefined);
export const openAppInfo = () => BankNotes.openAppInfo().catch(() => undefined);
export const setBankApps = (packages: string[]) => (phoneAvailable() ? BankNotes.setWatched({ packages }).catch(() => undefined) : Promise.resolve());
export const rebindBank = () => (phoneAvailable() ? BankNotes.rebind().catch(() => undefined) : Promise.resolve());

export async function bankSeenApps(): Promise<{ pkg: string; label: string; count: number; last: number }[]> {
  if (!phoneAvailable()) return [];
  try { return (await BankNotes.seenApps()).apps; } catch { return []; }
}

export async function bankNotes(since: number): Promise<BankNote[]> {
  if (!phoneAvailable()) return [];
  try { return (await BankNotes.items({ since })).items; } catch { return []; }
}
