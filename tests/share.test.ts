import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeLink,
  decodeLink,
  linkUrl,
  parseLinkText,
  packSteps,
  unpackSteps,
  toBase64Url,
  fromBase64Url,
  qrSvg,
  type RivalLink,
} from '../src/systems/share';
import {Runner} from '../src/player/runner';

const ghostRun = () => {
  const r = new Runner('beach');
  r.state = 'playing';
  for (let i = 0; i < 60 * 40 && r.state === 'playing'; i++) {
    if (i % 25 === 0) r.jump();
    r.tick();
  }
  return r;
};

test('base64url and 9-bit step packing round-trip', () => {
  for (const bytes of [[], [0], [1, 2], [255, 254, 253], [0, 128, 7, 9]])
    assert.deepEqual([...fromBase64Url(toBase64Url(new Uint8Array(bytes)))], bytes);
  const samples = [0, 320, 641, 641, 900, 1226];
  assert.deepEqual(unpackSteps(packSteps(samples), samples.length - 1), samples);
  assert.throws(() => packSteps([0, 600]));
  assert.throws(() => fromBase64Url('a'));
});

test('a real run ghost survives the share link, including a Korean name', () => {
  const r = ghostRun();
  const ghost = {score: r.points, duration: r.time, samples: r.trace.slice(0, Math.floor(r.time) + 1)};
  const link: RivalLink = {kind: 'ghost', name: '지우', stage: 'beach', variant: 'remix-a', score: r.points, ghost};
  const url = linkUrl(link, 'https://example.org/Odyssey-Run/#old');
  assert.ok(url.startsWith('https://example.org/Odyssey-Run/#g=g1.'));
  assert.ok(url.length < 400, 'fits a phone-scannable QR: ' + url.length);
  const back = parseLinkText(url) as RivalLink;
  assert.equal(back.name, '지우');
  assert.equal(back.variant, 'remix-a');
  assert.equal(back.score, r.points);
  assert.deepEqual(back.ghost.samples, ghost.samples);
  assert.ok(qrSvg(url).startsWith('<svg'));
});

test('contest and result codes round-trip and reject tampering or nonsense', () => {
  const contest = {
    kind: 'contest',
    id: 'abc123',
    title: '3반 대회',
    stage: 'cave',
    variant: 'classic',
    assist: false,
  } as const;
  assert.deepEqual(decodeLink(encodeLink(contest)), contest);
  const result = {
    kind: 'result',
    contest: 'abc123',
    name: '민준',
    score: 3210,
    complete: true,
    stars: 77,
    maps: 2,
    hpLoss: 1,
    time: 78.4,
  } as const;
  assert.deepEqual(decodeLink(encodeLink(result)), result);
  assert.deepEqual(parseLinkText('r=' + encodeLink(result)), result);
  const code = encodeLink(result);
  assert.throws(() => decodeLink(code.replace('.3210.', '.9999.')), /잘렸거나/);
  assert.throws(() => decodeLink(code.slice(0, -3)));
  const forged = (body: string) => {
    let h = 7;
    for (const c of body) h = (h * 31 + c.charCodeAt(0)) % 997;
    return body + '.' + h.toString(36);
  };
  assert.throws(() => decodeLink(forged('r1.abc123.99999.1.0.0.0.10.AA')), /올바르지/);
  assert.throws(() => decodeLink(forged('c1.abc123.atlantis.classic.0.AA')), /올바르지/);
  assert.throws(() => decodeLink(forged('g1.beach.classic.4000.20.AAAA.AA')), /올바르지/);
  assert.throws(() => decodeLink(forged('x1.whatever')), /알 수 없는/);
});
