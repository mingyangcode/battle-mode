import type { AnalysisResult } from '../types/analysis';
export const LOCAL_VERSION = 'browser-musicnn-v1';
export interface LocalRaw {
  duration: number;
  hop: number;
  energy: number[];
  attack: number[];
  brightness: number[];
  bpm: number;
  beats: number[];
  embeddings?: { start: number; end: number; values: number[] }[];
  elapsedSeconds: number;
}
export interface RankConfig { length: number; mode: 'same' | 'matched' | 'sequential'; pre: number; post: number }
const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
/** Whole-song, inexpensive time-domain features. No claim of structural/downbeat detection. */
export function quickFeatures(pcm: Float32Array, rate: number): LocalRaw {
  const frame = Math.round(rate * .02), energies: number[] = [], brightness: number[] = [];
  for (let i = 0; i < pcm.length; i += frame) {
    let power = 0, diff = 0;
    const n = Math.min(frame, pcm.length - i);
    for (let j = i; j < i + n; j++) {
      power += pcm[j] ** 2;
      if (j > i) diff += (pcm[j] - pcm[j - 1]) ** 2;
    }
    energies.push(Math.sqrt(power / n));
    brightness.push(power > 1e-10 ? Math.sqrt(diff / power) : 0);
  }
  const onset = energies.map((e, i) => Math.max(0, e - (energies[i - 1] ?? e)));
  let lag = 0, best = 0;
  for (let l = 17; l <= 60; l++) {
    let sum = 0, a = 0, b = 0;
    for (let i = l; i < onset.length; i++) { sum += onset[i] * onset[i-l]; a += onset[i] ** 2; b += onset[i-l] ** 2; }
    const score = sum / Math.sqrt(a * b || 1);
    if (score > best) { best = score; lag = l; }
  }
  const bpm = best > .12 ? 60 / (lag * .02) : 0;
  const beats: number[] = [];
  if (bpm) {
    let offset = 0, strongest = 0;
    for (let o = 0; o < lag; o++) {
      let s = 0;
      for (let i = o; i < onset.length; i += lag) s += onset[i];
      if (s > strongest) { strongest = s; offset = o; }
    }
    for (let i = offset; i < onset.length; i += lag) beats.push(i * .02);
  }
  const pooled = (a: number[]) => {
    const out: number[] = [];
    for (let i = 0; i < a.length; i += 25) out.push(mean(a.slice(i, i + 25)));
    return out;
  };
  return { duration: pcm.length / rate, hop: .5, energy: pooled(energies), attack: pooled(onset), brightness: pooled(brightness), bpm, beats, elapsedSeconds: 0 };
}
function cosine(a: number[], b: number[]) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? Math.max(0, Math.min(1, dot / Math.sqrt(aa * bb))) : 0;
}
export function rankLocal(raw: LocalRaw, hash: string, c: RankConfig, cacheHit = false): AnalysisResult {
  if (![c.length, c.pre, c.post].every(Number.isFinite) || c.length < .5 || c.pre < 0 || c.post < 0) throw new Error('无效片段参数');
  const max = raw.duration - (c.mode === 'sequential' ? 2 * c.length + c.pre + c.post : c.length);
  const maxEnergy = Math.max(1e-8, ...raw.energy), maxAttack = Math.max(1e-8, ...raw.attack);
  const summarize = (a: number[], start: number, end: number) => a.slice(Math.floor(start / raw.hop), Math.max(Math.floor(start / raw.hop) + 1, Math.ceil(end / raw.hop)));
  const candidates: {start: number; end: number; score: number; energy: number; bright: number; embedding?: number[]}[] = [];
  for (let t = 0; t <= max + 1e-7; t += 2) {
    const start = Math.min(max, t), end = start + c.length;
    const es = summarize(raw.energy, start, end), energy = mean(es);
    if (energy < 1e-5 || energy / maxEnergy < .04) continue;
    const variance = mean(es.map(x => (x - energy) ** 2)) / (energy ** 2 + 1e-8);
    const valid = raw.embeddings?.filter(e => e.start < end && e.end > start) ?? [];
    const embedding = valid.length ? valid[0].values.map((_, i) => mean(valid.map(v => v.values[i]))) : undefined;
    const consistency = embedding ? mean(valid.map(v => cosine(v.values, embedding))) : 0;
    const tail = c.mode === 'sequential' ? mean(summarize(raw.energy, end + c.pre, end + c.pre + c.length)) / maxEnergy : 1;
    const base = .45 * Math.sqrt(energy / maxEnergy) + .2 / (1 + variance) + .2 * Math.sqrt(mean(summarize(raw.attack, start, end)) / maxAttack) + .15 * Math.min(1, tail);
    candidates.push({start, end, score: embedding ? .85 * base + .15 * consistency : base, energy, bright: mean(summarize(raw.brightness, start, end)), embedding});
  }
  candidates.sort((a,b) => b.score - a.score);
  const chosen: typeof candidates = [];
  for (const a of candidates) if (chosen.every(b => Math.abs(a.start-b.start) >= c.length / 2) && chosen.length < 3) chosen.push(a);
  const pairs: AnalysisResult['matchedPairs'] = [];
  const pool = candidates.slice(0, 120);
  for (let i = 0; i < pool.length; i++) for (let j = i+1; j < pool.length; j++) {
    const a = pool[i], b = pool[j];
    if (Math.max(a.start,b.start) < Math.min(a.end,b.end)) continue;
    const similarity = 1 - Math.abs(a.energy-b.energy) / Math.max(a.energy,b.energy);
    const timbre = a.embedding && b.embedding ? cosine(a.embedding,b.embedding) : 1 / (1 + Math.abs(a.bright-b.bright));
    pairs.push({segmentA:{start:a.start,end:a.end},segmentB:{start:b.start,end:b.end},score:.4*similarity+.35*timbre+.125*(a.score+b.score)});
  }
  pairs.sort((a,b)=>b.score-a.score);
  const diverse: typeof pairs = [];
  for (const p of pairs) if (diverse.length < 3 && diverse.every(q => Math.min(Math.abs(p.segmentA.start-q.segmentA.start)+Math.abs(p.segmentB.start-q.segmentB.start),Math.abs(p.segmentA.start-q.segmentB.start)+Math.abs(p.segmentB.start-q.segmentA.start)) >= c.length / 2)) diverse.push(p);
  return { trackHash: hash, analysisVersion: LOCAL_VERSION, recommendationVersion: 'browser-ranking-v1', recommendationMode: c.mode, preRoll:c.pre,postRoll:c.post,roundDuration:c.length,duration:raw.duration,bpm:raw.bpm,beats:raw.beats,downbeats:[],sections:[],recommendations:chosen.map(({start,end,score})=>({start,end,score})),matchedPairs:diverse,quality:raw.embeddings?.length?'deep':'quick',analyzer:raw.embeddings?.length?'browser-musicnn':'browser-quick',elapsedSeconds:raw.elapsedSeconds,cacheHit,rawCacheHit:cacheHit,warnings:[] };
}
