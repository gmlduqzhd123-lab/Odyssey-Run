import test from 'node:test';
import assert from 'node:assert/strict';
import {Gallery, GALLERY_KEY, MAX_GALLERY, readGallery} from '../src/storage/gallery';
import {Contests, contestLength, suspicion, readContests, CONTESTS_KEY} from '../src/storage/contests';
import {decodeLink, encodeLink, linkUrl, parseLinkText} from '../src/systems/share';
import {makerLength} from '../src/levels/maker';

const memory = () => {
  const m = new Map<string, string>();
  return {getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m};
};

test('the gallery keeps each course once, counts votes and ranks by them', () => {
  const s = memory(),
    g = new Gallery(s);
  assert.ok(g.add({stage: 'beach', blocks: 'fpskhgobwl', title: '가시 계곡'}));
  assert.ok(g.add({stage: 'beach', blocks: 'fpskhgobwl', title: '같은 코스'}));
  assert.ok(g.add({stage: 'wind', blocks: 'ffffffffff', title: '<b>평지</b>'}));
  assert.equal(g.list.length, 2);
  g.vote(1, 1);
  g.vote(1, 1);
  g.vote(0, -1);
  assert.deepEqual(
    g.ranked().map(c => [c.title, c.votes]),
    [
      ['<b>평지</b>', 2],
      ['가시 계곡', 0],
    ],
  );
  assert.equal(new Gallery(s).list.length, 2);
  assert.deepEqual(readGallery(JSON.stringify([{stage: 'mars', blocks: 'x', title: 1}, null])), []);
  for (let i = 0; g.list.length < MAX_GALLERY; i++)
    g.add({
      stage: 'cave',
      blocks: 'ffffffff' + 'cgpsokhbwl'[i % 10] + 'cgpsokhbwl'[Math.floor(i / 10) % 10],
      title: String(i),
    });
  assert.equal(g.add({stage: 'sea', blocks: 'pppppppppp', title: '하나 더'}), false);
  assert.ok(s.m.has(GALLERY_KEY));
});

test('a contest on a student course travels by link and checks results against its length', () => {
  const link = {
    kind: 'contest' as const,
    id: 'abc234',
    title: '갤러리 대회',
    stage: 'cave' as const,
    variant: 'classic' as const,
    assist: false,
    blocks: 'fpskhgobwl',
  };
  assert.deepEqual(decodeLink(encodeLink(link)), link);
  assert.deepEqual(parseLinkText(linkUrl(link, 'https://x/Odyssey-Run/')), link);
  const {blocks, ...plain} = link;
  assert.ok(blocks);
  assert.deepEqual(decodeLink(encodeLink(plain)), plain);
  const s = memory(),
    c = new Contests(s);
  c.host({id: link.id, title: link.title, stage: link.stage, variant: link.variant, assist: false, blocks});
  assert.equal(readContests(s.m.get(CONTESTS_KEY)!).hosted[0].blocks, blocks);
  const length = contestLength({blocks});
  assert.equal(length, makerLength());
  const finished = {
    name: '지우',
    score: Math.floor(length / 10) + 300 + 500,
    complete: true,
    stars: 30,
    maps: 0,
    hpLoss: 0,
    time: 40,
  };
  assert.equal(suspicion(finished, length), null);
  assert.ok(suspicion(finished));
});
