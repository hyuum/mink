// Little pen-stroke doodles drawn when a planned block fills: a fan of three short lines out of each
// top corner (and the bottom corner of tall blocks), like a doodle on a birthday card.
const NS = 'http://www.w3.org/2000/svg';

export function drawPenLines(layer: HTMLElement, box: { x: number; y: number; w: number; h: number }, colour: string) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'doodles');
  svg.setAttribute('width', String(layer.clientWidth));
  svg.setAttribute('height', String(layer.clientHeight));
  layer.appendChild(svg);
  const ink = `color-mix(in srgb, ${colour} 55%, var(--ink))`;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const fan = (x: number, y: number, base: number, delay: number) => [-38, 0, 38].forEach((off, i) => {
    const a = ((base + off + (Math.random() - 0.5) * 8) * Math.PI) / 180;
    const dx = Math.cos(a), dy = Math.sin(a), from = 6, len = i === 1 ? 13 : 9;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${r1(x + dx * from)} ${r1(y + dy * from)}L${r1(x + dx * (from + len))} ${r1(y + dy * (from + len))}`);
    path.setAttribute('class', 'pen');
    path.style.stroke = ink;
    svg.appendChild(path);
    const length = Math.ceil(path.getTotalLength()) + 1;
    path.style.setProperty('--len', String(length));
    path.style.setProperty('--delay', `${delay + i * 0.05}s`);
  });
  fan(box.x + box.w - 2, box.y + 2, -45, 0);
  fan(box.x + 2, box.y + 2, -135, 0.08);
  if (box.h > 60) fan(box.x + box.w - 2, box.y + box.h - 2, 45, 0.16);
  setTimeout(() => svg.remove(), 1800);
}
