import {C} from '../config';
export function score(distance: number, stars: number, maps: number, complete: boolean, length: number = C.length) {
  return Math.floor(Math.max(0, Math.min(length, distance)) / 10) + stars * 10 + maps * 100 + (complete ? 500 : 0);
}
export function rating(complete: boolean, stars: number, hpLoss: number) {
  return complete ? 1 + Number(stars >= 70) + Number(hpLoss === 0) : 0;
}
