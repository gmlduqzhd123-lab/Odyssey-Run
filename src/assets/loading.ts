import {assetUrl} from './catalog';
import {sheetUrl} from './terrain';
import {RUN_ART} from './runner-art';
import {CROUCH_ART, MONSTER_ART} from './expansion-art';
import type {StageId} from '../levels/courses';
const svg = (name: string) => `${import.meta.env.BASE_URL}assets/${name}.svg`;
export const backgroundFiles = (stage: StageId) =>
  ['sky', 'far', 'mid'].map(layer => ({key: `${stage}-${layer}`, url: svg(`${stage}-${layer}`), svg: true}));
export const HOME_FILES = [
  ...backgroundFiles('beach'),
  {key: 'boat', url: svg('boat'), svg: true},
  {key: 'odysseus', url: assetUrl('odysseus'), svg: false},
];
export const GAME_FILES = [
  ...['star', 'crate', 'pillar', 'gate', 'rock', 'giant', 'hand'].map(key => ({key, url: svg(key), svg: true})),
  ...['map', 'shield', 'wings', 'magnet', 'apple', 'trident', 'lantern', 'compass'].map(key => ({
    key,
    url: assetUrl(key),
    svg: false,
  })),
  {key: 'terrain-sheet', url: sheetUrl('terrain-sheet'), svg: false},
  {key: 'odysseus-run', url: `${import.meta.env.BASE_URL}${RUN_ART.file}`, svg: false},
  {key: 'hero-crouch', url: `${import.meta.env.BASE_URL}${CROUCH_ART.file}`, svg: false},
  {key: 'monster-atlas', url: `${import.meta.env.BASE_URL}${MONSTER_ART.file}`, svg: false},
];
