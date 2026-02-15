"use client";

import { useEffect, useMemo, useState } from "react";
import {
  completePomodoro,
  formatPomodoroTimer,
  getPomodoroDayKey,
  pausePomodoro,
  POMODORO_SYNC_EVENT,
  PomodoroState,
  readPomodoroState,
  resetPomodoro,
  startPomodoro,
  updatePomodoroSession,
  writePomodoroState,
} from "@/lib/pomodoroClient";

function formatDay(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map((value) => Number(value));
  const date = new Date(year, (month || 1) - 1, day || 1);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function PomodoroPageClient() {
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>({
    secondsLeft: 25 * 60,
    running: false,
    completionsByDay: {},
    sessions: [],
    activeSessionId: null,
    updatedAt: Date.now(),
  });

  useEffect(() => {
    const restored = readPomodoroState();
    setPomodoroState(restored);
    writePomodoroState(restored, "pomodoro-page");
  }, []);

  useEffect(() => {
    const syncListener = (event: Event) => {
      const custom = event as CustomEvent<{ source?: string; state?: PomodoroState }>;
      const incoming = custom.detail?.state;
      const source = custom.detail?.source ?? "";
      if (!incoming || source === "pomodoro-page") return;
      setPomodoroState(incoming);
    };
    window.addEventListener(POMODORO_SYNC_EVENT, syncListener as EventListener);
    return () => window.removeEventListener(POMODORO_SYNC_EVENT, syncListener as EventListener);
  }, []);

  const todayKey = getPomodoroDayKey();
  const completedToday = pomodoroState.completionsByDay[todayKey] ?? 0;

  const lastSevenDays = useMemo(() => {
    const rows: Array<{ key: string; count: number }> = [];
    const base = new Date();
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(base);
      date.setDate(base.getDate() - offset);
      const key = getPomodoroDayKey(date);
      rows.push({ key, count: pomodoroState.completionsByDay[key] ?? 0 });
    }
    return rows;
  }, [pomodoroState.completionsByDay]);

  const weekTotal = useMemo(() => lastSevenDays.reduce((sum, item) => sum + item.count, 0), [lastSevenDays]);
  const completedSessions = useMemo(
    () => pomodoroState.sessions.filter((session) => session.durationSeconds > 0),
    [pomodoroState.sessions]
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Pomodoro</h1>
      <p className="mt-1 text-sm text-slate-600">Run 25-minute focus sessions and track your daily count.</p>

      <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Focus Timer</p>
        <p className="mt-2 text-5xl font-semibold tabular-nums text-slate-900">{formatPomodoroTimer(pomodoroState.secondsLeft)}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setPomodoroState((prev) => {
                const next = prev.running ? pausePomodoro(prev) : startPomodoro(prev);
                writePomodoroState(next, "pomodoro-page");
                return next;
              })
            }
            className="rounded-lg bg-[#0BA5E9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0994cf]"
          >
            {pomodoroState.running ? "Pause" : pomodoroState.secondsLeft === 0 ? "Start next Pomodoro" : "Start Pomodoro"}
          </button>
          <button
            type="button"
            onClick={() =>
              setPomodoroState((prev) => {
                const next = completePomodoro(prev);
                writePomodoroState(next, "pomodoro-page");
                return next;
              })
            }
            className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
          >
            Complete now
          </button>
          <button
            type="button"
            onClick={() =>
              setPomodoroState((prev) => {
                const next = resetPomodoro(prev);
                writePomodoroState(next, "pomodoro-page");
                return next;
              })
            }
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Completed Today</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{completedToday}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Last 7 Days</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{weekTotal}</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Day</th>
              <th className="px-4 py-2">Completed Pomodoros</th>
            </tr>
          </thead>
          <tbody>
            {lastSevenDays.map((item) => (
              <tr key={item.key} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-900">{formatDay(item.key)}</td>
                <td className="px-4 py-2 text-slate-700">{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Ended</th>
              <th className="px-4 py-2">Focus</th>
              <th className="px-4 py-2">What was done</th>
              <th className="px-4 py-2">Interruptions</th>
            </tr>
          </thead>
          <tbody>
            {completedSessions.length === 0 && (
              <tr className="border-t border-slate-100">
                <td colSpan={4} className="px-4 py-3 text-slate-500">
                  No completed pomodoros yet.
                </td>
              </tr>
            )}
            {completedSessions.map((session) => (
              <tr key={session.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-700">
                  {new Date(session.endedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={session.focus}
                    onChange={(event) =>
                      setPomodoroState((prev) => {
                        const next = updatePomodoroSession(prev, session.id, { focus: event.target.value });
                        writePomodoroState(next, "pomodoro-page");
                        return next;
                      })
                    }
                    placeholder="Focus area"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-slate-800"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={session.done}
                    onChange={(event) =>
                      setPomodoroState((prev) => {
                        const next = updatePomodoroSession(prev, session.id, { done: event.target.value });
                        writePomodoroState(next, "pomodoro-page");
                        return next;
                      })
                    }
                    placeholder="What did you complete?"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-slate-800"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    value={session.interruptions}
                    onChange={(event) =>
                      setPomodoroState((prev) => {
                        const next = updatePomodoroSession(prev, session.id, {
                          interruptions: Number(event.target.value || 0),
                        });
                        writePomodoroState(next, "pomodoro-page");
                        return next;
                      })
                    }
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-slate-800"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
