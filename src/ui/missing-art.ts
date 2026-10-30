// A picture that cannot load (a flaky classroom connection, or offline before the islands were
// downloaded) becomes a soft parchment tile instead of the browser's broken-image mark.
export const MISSING_ART =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="10" fill="#efe4c8"/>' +
      '<path d="M34 40h52v40H34z" fill="#f8f0dc" stroke="#c9b48a" stroke-width="3"/>' +
      '<path d="M44 52h32M44 61h26M44 70h30" stroke="#c9b48a" stroke-width="3" stroke-linecap="round"/></svg>',
  );
export function replaceMissingArt(root: Element, missed: () => void, signal: AbortSignal) {
  root.addEventListener(
    'error',
    e => {
      const img = e.target as HTMLImageElement;
      if (img?.tagName !== 'IMG' || img.src === MISSING_ART) return;
      img.src = MISSING_ART;
      img.classList.add('art-missing');
      missed();
    },
    {capture: true, signal},
  );
}
