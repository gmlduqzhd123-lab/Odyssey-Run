// Rendering pixels are independent of the 960 × 540 simulation and logical view.
// Half-step buckets avoid rebuilding canvases for every address-bar resize.
export const DISPLAY={maxDensity:3,maxDeviceRatio:2,svgDensity:2,farParallax:0,nearParallax:0} as const;
export function displayDensity(width:number,deviceRatio:number){
 const needed=width/960*Math.min(DISPLAY.maxDeviceRatio,Math.max(1,deviceRatio||1));
 return Math.max(1,Math.min(DISPLAY.maxDensity,Math.ceil(needed*2)/2));
}
