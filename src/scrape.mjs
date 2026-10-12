import { chromium } from 'file:///C:/Users/Zeni%20Chakalasiya/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));

// ---- A: ServiceOps Ticket Detail ----
await page.goto('https://ronak-patel-motadata.github.io/ServiceOps-Ticket-Detail-/', { waitUntil: 'networkidle' });
const isLib = async () => (await page.locator('h1', { hasText: 'Icon Library' }).count()) > 0;
for (const sel of ['[title="Icon Library"]', '[aria-label="Icon Library"]']) {
  if (await isLib()) break;
  const l = page.locator(sel).first();
  if (await l.count()) { await l.click(); await page.waitForTimeout(500); }
}
if (!(await isLib())) {
  // fall back: the button holding lucide's "shapes" glyph, else walk the sidebar from the bottom
  const l = page.locator('button:has(svg.lucide-shapes)').first();
  if (await l.count()) { await l.click(); await page.waitForTimeout(500); }
}
if (!(await isLib())) {
  const n = await page.locator('button').count();
  for (let i = 0; i < Math.min(n, 60) && !(await isLib()); i++) {
    const b = page.locator('button').nth(i);
    const box = await b.boundingBox();
    if (!box || box.x > 70) continue;
    await b.click().catch(() => {});
    await page.waitForTimeout(250);
  }
}
console.log('A on library:', await isLib());
const a = await page.evaluate(() =>
  [...document.querySelectorAll('main section')].map((sec) => {
    const h = sec.querySelector('h2');
    const label = [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    return {
      label,
      icons: [...sec.querySelectorAll('button')].map((b) => {
        const spans = b.querySelectorAll(':scope > span');
        return {
          name: spans[1]?.textContent.trim(),
          use: spans[2]?.textContent.trim() || '',
          svg: b.querySelector('svg')?.outerHTML || '',
        };
      }),
    };
  }),
);

// ---- B: Dashboard ----
await page.goto('https://zenichakalasiya.github.io/ServiceOps_Dashboard_v2/#/icons', { waitUntil: 'networkidle' });
await page.waitForSelector('.il-tile', { timeout: 30000 });
await page.locator('.seg-b', { hasText: '24px' }).click();
await page.waitForTimeout(300);
const b = await page.evaluate(() =>
  [...document.querySelectorAll('.il-sec')].map((sec) => {
    const h = sec.querySelector('.il-sec-h');
    const label = [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    return {
      label,
      icons: [...sec.querySelectorAll('.il-tile')].map((t) => ({
        name: t.querySelector('.il-name').textContent.trim(),
        use: '',
        svg: t.querySelector('svg')?.outerHTML || '',
      })),
    };
  }),
);
await browser.close();

writeFileSync(out, JSON.stringify({ a, b }));
for (const [k, v] of Object.entries({ a, b })) {
  console.log(k, v.length, 'groups,', v.reduce((n, g) => n + g.icons.length, 0), 'icons,', v.reduce((n, g) => n + g.icons.filter((i) => !i.svg).length, 0), 'missing svg');
  console.log('  ', v.map((g) => `${g.label} (${g.icons.length})`).join(' | '));
}
