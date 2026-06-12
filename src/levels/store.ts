import { BUILTIN_LEVELS } from './builtin';
import type { LevelData } from './types';

export interface PlaylistEntry {
  id: string;
  included: boolean;
}

const CUSTOM_KEY = 'etc-custom-levels-v1';
const PLAYLIST_KEY = 'etc-playlist-v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode etc.) - keep running with in-memory state.
  }
}

export class LevelStore {
  static getCustomLevels(): LevelData[] {
    const levels = readJson<LevelData[]>(CUSTOM_KEY, []);
    return Array.isArray(levels) ? levels.filter((level) => Boolean(level && level.id)) : [];
  }

  static getAllLevels(): LevelData[] {
    return [...BUILTIN_LEVELS, ...LevelStore.getCustomLevels()];
  }

  static getLevelById(id: string): LevelData | null {
    return LevelStore.getAllLevels().find((level) => level.id === id) ?? null;
  }

  static saveCustomLevel(level: LevelData): void {
    const levels = LevelStore.getCustomLevels();
    const index = levels.findIndex((existing) => existing.id === level.id);
    if (index >= 0) {
      levels[index] = level;
    } else {
      levels.push(level);
    }
    writeJson(CUSTOM_KEY, levels);
    // Make sure the playlist knows about it.
    LevelStore.getPlaylist();
  }

  static deleteCustomLevel(id: string): void {
    writeJson(CUSTOM_KEY, LevelStore.getCustomLevels().filter((level) => level.id !== id));
    writeJson(PLAYLIST_KEY, LevelStore.getPlaylist().filter((entry) => entry.id !== id));
  }

  /** Normalized playlist: covers every known level exactly once, keeps saved order. */
  static getPlaylist(): PlaylistEntry[] {
    const known = LevelStore.getAllLevels();
    const knownIds = new Set(known.map((level) => level.id));
    const saved = readJson<PlaylistEntry[]>(PLAYLIST_KEY, []);
    const result: PlaylistEntry[] = [];
    const seen = new Set<string>();

    for (const entry of saved) {
      if (!entry || !knownIds.has(entry.id) || seen.has(entry.id)) {
        continue;
      }
      seen.add(entry.id);
      result.push({ id: entry.id, included: Boolean(entry.included) });
    }

    for (const level of known) {
      if (!seen.has(level.id)) {
        seen.add(level.id);
        result.push({ id: level.id, included: true });
      }
    }

    writeJson(PLAYLIST_KEY, result);
    return result;
  }

  static setPlaylist(entries: PlaylistEntry[]): void {
    writeJson(PLAYLIST_KEY, entries);
  }

  static toggleIncluded(id: string): void {
    const playlist = LevelStore.getPlaylist();
    const entry = playlist.find((item) => item.id === id);
    if (entry) {
      entry.included = !entry.included;
      LevelStore.setPlaylist(playlist);
    }
  }

  static moveEntry(id: string, direction: -1 | 1): void {
    const playlist = LevelStore.getPlaylist();
    const index = playlist.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= playlist.length) {
      return;
    }
    [playlist[index], playlist[target]] = [playlist[target], playlist[index]];
    LevelStore.setPlaylist(playlist);
  }

  /** The levels the run actually plays, in order. */
  static getActiveLevels(): LevelData[] {
    const byId = new Map(LevelStore.getAllLevels().map((level) => [level.id, level]));
    return LevelStore.getPlaylist()
      .filter((entry) => entry.included)
      .map((entry) => byId.get(entry.id))
      .filter((level): level is LevelData => Boolean(level));
  }

  static nextCustomName(): string {
    const count = LevelStore.getCustomLevels().length;
    return `My Level ${count + 1}`;
  }

  static newCustomId(): string {
    return `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}
