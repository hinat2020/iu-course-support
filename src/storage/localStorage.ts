import { createInitialState, type AppState } from "../state/initialState";
import { migrateState } from "./migrations";

export const STORAGE_KEY = "iu-course-support:v1";

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable or full. In-memory state remains usable.
  }
}

export function loadState(): AppState {
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    return raw === null || raw === undefined
      ? createInitialState()
      : migrateState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

export function clearState(): void {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Clearing storage must never prevent the app from resetting in memory.
  }
}
