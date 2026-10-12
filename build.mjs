/* Builds index.html from data/icons-raw.json + src/template.html.
 * icons-raw.json is what src/scrape.mjs reads off the two live icon pages
 * (run `node src/scrape.mjs data/icons-raw.json`, then `node build.mjs`). */
import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(new URL('./data/icons-raw.json', import.meta.url), 'utf8'));
const template = readFileSync(new URL('./src/template.html', import.meta.url), 'utf8');

const pascal = (s) => s.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

/* The dashboard's illustrated set paints with CSS variables that only exist on that page.
 * Each one is currentColor at a fixed strength, so it is written out as an opacity. */
const CI = { '--ci-axis': 1, '--ci-1': 0.8, '--ci-2': 0.6, '--ci-3': 0.4, '--ci-4': 0.22 };

function clean(svg) {
  const src = svg.replace(/\sdata-v-[a-z0-9]+=""/g, '');
  // size and class come off the ROOT tag only — a <rect> inside keeps its own width/height
  const end = src.indexOf('>');
  const head = src.slice(0, end).replace(/\s(class|width|height|aria-hidden|focusable)="[^"]*"/g, '');
  const body = src.slice(end).replace(/\sclass="[^"]*"/g, '');
  let s = (head + body)
    .replace(/(fill|stroke)="var\((--ci-[\w-]+)\)"/g, (_, attr, v) =>
      CI[v] === 1 ? `${attr}="currentColor"` : `${attr}="currentColor" ${attr}-opacity="${CI[v]}"`)
    .replace(/><\/(path|circle|rect|line|polyline|polygon|ellipse|stop)>/g, '/>')
    // The ServiceOps page merges each icon into one path, and trips on a start point followed
    // by a dot-led number ("m10.6 15.7.3-.9" comes out as "M10.6 15.7.3l-.9"). Put the
    // line-to back where it belongs — ServerCog is the one icon it hits today.
    .replace(/M(-?[\d.]+) (-?\d*\.\d+)(\.\d+)l/g, 'M$1 $2l$3');
  if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return s;
}

const lucideFromClass = (svg) => {
  const names = [...svg.matchAll(/lucide-([a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => !n.endsWith('-icon'));
  return names.length ? pascal(names[names.length - 1]) : '';
};

const serviceops = raw.a.map((g) => ({
  label: g.label,
  icons: g.icons.map((i) => {
    const custom = g.label === 'Product Navigation';
    return { n: i.name, u: i.use, k: custom ? 'custom' : 'lucide', l: custom ? '' : i.name, s: clean(i.svg) };
  }),
}));

const dashboard = raw.b.map((g) => ({
  label: g.label,
  icons: g.icons.map((i) => {
    const art = g.label === 'Widget artwork';
    let s = clean(i.svg);
    // The dashboard page hands out its lucide glyphs on a widened viewBox (67% ink, the
    // optical size of the icon set ServiceOps ships today). Same here, so the two agree.
    if (!art) s = s.replace('viewBox="0 0 24 24"', 'viewBox="-1.5 -1.5 27 27"');
    return { n: i.name, u: '', k: art ? 'artwork' : 'lucide', l: art ? '' : lucideFromClass(i.svg), s };
  }),
}));

const SETS = [
  {
    id: 'serviceops', label: 'ServiceOps',
    source: 'https://ronak-patel-motadata.github.io/ServiceOps-Ticket-Detail-/',
    note: 'Icons of the ServiceOps technician portal. Each one is a single path on a 48 × 48 viewBox. Product Navigation is custom artwork; every other group is lucide.',
    groups: serviceops,
  },
  {
    id: 'dashboard', label: 'Dashboard',
    source: 'https://zenichakalasiya.github.io/ServiceOps_Dashboard_v2/#/icons',
    note: 'Icons of the Dashboards module. Lucide glyphs sit on a widened viewBox (-1.5 -1.5 27 27) so they match the optical size of the current ServiceOps icons. Widget artwork is illustrated 64 × 64 artwork.',
    groups: dashboard,
  },
];

const json = JSON.stringify(SETS).replace(/</g, '\\u003c');
writeFileSync(new URL('./index.html', import.meta.url), template.replace('/*__DATA__*/[]', () => json));

for (const s of SETS) {
  const n = s.groups.reduce((a, g) => a + g.icons.length, 0);
  const noL = s.groups.flatMap((g) => g.icons).filter((i) => i.k === 'lucide' && !i.l).map((i) => i.n);
  console.log(s.label, s.groups.length, 'groups', n, 'icons', noL.length ? 'no lucide name: ' + noL : '');
}
console.log('index.html', Math.round(json.length / 1024), 'KB of icon data');
