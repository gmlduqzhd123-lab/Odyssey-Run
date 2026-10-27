import {C} from '../config';
export function score(distance: number, stars: number, maps: number, complete: boolean) {
  return Math.floor(Math.max(0, Math.min(C.length, distance)) / 10) + stars * 10 + maps * 100 + (complete ? 500 : 0);
}
export function rating(complete: boolean, stars: number, hpLoss: number) {
  return complete ? 1 + Number(stars >= 70) + Number(hpLoss === 0) : 0;
}
