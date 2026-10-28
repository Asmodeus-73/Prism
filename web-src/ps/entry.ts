// Prism's bridge to the imaging algorithms of Photo Studio (MIT, see LICENSE-photo-studio).
// Built by web-src/ps/build.mjs into web/ps/ps.js, an IIFE that defines `self.PSI`.
// The same file runs on the page (synchronous calls, for recorded actions and editable
// effects) and in a Worker (web/ps/worker.js imports it), where it answers
// {id, op, args} messages with {id, out} or {id, err} and sends {id, progress}.
import type { Mask8, RGBA8 } from './src/imaging/types';
import { CancelledError } from './src/imaging/types';
import { denoise, deconvolve } from './src/imaging/filters/restore';
import { contextFill } from './src/imaging/retouch/context-fill';
import { runRestore } from './src/imaging/restore/pipeline';
import { RESTORE_FILTERS } from './src/imaging/restore/defs';
import { transferStats } from './src/imaging/restore/transfer';
import { applyAdjustment, defaultParams, shadowsHighlights, DEFAULT_SHADOWS_HIGHLIGHTS, replaceColor } from './src/imaging/adjust';
import { focusAreaMask, autoFocusRange } from './src/imaging/segment/focus-area';
import { decontaminate } from './src/imaging/segment/refine';
import { SKY_PRESETS, renderSky, placeSky, adjustSky, skyMaskEdge, skyHorizon, skyLight, foregroundLightMask } from './src/imaging/sky/sky';
import { seamOrder, contextScale, protectionMap } from './src/imaging/warp/seam-carve';
import { labStats } from './src/features/adjust/match-color';
import { harmonizePixels } from './src/features/assist/harmonize-math';

type Args = Record<string, any>;
type Report = (f: number) => void;
let cancelled = false;
const prog = (report: Report) => ({ report, cancelled: () => cancelled });

const SEAM_SHARE = 0.6;
// Pixels a mask covers (>= half), as the 0/1 array labStats expects.
const cover = (m?: Mask8) => (m ? Uint8Array.from(m.data, (v) => (v >= 128 ? 1 : 0)) : undefined);

const ops: Record<string, (a: Args, report: Report) => any> = {
  denoise: (a, r) => denoise(a.img, a.o, prog(r)),
  deconvolve: (a, r) => deconvolve(a.img, a.o, prog(r)),
  contextFill: (a, r) => contextFill(a.img, a.hole, a.o || {}, prog(r)),
  restore: async (a, r) => {
    const out = await runRestore(a.img, a.params, { scale: a.scale || 1, selection: a.selection, overlay: a.overlay, seed: 7 }, prog(r));
    return { image: out.image, overlay: out.overlay };
  },
  transferStats: (a) => transferStats(a.img),
  adjust: (a, r) => applyAdjustment(a.img, a.adj, a.selection, prog(r)),
  shadowsHighlights: (a, r) => shadowsHighlights(a.img, { ...DEFAULT_SHADOWS_HIGHLIGHTS, ...a.p }, a.selection, prog(r), a.scale || 1),
  replaceColor: (a, r) => replaceColor(a.img, a.p, a.selection, prog(r)),
  focusArea: (a, r) => focusAreaMask(a.img, a.o, prog(r)),
  autoFocusRange: (a) => autoFocusRange(a.img, a.noise || 0),
  decontaminate: (a) => decontaminate(a.img, a.mask, a.amount),
  skyRender: (a) => renderSky(SKY_PRESETS.find((s) => s.id === a.preset) || SKY_PRESETS[0], a.width, a.height, a.seed || 7),
  skyLayer: (a) => {
    const placed = placeSky(a.sky, a.width, a.height, a.placement, a.horizon);
    return a.brightness || a.temperature ? adjustSky(placed, a.brightness, a.temperature) : placed;
  },
  skyMask: (a) => skyMaskEdge(a.mask, a.shift, a.fade),
  skyHorizon: (a) => skyHorizon(a.mask),
  skyLight: (a) => skyLight(a.sky, a.mask, a.horizon),
  foregroundLight: (a) => foregroundLightMask(a.mask, a.horizon),
  seamScale: (a, r) => {
    const img: RGBA8 = a.img;
    const protect = protectionMap(img, { skin: !!a.skin, mask: a.protect });
    const vertical = seamOrder(img, 'vertical', Math.floor(img.width * SEAM_SHARE), protect, { report: (f) => r(f * 0.5), cancelled: () => cancelled });
    const horizontal = seamOrder(img, 'horizontal', Math.floor(img.height * SEAM_SHARE), protect, { report: (f) => r(0.5 + f * 0.5), cancelled: () => cancelled });
    return contextScale(img, { vertical, horizontal }, a.width, a.height, a.amount ?? 1);
  },
  harmonize: (a) => harmonizePixels(a.img, labStats(a.img, cover(a.layerMask)), labStats(a.target, cover(a.targetMask)), a.o),
  defaults: (a) => (a.kind === 'shadowsHighlights' ? { ...DEFAULT_SHADOWS_HIGHLIGHTS } : defaultParams(a.kind)),
};

const meta = {
  restoreFilters: RESTORE_FILTERS.map((f) => ({ id: f.id, params: f.params })),
  skyPresets: SKY_PRESETS.map((s) => ({ id: s.id, label: s.label })),
};

// Synchronous call on the page (async operations return a promise).
function run(op: string, args: Args, report: Report = () => {}) {
  const f = ops[op];
  if (!f) throw new Error('opération inconnue : ' + op);
  cancelled = false;
  return f(args, report);
}

// Typed arrays inside the result, to transfer instead of copying.
function buffers(v: any, out: ArrayBuffer[] = [], seen = new Set<any>()): ArrayBuffer[] {
  if (!v || typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  if (ArrayBuffer.isView(v)) {
    if (!out.includes(v.buffer as ArrayBuffer)) out.push(v.buffer as ArrayBuffer);
    return out;
  }
  for (const k in v) buffers(v[k], out, seen);
  return out;
}

const g = self as any;
g.PSI = { run, meta, ops: Object.keys(ops) };

if (typeof g.document === 'undefined' && typeof g.postMessage === 'function' && typeof g.importScripts === 'function') {
  g.onmessage = async (e: MessageEvent) => {
    const { id, op, args } = e.data || {};
    let last = 0;
    const report = (f: number) => {
      const now = Date.now();
      if (now - last > 120) {
        last = now;
        g.postMessage({ id, progress: f });
      }
    };
    try {
      const out = await run(op, args, report);
      g.postMessage({ id, out }, buffers(out));
    } catch (err: any) {
      g.postMessage({ id, err: err instanceof CancelledError ? 'cancelled' : String((err && err.message) || err) });
    }
  };
}
