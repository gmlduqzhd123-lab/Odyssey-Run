import {PEOPLE, assetUrl} from '../assets/catalog';
import {seeded} from '../levels/endless';
import {button} from './html';
// The word-card game: six people of the voyage, each as a portrait card and a name card, face
// down. Turn two at a time; a portrait and its own name stay face up. Fewest turns is the best.
export const CARD_PEOPLE = ['odysseus', 'penelope', 'telemachus', 'athena', 'hermes', 'aeolus'] as const;
export interface Card {
  person: string;
  face: 'portrait' | 'name';
}
export interface CardGame {
  cards: Card[];
  open: number[];
  matched: Set<string>;
  turns: number;
}
export function newCardGame(seed: string): CardGame {
  const random = seeded('cards:' + seed),
    cards = CARD_PEOPLE.flatMap(person => [
      {person, face: 'portrait' as const},
      {person, face: 'name' as const},
    ]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return {cards, open: [], matched: new Set(), turns: 0};
}
// Turns a card. Returns 'match', 'miss' (two shown, to be hidden), or '' for nothing settled yet.
export function turnCard(g: CardGame, i: number) {
  const c = g.cards[i];
  if (!c || g.matched.has(c.person + c.face) || g.open.includes(i)) return '';
  if (g.open.length === 2) g.open = [];
  g.open.push(i);
  if (g.open.length < 2) return '';
  g.turns++;
  const [a, b] = g.open.map(k => g.cards[k]);
  if (a.person === b.person && a.face !== b.face) {
    g.matched.add(a.person + a.face).add(b.person + b.face);
    g.open = [];
    return 'match';
  }
  return 'miss';
}
export const cardsDone = (g: CardGame) => g.matched.size === g.cards.length;
const name = (id: string) => PEOPLE.find(p => p.id === id)?.name ?? id;
export function cardsMarkup(header: string, g: CardGame, best: number) {
  const done = cardsDone(g);
  return `<div class="page word-cards">${header}<div class="page-heading"><span class="eyebrow">WORD CARDS</span><h1 tabindex="-1">📇 인물 낱말 카드</h1><p>그림과 이름이 짝인 카드를 찾아요. 두 장씩 뒤집어요.</p><p><b>뒤집은 횟수 ${g.turns}</b>${best ? ` · 나의 최고 ${best}번` : ''}</p></div><div class="card-grid">${g.cards
    .map((c, i) => {
      const up = g.open.includes(i) || g.matched.has(c.person + c.face),
        label = up ? (c.face === 'name' ? name(c.person) : `${name(c.person)} 그림`) : `${i + 1}번 카드 뒤집기`;
      return button(
        'card:' + i,
        up
          ? c.face === 'portrait'
            ? `<img src="${assetUrl(c.person)}" alt="">`
            : `<b>${name(c.person)}</b>`
          : '<span aria-hidden="true">?</span>',
        `word-card ${up ? 'up' : ''} ${g.matched.has(c.person + c.face) ? 'matched' : ''}`,
        `aria-label="${label}"`,
      );
    })
    .join(
      '',
    )}</div><p role="status" id="cards-status">${done ? `모두 찾았어요! ${g.turns}번 만에 해냈어요.` : ''}</p><div class="button-row">${button('cards', done ? '한 번 더' : '새로 섞기', 'primary')}${button('journal', '모험 수첩', 'secondary')}</div></div>`;
}
