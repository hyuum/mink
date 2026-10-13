let counter = 0;

/** Short unique id, sortable by creation time. */
export function uid(): string {
  counter = (counter + 1) % 1296;
  return Date.now().toString(36) + counter.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6);
}
