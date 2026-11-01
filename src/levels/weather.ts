// Weather for a normal island run, chosen before the start once that island is complete.
// Storm headwind slows the run (shorter jumps across the same gaps); fog hides what is far ahead
// but never the warnings; rain only changes the look. Scores and records stay the same kind.
export const WEATHERS = {
  clear: {name: '맑음', description: '익숙한 하늘이에요.', icon: '☀️'},
  rain: {name: '비', description: '빗줄기 속을 달려요. 길은 그대로예요.', icon: '🌧️'},
  storm: {name: '폭풍', description: '맞바람에 조금 느려지고 점프가 짧아져요.', icon: '⛈️'},
  fog: {name: '안개', description: '멀리 있는 것이 흐려 보여요. 경고 표시는 그대로예요.', icon: '🌫️'},
} as const;
export type WeatherId = keyof typeof WEATHERS;
export const isWeather = (v: string): v is WeatherId => Object.hasOwn(WEATHERS, v);
// Running speed in the storm's headwind, as a share of the normal speed.
export const STORM_SPEED = 0.9;
// Fog thickens from this far ahead of the hero (logical pixels) to fully hidden at FOG.hidden.
export const FOG = {clear: 300, hidden: 560} as const;
