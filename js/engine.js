function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function inchesToFeet(inches) {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

function fmtHeight(inches, units) {
  if (units === "imperial") return inchesToFeet(inches);
  return `${Math.round(inches * 2.54)} cm`;
}

function fmtWeight(lbs, units) {
  if (units === "imperial") return `${lbs} lb`;
  return `${Math.round(lbs * 0.453592)} kg`;
}

function fmtHeightRange(lo, hi, units) {
  if (units === "imperial") return `${inchesToFeet(lo)}–${inchesToFeet(hi)}`;
  return `${Math.round(lo * 2.54)}–${Math.round(hi * 2.54)} cm`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function groupedByHeight(table, heightKey) {
  const groups = {};
  for (const row of table) {
    (groups[row.h] || (groups[row.h] = [])).push(row);
  }
  return groups;
}

function nearestHeights(groups, height) {
  const hs = Object.keys(groups).map(Number).sort((a, b) => a - b);
  let lo = hs[0];
  let hi = hs[hs.length - 1];
  for (const h of hs) {
    if (h <= height) lo = h;
    if (h >= height) {
      hi = h;
      break;
    }
  }
  return [lo, hi];
}

function lerpAttrAtHeight(rows, other, otherKey, attr) {
  const sorted = rows.slice().sort((a, b) => a[otherKey] - b[otherKey]);
  if (sorted.length === 1) return sorted[0].m[attr] ?? 1;
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  if (other <= lo[otherKey]) return lo.m[attr] ?? 1;
  if (other >= hi[otherKey]) return hi.m[attr] ?? 1;
  const t = (other - lo[otherKey]) / (hi[otherKey] - lo[otherKey]);
  return lerp(lo.m[attr] ?? 1, hi.m[attr] ?? 1, t);
}

function tableMul(table, height, other, otherKey, attr) {
  const groups = groupedByHeight(table);
  const [loH, hiH] = nearestHeights(groups, height);
  const lo = lerpAttrAtHeight(groups[loH], other, otherKey, attr);
  if (loH === hiH) return lo;
  const hi = lerpAttrAtHeight(groups[hiH], other, otherKey, attr);
  const t = (height - loH) / (hiH - loH);
  return lerp(lo, hi, t);
}

function heightMul(game, height, attr) {
  const h = clamp(height, 69, 88);
  const exact = game.heightMult[String(h)];
  if (exact && exact[attr] != null) return exact[attr];
  const keys = Object.keys(game.heightMult).map(Number).sort((a, b) => a - b);
  let lo = keys[0];
  let hi = keys[keys.length - 1];
  for (const k of keys) {
    if (k <= h) lo = k;
    if (k >= h) {
      hi = k;
      break;
    }
  }
  const a = game.heightMult[String(lo)]?.[attr] ?? 1;
  const b = game.heightMult[String(hi)]?.[attr] ?? 1;
  if (lo === hi) return a;
  return lerp(a, b, (h - lo) / (hi - lo));
}

let capLut = null;
let capIndex = null;
let capAttrs = null;
let cbLut = null;
let cbAttrs = null;

function installCaps(bytes, meta) {
  capLut = bytes;
  capIndex = meta.index;
  capAttrs = meta.attrs;
}

function installCB(bytes, attrs) {
  cbLut = bytes;
  cbAttrs = attrs;
}

function lutCB(attr, current, tier) {
  if (!cbLut || !cbAttrs || tier <= 0) return current;
  const ai = cbAttrs.indexOf(attr);
  if (ai < 0) return current;
  const v = clamp(Math.round(current), 25, 99);
  const n = clamp(Math.round(tier), 1, 5);
  return cbLut[ai * 375 + (v - 25) * 5 + (n - 1)];
}

function cbRating(attr, current, cap, tier) {
  const lo = 25;
  const hi = cap ?? 99;
  if (tier <= 0) return clamp(current, lo, hi);
  return clamp(lutCB(attr, current, tier), lo, hi);
}

function effectiveValues(values, caps, cbMap) {
  const out = {};
  for (const id of Object.keys(values)) {
    out[id] = cbRating(id, values[id], caps[id] ?? 99, cbMap[id] || 0);
  }
  return out;
}

function cbUsed(cbMap) {
  let n = 0;
  for (const id of Object.keys(cbMap)) n += cbMap[id] || 0;
  return n;
}

function lutCaps(size) {
  if (!capLut || !capIndex) return null;
  const h = size.height;
  const meta = capIndex[String(h)];
  if (!meta) return null;
  const w = clamp(size.weight, meta.w0, meta.w1);
  const s = clamp(size.wingspan, h, h + 6);
  const p = meta.off + ((w - meta.w0) * 7 + (s - h)) * 21;
  const out = {};
  for (let i = 0; i < 21; i++) out[capAttrs[i]] = capLut[p + i];
  return out;
}

function formulaCap(game, attr, size) {
  const hMul = heightMul(game, size.height, attr);
  const wMul = tableMul(game.weightTable, size.height, size.weight, "w", attr);
  const sMul = tableMul(game.wingspanTable, size.height, size.wingspan, "s", attr);
  return clamp(Math.round(25 + 74 * hMul * wMul * sMul), 25, 99);
}

function attrCap(game, attr, size) {
  const lut = lutCaps(size);
  if (lut && lut[attr] != null) return lut[attr];
  return formulaCap(game, attr, size);
}

function allCaps(game, size) {
  const lut = lutCaps(size);
  if (lut) return { ...lut };
  const out = {};
  for (const a of game.attributes) out[a.id] = formulaCap(game, a.id, size);
  return out;
}

function applyConstraints(game, values, caps, height, edited) {
  const next = { ...values };
  const h = String(clamp(height, 69, 88));
  const bump = (src, dst, delta) => {
    if (next[dst] == null) return;
    const lo = next[src] - delta;
    const hi = next[src] + delta;
    const cap = caps[dst] ?? 99;
    next[dst] = clamp(next[dst], Math.max(25, lo), Math.min(cap, hi));
  };
  const list = game.constraints[edited]?.[h] || [];
  for (const c of list) bump(edited, c.attr, c.delta);
  for (const [src, byH] of Object.entries(game.constraints)) {
    for (const c of byH[h] || []) {
      if (c.attr === edited) bump(edited, src, c.delta);
    }
  }
  return next;
}

function clampAllToCaps(values, caps) {
  const out = {};
  for (const id of Object.keys(values)) {
    out[id] = clamp(values[id], 25, caps[id] ?? 99);
  }
  return out;
}

const IMP_W = { HIGH: 1.45, MED: 1.0, LOW: 0.55 };

function overall(game, values, position) {
  const imp = game.importance[position] || {};
  let num = 0;
  let den = 0;
  for (const a of game.attributes) {
    const w = IMP_W[imp[a.id] || "MED"] || 1;
    const v = values[a.id] ?? 25;
    const curved = v < 70 ? v : 70 + (v - 70) * (1 + (v - 70) / 80);
    num += curved * w;
    den += 99 * w;
  }
  return clamp(Math.round((num / den) * 99), 25, 99);
}

function reqsMet(values, items) {
  if (!items || !items.length) return false;
  let acc = null;
  let op = null;
  for (const it of items) {
    const ok = (values[it.a] ?? 25) >= it.v;
    if (acc == null) acc = ok;
    else if (op === "OR") acc = acc || ok;
    else acc = acc && ok;
    op = it.op;
  }
  return !!acc;
}

function badgeLevel(values, badge, height) {
  if (badge.minHeight != null && height < badge.minHeight) return 0;
  if (badge.maxHeight != null && height > badge.maxHeight) return 0;
  const order = ["Bronze", "Silver", "Gold", "HallOfFame"];
  if (badge.reqs) {
    let lv = 0;
    for (let i = 0; i < order.length; i++) {
      if (reqsMet(values, badge.reqs[order[i]])) lv = i + 1;
    }
    return lv;
  }
  const attrs = badge.attrs || [];
  if (!attrs.length) return 0;
  const best = Math.max(...attrs.map((id) => values[id] ?? 25));
  if (best >= 92) return 4;
  if (best >= 85) return 3;
  if (best >= 75) return 2;
  if (best >= 60) return 1;
  return 0;
}

function takeoverOk(values, takeover) {
  const reqs = takeover.reqs || [];
  if (!reqs.length) return true;
  return reqs.every((r) => (values[r.a] ?? 25) >= r.v);
}

function categoryAverages(game, values) {
  const sums = {};
  const counts = {};
  for (const a of game.attributes) {
    sums[a.cat] = (sums[a.cat] || 0) + (values[a.id] ?? 25);
    counts[a.cat] = (counts[a.cat] || 0) + 1;
  }
  const out = {};
  for (const id of Object.keys(sums)) out[id] = Math.round(sums[id] / counts[id]);
  return out;
}

function defaultSize(game, posShort) {
  const p = game.positions[posShort];
  const height = p.defaultHeight;
  const weight = Math.round((p.minWeight + p.maxWeight) / 2);
  const wingspan = Math.min(height + 3, height + 6);
  return { height, weight, wingspan };
}

function defaultValues(game, caps) {
  const out = {};
  for (const a of game.attributes) {
    const base = game.initial[a.id] ?? 25;
    out[a.id] = clamp(base, 25, caps[a.id] ?? 99);
  }
  return out;
}

function wingspanRange(height) {
  return { min: height, max: height + 6 };
}

function weightRange(game, height, posShort) {
  const p = game.positions[posShort];
  const row = game.weightRanges?.[String(height)];
  let minW = p.minWeight;
  let maxW = p.maxWeight;
  if (row) {
    minW = Math.max(minW, row[0]);
    maxW = Math.min(maxW, row[1]);
  }
  if (minW > maxW) {
    minW = p.minWeight;
    maxW = p.maxWeight;
  }
  return { min: minW, max: maxW };
}

window.Engine = {
  installCaps,
  installCB,
  clamp,
  inchesToFeet,
  fmtHeight,
  fmtWeight,
  fmtHeightRange,
  attrCap,
  allCaps,
  applyConstraints,
  clampAllToCaps,
  overall,
  reqsMet,
  badgeLevel,
  takeoverOk,
  categoryAverages,
  defaultSize,
  defaultValues,
  wingspanRange,
  weightRange,
  cbRating,
  effectiveValues,
  cbUsed,
};
