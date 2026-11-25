import type {LiveMission} from './class-view';
import {type ContestLink, type ContestResult, type Link, type RivalLink, type CourseLink} from '../systems/share';
import {type StageId} from '../levels/courses';
import {type VariantId} from '../levels/course-ids';
import {type DuoCourse} from './duo-view';
import type {MakerDraft} from './maker-view';
import {teacherViews, bookPages} from './app-shared';
// The shapes of the App methods kept in the app-*.ts files (App merges these interfaces).
export interface SpecialMethods {
  takeLink(): string;
  openPendingLink(): void;
  openLink(link: Link): void;
  contestRules(c: {stage: StageId | null; variant: VariantId | null; assist: boolean; blocks?: string}): string;
  contestJoin(link: ContestLink): void;
  contestRun(): Promise<void>;
  loadDraft(): MakerDraft;
  readDraft(): MakerDraft;
  maker(message?: string): void;
  makerCheck(): {ok: boolean; text: string};
  makerAction(kind: string): void;
  makerRun(): Promise<void>;
  makerReceived(link: CourseLink): void;
  duoPage(message?: string): void;
  duoCourseList(): DuoCourse[];
  duoRun(): Promise<void>;
  secondHero(): 'odysseus' | 'penelope' | 'telemachus' | 'athena';
  finishDuo(): void;
  galleryPage(message?: string): void;
  galleryAction(kind: string, arg?: string): void;
  prologueRun(): Promise<void>;
  finishCustom(): void;
  endlessCards(): string;
  prepareEndless(id: StageId): Promise<void>;
  prepareShuffle(id: StageId): Promise<void>;
  finishShuffle(): void;
  finishEndless(): void;
  finishContest(): void;
  contestCollect(result: ContestResult): void;
  contestsPage(message?: string): void;
  contestBoard(id: string, message?: string): void;
  stopScanner(): void;
  contestCsv(id: string): void;
  contestAction(kind: string, id?: string): void;
  courseName(stage: StageId, variant: VariantId): string;
  rivalPage(link: RivalLink): void;
  rivalStart(): Promise<void>;
  ghostNow(): {x: number; friend: boolean} | null;
  rivalFor(stage: StageId, variant: VariantId): RivalLink | null;
  sharePage(): void;
  shareImage(): Promise<void> | undefined;
  challenges(): void;
  prepareBoss(id: StageId): Promise<void>;
  dailyCard(): string;
  prepareDaily(): Promise<void>;
  finishSpecial(): void;
  damageSummary(): string;
}
export interface LearningMethods {
  bookPage(show: (pages: Awaited<ReturnType<typeof bookPages>>) => void): Promise<void>;
  codex(): void;
  landscapes(): void;
  sheet(id: string): void;
  people(): void;
  person(id: string): void;
  relics(): void;
  bestiary(): void;
  journal(): void;
  harbor(): void;
  discovery(id: string): void;
  blessingAllowed(): boolean;
  presetMarkup(): string;
  notesMarkup(): string;
  setNoteMode(on: boolean): void;
  noteTap(e: MouseEvent): void;
  deviceCheckPage(): void;
  runChecks(arg: string): Promise<void>;
  reading(id: string): void;
  readingCheck(id: string): Promise<void>;
  turnCard(i: number): Promise<void>;
  quiz(): void;
  quizAnswer(choice: number): void;
  quit(): void;
  chronicle(): void;
  scene(arg: string): void;
  poster(): Promise<void>;
  story(index: number): void;
  weekly(name: string): boolean;
  sheetZoom(): void;
}
export interface ClassroomMethods {
  profilesPage(message?: string): void;
  teacherPage(show: (views: Awaited<ReturnType<typeof teacherViews>>) => void): Promise<void>;
  live(): LiveMission | null;
  liveDevices(): {stars: number; sailors: number};
  classStars(
    board?: {
      total: number;
      islands: number;
      maps: number;
      quiz: number;
      stars: number;
      week: string;
      weekRuns: number;
      weekStars: number;
      id: string;
      name: string;
    }[],
  ): number;
  teams(): Record<string, 'A' | 'B' | 'C' | 'D'>;
  liveTeams(
    board?: {
      total: number;
      islands: number;
      maps: number;
      quiz: number;
      stars: number;
      week: string;
      weekRuns: number;
      weekStars: number;
      id: string;
      name: string;
    }[],
  ): {
    sailors: {id: string; name: string}[];
    teams: Record<string, 'A' | 'B' | 'C' | 'D'>;
    now: Partial<Record<'A' | 'B' | 'C' | 'D', number>>;
  };
  liveStart(): void;
  fleetGoal(sailors: number): number;
  fleet(stars: number, sailors: number): string;
  setFleetGoal(): void;
  switchProfile(id: string, message: string): void;
  profileAction(kind: string, id?: string): void;
  protect(): void;
  protectionLine(): string;
  readClassFile(input: HTMLInputElement, file: File): Promise<void>;
  readSaveFile(input: HTMLInputElement, file: File): Promise<void>;
  classPreview(): void;
  classRestore(): void;
  importPreview(): void;
  classExport(): void;
  askProtection(): void;
  importConfirm(): void;
}
export interface HudMethods {
  hud(): string;
  canvasNotes(): void;
  setText(selector: string, text: string): void;
  updateHud(): void;
}
