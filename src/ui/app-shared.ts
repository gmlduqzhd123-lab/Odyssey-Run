import {SAVE_KEY} from '../storage/save';
import {assetUrl} from '../assets/catalog';
// Lazy views and device keys shared by App (ui/app) and its method files.
// Pages away from the voyage itself load on first use (kept out of the startup scripts): the
// teacher's pages, the book, achievements, the chronicle and the class gallery.
export const teacherViews = () =>
  Promise.all([import('./worksheet-view'), import('./report-view'), import('./progress-view'), classView()]);
// The class board (the fleet, the wooden horse, the live mission and the quiz report) loads with
// the sailors' page or the teacher's pages; the methods that use it run only from those pages.
export let classModule: typeof import('./class-view') | null = null;
export const classView = () => import('./class-view').then(m => (classModule = m));
// Two sailors' pages and their second HUD load on first use.
export let duoModule: typeof import('./duo-view') | null = null;
export const duoView = () => import('./duo-view').then(m => (duoModule = m));
export const pageViews = () =>
  Promise.all([import('./feats-view'), import('./chronicle-view'), import('./gallery-view')]);
// The book's read-only pages load on first use.
export const bookPages = () => import('./book-view');
// The share page (with its QR library) loads on first use.
export const shareView = () => import('./share-view');
// The settings page loads just after the home screen, while the device is idle (or on first use).
export let settingsModule: typeof import('./settings-view') | null = null;
export const settingsView = () => import('./settings-view').then(m => (settingsModule = m));
// The teacher's contest pages and the course maker load on first use.
export const contestView = () => import('./contest-view');
export const makerView = () => import('./maker-view');
// The device check page, the island readings and the word cards load on first use.
export const deviceCheck = () => import('./device-check');
export const readingView = () => import('./reading-view');
export const wordCards = () => import('./word-cards');
export const asset = assetUrl;
export const SLOW_KEY = SAVE_KEY + ':slow-device';
// The class's live mission belongs to the shared device (see class-view LiveMission).
export const LIVE_KEY = SAVE_KEY + ':live-mission';

// The course being built stays on this device between visits.
export const MAKER_KEY = SAVE_KEY + ':maker';
// How long each menu button stays highlighted while switch scanning (ms).
export const SCAN_STEP = 1600;
// Logical width of the portrait game strip (4:3): closer than the landscape 960 so the hero and
// hazards are drawn larger on a phone held upright, yet wide enough (it was 720) to see a little
// more of the course ahead.
export const PORTRAIT_VIEW = 800;
