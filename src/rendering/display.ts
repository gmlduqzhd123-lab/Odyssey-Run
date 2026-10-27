import type {Quality} from '../storage/preferences';
// Rendering pixels are independent of the 960 × 540 simulation and logical view.
// Match native display pixels without oversampling, bounded for large displays.
export const DISPLAY={maxDensity:4,maxPixels:3840*2160,maxDeviceRatio:2,svgDensity:2,farParallax:0,nearParallax:0} as const;
export function displayViewport(width:number,height:number){
 const w=Math.max(1,width),h=Math.max(1,height),scale=Math.min(w/960,h/540);
 return {width:w/scale,height:h/scale,scale,extraHeight:h/scale-540,heroX:w/scale*.2};
}
export type DisplayViewport=ReturnType<typeof displayViewport>;
export function displayDensity(width:number,deviceRatio:number,height=width*9/16,quality:Quality='high'){
 const low=quality==='low'||(quality==='auto'&&typeof navigator!=='undefined'&&((navigator as Navigator&{deviceMemory?:number}).deviceMemory??8)<=2);
 const view=displayViewport(width,height),needed=view.scale*Math.min(low?1:DISPLAY.maxDeviceRatio,Math.max(1,deviceRatio||1));
 return Math.min(DISPLAY.maxDensity,Math.sqrt((low?1920*1080:DISPLAY.maxPixels)/(view.width*view.height)),needed);
}
