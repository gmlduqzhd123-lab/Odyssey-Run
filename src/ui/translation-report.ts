import {getLang, translate} from '../i18n';
import {SAVE_KEY} from '../storage/save';
// Translation notes from classrooms that use another language: with the note mode on (settings),
// tapping any text asks what is wrong with it; the notes stay on this device until the teacher
// exports them as a file to send on. Korean, the source language, has no note mode.
export const REPORT_KEY = SAVE_KEY + ':translation-notes';
export const MAX_NOTES = 100;
export interface Note {
  lang: string;
  text: string;
  note: string;
  screen: string;
  at: string;
}
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
export function readNotes(storage: Store): Note[] {
  try {
    const v = JSON.parse(storage?.getItem(REPORT_KEY) ?? '[]');
    return Array.isArray(v)
      ? v
          .filter(n => n && typeof n.text === 'string' && typeof n.note === 'string' && typeof n.lang === 'string')
          .slice(-MAX_NOTES)
          .map(n => ({
            lang: n.lang.slice(0, 5),
            text: n.text.slice(0, 300),
            note: n.note.slice(0, 300),
            screen: String(n.screen ?? '').slice(0, 30),
            at: String(n.at ?? '').slice(0, 25),
          }))
      : [];
  } catch {
    return [];
  }
}
export function addNote(storage: Store, n: Omit<Note, 'at'>) {
  const list = [...readNotes(storage), {...n, at: new Date().toISOString()}].slice(-MAX_NOTES);
  try {
    storage?.setItem(REPORT_KEY, JSON.stringify(list));
  } catch {}
  return list.length;
}
export const clearNotes = (storage: Store) => {
  try {
    storage?.removeItem(REPORT_KEY);
  } catch {}
};
// The text a tap points at: the nearest element with its own words (not the whole page).
export function tappedText(target: Element | null) {
  let el: Element | null = target;
  while (el && el !== document.body) {
    const own = [...el.childNodes]
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent ?? '')
      .join(' ')
      .trim();
    if (own) return own.replace(/\s+/g, ' ');
    el = el.parentElement;
  }
  return '';
}
export const noteModeAvailable = () => getLang() !== 'ko';
export const noteBanner = () =>
  `<div class="note-banner" role="status"><span>${translate('번역 신고 모드 · 이상한 글자를 눌러 주세요')}</span><button type="button" data-note-off>${translate('끄기')}</button></div>`;
