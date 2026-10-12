/* Turns a stroke-drawn icon into ONE filled path (Figma's "Outline stroke" + "Flatten").
 * Every element's stroke is expanded to its outline with Skia's stroker, filled elements are
 * added as they are, and the lot is merged into a single path with no overlaps. An icon that
 * has no stroke anywhere is returned untouched. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const PathKit = await require('pathkit-wasm/bin/pathkit.js')({
  // handed over as bytes: on Windows the loader tries to fetch() the file path and fails
  wasmBinary: readFileSync(require.resolve('pathkit-wasm/bin/pathkit.wasm')),
});

const UP = +process.env.UP || 16; // stroke at 32× so Skia's curve fitting error is far below a rounded decimal

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const num = (v, d = 0) => (v === undefined || v === '' ? d : parseFloat(v));

function shapeToD(name, a) {
  if (name === 'path') return a.d || '';
  if (name === 'line') return `M${num(a.x1)} ${num(a.y1)}L${num(a.x2)} ${num(a.y2)}`;
  if (name === 'polyline' || name === 'polygon') {
    const p = (a.points || '').trim().split(/[\s,]+/).map(Number);
    let d = '';
    for (let i = 0; i + 1 < p.length; i += 2) d += `${i ? 'L' : 'M'}${p[i]} ${p[i + 1]}`;
    return name === 'polygon' ? d + 'Z' : d;
  }
  if (name === 'circle' || name === 'ellipse') {
    const cx = num(a.cx), cy = num(a.cy);
    const rx = name === 'circle' ? num(a.r) : num(a.rx), ry = name === 'circle' ? num(a.r) : num(a.ry);
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }
  if (name === 'rect') {
    const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height);
    let rx = a.rx !== undefined ? num(a.rx) : num(a.ry), ry = a.ry !== undefined ? num(a.ry) : num(a.rx);
    rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
    if (!rx || !ry) return `M${x} ${y}h${w}v${h}h${-w}Z`;
    return `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}`
      + `h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`;
  }
  return '';
}

const matrixOf = (t) => {
  const m = /matrix\(([^)]+)\)/.exec(t || '');
  return m ? m[1].trim().split(/[\s,]+/).map(Number) : [1, 0, 0, 1, 0, 0];
};

const JOIN = { round: 'ROUND', bevel: 'BEVEL', miter: 'MITER' };
const CAP = { round: 'ROUND', square: 'SQUARE', butt: 'BUTT' };

const round = (d, places) => d.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (n) => {
  const v = +(+n).toFixed(places);
  return String(Object.is(v, -0) ? 0 : v);
});

/* places = decimals kept in the icon's own viewBox units */
export function flatten(svg, places = 2) {
  const end = svg.indexOf('>');
  const root = attrs(svg.slice(0, end));
  const inner = svg.slice(end + 1);
  if (/<defs|url\(#/.test(inner)) return svg; // carries its own paint (a gradient)
  const els = [...inner.matchAll(/<(path|circle|ellipse|rect|line|polyline|polygon)\b([^>]*?)\/?>/g)]
    .map((m) => ({ name: m[1], a: { ...root, ...attrs(m[2]) } }));
  const on = (v) => v !== undefined && v !== 'none';
  if (!els.some((e) => on(e.a.stroke))) return svg;
  if (els.some((e) => (on(e.a.fill) && e.a.fill !== 'currentColor') || (on(e.a.stroke) && e.a.stroke !== 'currentColor')
    || e.a.opacity || e.a['fill-opacity'] || e.a['stroke-opacity'])) return svg; // more than one paint: not one path

  const out = PathKit.NewPath();
  for (const { name, a } of els) {
    const d = shapeToD(name, a);
    if (!d) continue;
    const [m0, m1, m2, m3, m4, m5] = matrixOf(a.transform);
    const place = (p) => p.transform(m0 * UP, m2 * UP, m4 * UP, m1 * UP, m3 * UP, m5 * UP, 0, 0, 1);
    if (on(a.fill)) {
      const p = PathKit.FromSVGString(d);
      if (a['fill-rule'] === 'evenodd') p.setFillType(PathKit.FillType.EVENODD);
      place(p).simplify();
      out.op(p, PathKit.PathOp.UNION);
      p.delete();
    }
    if (on(a.stroke)) {
      const p = place(PathKit.FromSVGString(d));
      // the stroke is scaled with the element, as the browser draws it (uniform scales only)
      p.stroke({
        width: num(a['stroke-width'], 1) * Math.hypot(m0, m1) * UP,
        join: PathKit.StrokeJoin[JOIN[a['stroke-linejoin']] || 'MITER'],
        cap: PathKit.StrokeCap[CAP[a['stroke-linecap']] || 'BUTT'],
        miter_limit: num(a['stroke-miterlimit'], 4),
      });
      p.simplify();
      out.op(p, PathKit.PathOp.UNION);
      p.delete();
    }
  }
  out.simplify();
  out.transform(1 / UP, 0, 0, 0, 1 / UP, 0, 0, 0, 1);
  const d = round(out.toSVGString(), places);
  out.delete();
  if (!d) return svg;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${root.viewBox}"><path fill="currentColor" fill-rule="evenodd" d="${d}"/></svg>`;
}
