import qrcode from 'qrcode-generator';
import {MAX_SCORE} from '../config';
import {STAGES, type StageId} from '../levels/courses';
import {isVariant, type VariantId} from '../levels/course-ids';
import {validateGhost, GHOST_SECONDS, type Ghost} from '../storage/journal';
import {cleanName} from '../storage/profiles';
// Links carry records in the URL fragment, so nothing is sent to a server. They cannot be
// verified either: anything parsed here is checked for shape and range, never trusted as proof.
const enc = new TextEncoder(),
  dec = new TextDecoder('utf-8', {fatal: true});
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function toBase64Url(bytes: Uint8Array) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0),
      chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2;
    for (let j = 0; j < chars; j++) out += B64[(n >> (18 - 6 * j)) & 63];
  }
  return out;
}
export function fromBase64Url(text: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw Error('base64');
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < 4; j++) n = (n << 6) | (j < chunk.length ? B64.indexOf(chunk[j]) : 0);
    out.push((n >> 16) & 255);
    if (chunk.length > 2) out.push((n >> 8) & 255);
    if (chunk.length > 3) out.push(n & 255);
  }
  return new Uint8Array(out);
}
const textOut = (s: string) => toBase64Url(enc.encode(s));
const textIn = (s: string) => dec.decode(fromBase64Url(s));
// Ghost samples rise by at most one second of running, so each step fits in 9 bits.
const STEP_BITS = 9;
export function packSteps(samples: number[]) {
  const bits: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i] - samples[i - 1];
    if (!Number.isInteger(d) || d < 0 || d >= 1 << STEP_BITS) throw Error('step');
    for (let b = STEP_BITS - 1; b >= 0; b--) bits.push((d >> b) & 1);
  }
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => (bytes[i >> 3] |= bit << (7 - (i & 7))));
  return toBase64Url(bytes);
}
export function unpackSteps(text: string, count: number) {
  const bytes = fromBase64Url(text),
    samples = [0];
  if (bytes.length !== Math.ceil((count * STEP_BITS) / 8)) throw Error('steps');
  for (let i = 0; i < count; i++) {
    let d = 0;
    for (let b = 0; b < STEP_BITS; b++) {
      const bit = i * STEP_BITS + b;
      d = (d << 1) | ((bytes[bit >> 3] >> (7 - (bit & 7))) & 1);
    }
    samples.push(samples[i] + d);
  }
  return samples;
}
const int = (s: string, max: number) => {
  if (!/^\d{1,7}$/.test(s)) throw Error('int');
  const n = Number(s);
  if (n > max) throw Error('range');
  return n;
};
const stage = (s: string) => {
  if (!STAGES.includes(s as StageId)) throw Error('stage');
  return s as StageId;
};
const variant = (s: string) => {
  if (!isVariant(s)) throw Error('variant');
  return s as VariantId;
};
const name = (s: string, fallback: string) => cleanName(textIn(s)) || fallback;
export interface RivalLink {
  kind: 'ghost';
  name: string;
  stage: StageId;
  variant: VariantId;
  score: number;
  ghost: Ghost;
}
export interface ContestLink {
  kind: 'contest';
  id: string;
  title: string;
  stage: StageId;
  variant: VariantId;
  assist: boolean;
}
export interface ContestResult {
  kind: 'result';
  contest: string;
  name: string;
  score: number;
  complete: boolean;
  stars: number;
  maps: number;
  hpLoss: number;
  time: number;
}
export type Link = RivalLink | ContestLink | ContestResult;
// A tiny check digit catches mistyped or truncated codes; it is not a signature.
const check = (s: string) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h.toString(36);
};
const seal = (body: string) => `${body}.${check(body)}`;
export function encodeLink(link: Link): string {
  if (link.kind === 'ghost') {
    const d = Math.floor(link.ghost.duration * 10);
    return seal(
      ['g1', link.stage, link.variant, link.score, d, packSteps(link.ghost.samples), textOut(link.name)].join('.'),
    );
  }
  if (link.kind === 'contest')
    return seal(['c1', link.id, link.stage, link.variant, link.assist ? 1 : 0, textOut(link.title)].join('.'));
  return seal(
    [
      'r1',
      link.contest,
      link.score,
      link.complete ? 1 : 0,
      link.stars,
      link.maps,
      link.hpLoss,
      Math.round(link.time * 10),
      textOut(link.name),
    ].join('.'),
  );
}
export function decodeLink(code: string): Link {
  const parts = code.trim().split('.'),
    sum = parts.pop() ?? '';
  if (check(parts.join('.')) !== sum) throw Error('코드가 잘렸거나 바뀌었어요. 다시 찍거나 복사해 주세요.');
  const [kind, ...f] = parts;
  try {
    if (kind === 'g1' && f.length === 6) {
      const duration = int(f[3], GHOST_SECONDS * 10) / 10,
        score = int(f[2], MAX_SCORE),
        samples = unpackSteps(f[4], Math.floor(duration));
      return {
        kind: 'ghost',
        stage: stage(f[0]),
        variant: variant(f[1]),
        score,
        ghost: validateGhost({score, duration, samples}, MAX_SCORE),
        name: name(f[5], '친구'),
      };
    }
    if (kind === 'c1' && f.length === 5 && /^[a-z0-9]{6}$/.test(f[0]) && /^[01]$/.test(f[3]))
      return {
        kind: 'contest',
        id: f[0],
        stage: stage(f[1]),
        variant: variant(f[2]),
        assist: f[3] === '1',
        title: (cleanName(textIn(f[4])) || '우리 반 대회').slice(0, 12),
      };
    if (kind === 'r1' && f.length === 8 && /^[a-z0-9]{6}$/.test(f[0]) && /^[01]$/.test(f[2]))
      return {
        kind: 'result',
        contest: f[0],
        score: int(f[1], MAX_SCORE),
        complete: f[2] === '1',
        stars: int(f[3], 100),
        maps: int(f[4], 3),
        hpLoss: int(f[5], 99),
        time: int(f[6], 36000) / 10,
        name: name(f[7], '항해사'),
      };
  } catch {
    throw Error('기록 코드의 내용이 올바르지 않아요.');
  }
  throw Error('알 수 없는 코드예요.');
}
const PREFIX = {ghost: 'g', contest: 'c', result: 'r'} as const;
export function linkUrl(link: Link, base: string) {
  return `${base.split('#')[0]}#${PREFIX[link.kind]}=${encodeLink(link)}`;
}
// Accepts a full link, a bare fragment or just the code a student read out.
export function parseLinkText(text: string): Link | null {
  const t = text.trim(),
    m = t.match(/#?(?:[gcr]=)?([A-Za-z0-9_.-]+)$/);
  return m ? decodeLink(m[1]) : null;
}
export function qrSvg(text: string) {
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Byte');
  qr.make();
  return qr.createSvgTag({cellSize: 4, margin: 2, scalable: true});
}
