"use client";

export const DEFAULT_POMODORO_SECONDS = 25 * 60;
export const POMODORO_STORAGE_KEY = "voho_sidebar_pomodoro_v2";
export const LEGACY_POMODORO_STORAGE_KEY = "voho_sidebar_pomodoro_v1";
export const POMODORO_SYNC_EVENT = "voho-pomodoro-sync";

export type PomodoroState = {
  secondsLeft: number;
  running: boolean;
  completionsByDay: Record<string, number>;
  updatedAt: number;
};

function clampSeconds(value: number) {
  return Math.max(0, Math.min(DEFAULT_POMODORO_SECONDS, Math.floor(value)));
}

export function formatPomodoroTimer(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getPomodoroDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function emptyState(): PomodoroState {
  return {
    secondsLeft: DEFAULT_POMODORO_SECONDS,
    running: false,
    completionsByDay: {},
    updatedAt: Date.now(),
  };
}

function normalizeState(raw: unknown): PomodoroState {
  const value = (raw ?? {}) as Partial<PomodoroState>;
  const completions = value.completionsByDay && typeof value.completionsByDay === "object" ? value.completionsByDay : {};
  const cleanedCompletions: Record<string, number> = {};
  for (const [day, count] of Object.entries(completions)) {
    const safeCount = Number(count);
    if (Number.isFinite(safeCount) && safeCount > 0) cleanedCompletions[day] = Math.floor(safeCount);
  }
  return {
    secondsLeft: clampSeconds(Number(value.secondsLeft ?? DEFAULT_POMODORO_SECONDS)),
    running: Boolean(value.running),
    completionsByDay: cleanedCompletions,
    updatedAt: Number(value.updatedAt ?? Date.now()),
  };
}

export function readPomodoroState(): PomodoroState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(POMODORO_STORAGE_KEY);
    if (raw) {
      const parsed = normalizeState(JSON.parse(raw));
      if (parsed.running) {
        const elapsed = Math.max(0, Math.floor((Date.now() - parsed.updatedAt) / 1000));
        parsed.secondsLeft = Math.max(0, parsed.secondsLeft - elapsed);
        parsed.running = parsed.secondsLeft > 0;
      }
      parsed.updatedAt = Date.now();
      return parsed;
    }
  } catch {
    // fall back to legacy/default.
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_POMODORO_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as {
        secondsLeft?: number;
        running?: boolean;
        updatedAt?: number;
      };
      let secondsLeft = clampSeconds(Number(parsed.secondsLeft ?? DEFAULT_POMODORO_SECONDS));
      const running = Boolean(parsed.running);
      const updatedAt = Number(parsed.updatedAt ?? Date.now());
      if (running) {
        const elapsed = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
        secondsLeft = Math.max(0, secondsLeft - elapsed);
      }
      return {
        secondsLeft,
        running: running && secondsLeft > 0,
        completionsByDay: {},
        updatedAt: Date.now(),
      };
    }
  } catch {
    // fallback to default
  }

  return emptyState();
}

export function writePomodoroState(next: PomodoroState, source: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeState(next);
  normalized.updatedAt = Date.now();
  localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(
    new CustomEvent(POMODORO_SYNC_EVENT, {
      detail: {
        source,
        state: normalized,
      },
    })
  );
}

export function incrementPomodoroForToday(state: PomodoroState, at = new Date()): PomodoroState {
  const key = getPomodoroDayKey(at);
  return {
    ...state,
    completionsByDay: {
      ...state.completionsByDay,
      [key]: (state.completionsByDay[key] ?? 0) + 1,
    },
  };
}

