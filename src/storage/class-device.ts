import {SAVE_KEY} from './save';
import {PRESET_KEY, isPreset, type PresetId} from './lesson-preset';
// What the shared classroom device keeps for the whole class (not in any sailor's record): each
// sailor's team, the lesson preset and the class fleet's goal. Carried by the class backup.
export const TEAMS_KEY = SAVE_KEY + ':teams';
export const FLEET_KEY = SAVE_KEY + ':fleet-goal';
// Teams for the race: {sailor id: team}.
export const TEAMS = ['A', 'B', 'C', 'D'] as const;
export type Team = (typeof TEAMS)[number];
export function readTeams(raw: string | null): Record<string, Team> {
  try {
    const v = JSON.parse(raw ?? '{}');
    return Object.fromEntries(
      Object.entries(v && typeof v === 'object' && !Array.isArray(v) ? v : {}).filter(
        ([k, t]) => typeof k === 'string' && k.length <= 40 && TEAMS.includes(t as Team),
      ),
    ) as Record<string, Team>;
  } catch {
    return {};
  }
}
export const validFleetGoal = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 50 && n <= 100_000;
export interface ClassDevice {
  teams: Record<string, Team>;
  preset: PresetId | null;
  fleetGoal: number | null;
}
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const get = (s: Store, k: string) => {
  try {
    return s.getItem(k);
  } catch {
    return null;
  }
};
export function readClassDevice(storage: Store): ClassDevice {
  const goal = Number(get(storage, FLEET_KEY)),
    preset = get(storage, PRESET_KEY);
  return {
    teams: readTeams(get(storage, TEAMS_KEY)),
    preset: isPreset(preset) ? preset : null,
    fleetGoal: validFleetGoal(goal) ? goal : null,
  };
}
export function parseClassDevice(v: unknown): ClassDevice {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return {
    teams: readTeams(JSON.stringify(o.teams ?? {})),
    preset: isPreset(o.preset) ? o.preset : null,
    fleetGoal: validFleetGoal(o.fleetGoal) ? o.fleetGoal : null,
  };
}
// Restoring: teams already set on this device stay; the backup fills the rest (by the sailor ids
// they were restored under). A preset or fleet goal is only taken when this device has none.
export function restoreClassDevice(storage: Store, d: ClassDevice, ids: Record<string, string>) {
  const here = readClassDevice(storage),
    teams = {...here.teams};
  for (const [from, team] of Object.entries(d.teams)) {
    const id = ids[from];
    if (id && !teams[id]) teams[id] = team;
  }
  try {
    if (Object.keys(teams).length) storage.setItem(TEAMS_KEY, JSON.stringify(teams));
    if (!here.preset && d.preset) storage.setItem(PRESET_KEY, d.preset);
    if (!here.fleetGoal && d.fleetGoal) storage.setItem(FLEET_KEY, String(d.fleetGoal));
  } catch {}
}
