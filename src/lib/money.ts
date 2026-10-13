// Money is stored as integer cents to avoid floating-point drift.

export function fmtMoney(cents: number, opts: { sign?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100).toLocaleString('en-AU');
  const c = String(abs % 100).padStart(2, '0');
  const body = `$${dollars}.${c}`;
  if (neg) return `−${body}`;
  return opts.sign ? `+${body}` : body;
}

/** Whole dollars when there are no cents: $350 rather than $350.00. */
export function fmtMoneyShort(cents: number): string {
  return cents % 100 === 0 ? `$${(cents / 100).toLocaleString('en-AU')}` : fmtMoney(cents);
}

/** Parse "12.5", "$12.50" or "12" into cents. Returns null when not a positive amount. */
export function parseAmount(input: string): number | null {
  const clean = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents > 0 ? cents : null;
}

/** Keypad input rules: one decimal point, at most two decimals, no leading zeros. */
export function pressKey(current: string, key: string): string {
  if (key === 'del') return current.slice(0, -1);
  if (key === '.') return current.includes('.') ? current : (current || '0') + '.';
  const dot = current.indexOf('.');
  if (dot !== -1 && current.length - dot > 2) return current;
  if (current === '0') return key;
  if (current.replace('.', '').length >= 7) return current;
  return current + key;
}
