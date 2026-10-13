// Small shared UI state: current route, the quick-add sheet, toasts and a ticking clock.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AppData } from '../data/types';

/* Route: a bare hash token, e.g. #money */
export type Route = 'home' | 'time' | 'week' | 'stats' | 'money' | 'tasks' | 'more';
const ROUTES: Route[] = ['home', 'time', 'week', 'stats', 'money', 'tasks', 'more'];

function readRoute(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'home';
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb);
      return () => window.removeEventListener('hashchange', cb);
    },
    readRoute,
    () => 'home' as Route,
  );
}

export function go(route: Route) {
  const next = route === 'home' ? '#home' : `#${route}`;
  if (location.hash !== next) location.hash = next;
  window.scrollTo({ top: 0 });
}

/* Generic tiny store */
function createStore<T>(initial: T) {
  let value = initial;
  const ls = new Set<() => void>();
  return {
    get: () => value,
    set: (v: T) => { value = v; ls.forEach((l) => l()); },
    use: () => useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb); }, () => value, () => value),
  };
}

/* Time screens: the day being looked at (null = today) and the paint brush, shared by Day and Week. */
export const timeDay = createStore<string | null>(null);
export const ERASE = 'erase';
export const brush = createStore<string | null>(null);

/** Whether the paint dock shows activity names; remembered on this device. */
const LABELS_KEY = 'matcha.dockLabels';
const readLabels = () => { try { return localStorage.getItem(LABELS_KEY) === '1'; } catch { return false; } };
export const dockLabels = createStore<boolean>(readLabels());
export function setDockLabels(v: boolean) {
  dockLabels.set(v);
  try { localStorage.setItem(LABELS_KEY, v ? '1' : '0'); } catch { /* storage blocked: still works this session */ }
}

/* Quick add sheet */
export type AddTab = 'spend' | 'time' | 'task';
export const quickAdd = createStore<AddTab | null>(null);
export const openQuickAdd = (tab: AddTab = 'spend') => quickAdd.set(tab);
export const closeQuickAdd = () => quickAdd.set(null);

/* Toasts, with optional undo */
export interface Toast { id: number; text: string; undo?: AppData }
export const toast = createStore<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string, undo?: AppData) {
  clearTimeout(toastTimer);
  toast.set({ id: Date.now(), text, undo });
  toastTimer = setTimeout(() => toast.set(null), undo ? 6000 : 2600);
}

/** Current time, re-rendering every `ms` milliseconds. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
