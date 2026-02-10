import { NextRequest, NextResponse } from "next/server";
import {
  fetchProjectNames,
  fetchTimeEntries,
  getEntryProjectName,
  getTeamMembers,
  getTokenForMember,
  sortEntriesByStart,
} from "@/lib/toggl";
import { getCacheSnapshot, setCacheSnapshot } from "@/lib/cacheStore";
import { persistHistoricalError, persistHistoricalSnapshot } from "@/lib/historyStore";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_TTL_MS = 10 * 60 * 1000;

type MemberPayload = {
  name: string;
  entries: Array<Awaited<ReturnType<typeof fetchTimeEntries>>[number] & { project_name?: string | null }>;
  current: null;
  totalSeconds: number;
};

type CacheEntry = {
  date: string;
  members: MemberPayload[];
  cachedAt: string;
  quotaRemaining?: string | null;
  quotaResetsIn?: string | null;
};

function parseTzOffsetMinutes(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-720, Math.min(840, Math.trunc(parsed)));
}

function buildUtcDayRange(dateInput: string, tzOffsetMinutes: number) {
  const [yearStr, monthStr, dayStr] = dateInput.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  const startMs = Date.UTC(year, month, day, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000;
  const endMs = Date.UTC(year, month, day, 23, 59, 59, 999) + tzOffsetMinutes * 60 * 1000;
  return { startDate: new Date(startMs).toISOString(), endDate: new Date(endMs).toISOString() };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const forceRefresh = searchParams.get("refresh") === "1";
  const tzOffsetMinutes = parseTzOffsetMinutes(searchParams.get("tzOffset"));

  const dateInput = dateParam ?? new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(dateInput)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const cacheKey = `team::${dateInput}`;
  const cachedFresh = await getCacheSnapshot<CacheEntry>(cacheKey, false);
  const cachedAny = await getCacheSnapshot<CacheEntry>(cacheKey, true);
  const members = getTeamMembers();
  if (members.length === 0) {
    return NextResponse.json({ error: "No members configured" }, { status: 400 });
  }
  if (!forceRefresh && cachedFresh) {
    return NextResponse.json({ ...cachedFresh, stale: false, warning: null });
  }
  if (!forceRefresh && cachedAny) {
    return NextResponse.json({
      ...cachedAny,
      stale: true,
      warning: "Showing last cached snapshot. Click Refresh view to fetch newer data.",
    });
  }
  if (!forceRefresh && !cachedAny) {
    return NextResponse.json({
      date: dateInput,
      members: members.map((member) => ({ name: member.name, entries: [], current: null, totalSeconds: 0 })),
      cachedAt: new Date().toISOString(),
      stale: true,
      warning: "No cached snapshot yet. Click Refresh view to load data.",
    });
  }

  const { startDate, endDate } = buildUtcDayRange(dateInput, tzOffsetMinutes);

  try {
    const results = await Promise.all(
      members.map(async (member) => {
        const token = getTokenForMember(member.name);
        if (!token) {
          return { name: member.name, entries: [], current: null, totalSeconds: 0 };
        }

        const entries = await fetchTimeEntries(token, startDate, endDate);
        const projectNames = await fetchProjectNames(token, entries);
        const sortedEntries = sortEntriesByStart(entries).map((entry) => ({
          ...entry,
          project_name: getEntryProjectName(entry, projectNames),
        }));

        const totalSeconds = sortedEntries.reduce((acc, entry) => {
          if (entry.duration >= 0) return acc + entry.duration;
          const startedAt = new Date(entry.start).getTime();
          if (Number.isNaN(startedAt)) return acc;
          const runningSeconds = Math.floor((Date.now() - startedAt) / 1000);
          return acc + runningSeconds;
        }, 0);

        await persistHistoricalSnapshot("team", member.name, dateInput, sortedEntries);
        return { name: member.name, entries: sortedEntries, current: null, totalSeconds };
      })
    );

    const payload: CacheEntry = { date: dateInput, members: results, cachedAt: new Date().toISOString() };
    await setCacheSnapshot(cacheKey, payload, CACHE_TTL_MS);
    return NextResponse.json({ ...payload, stale: false, warning: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = (error as Error & { status?: number }).status ?? 502;
    const retryAfter = (error as Error & { retryAfter?: string | null }).retryAfter ?? null;
    const quotaRemaining = (error as Error & { quotaRemaining?: string | null }).quotaRemaining ?? null;
    const quotaResetsIn = (error as Error & { quotaResetsIn?: string | null }).quotaResetsIn ?? null;

    if (status === 402) {
      if (cachedAny) {
        return NextResponse.json({
          ...cachedAny,
          stale: true,
          warning: "Quota reached. Showing last cached snapshot. Try refresh again after reset.",
          quotaRemaining,
          quotaResetsIn,
        });
      }
      return NextResponse.json(
        {
          error: "Toggl API quota reached. Please wait for reset before retrying.",
          quotaRemaining,
          quotaResetsIn,
        },
        { status: 402, headers: quotaResetsIn ? { "X-Toggl-Quota-Resets-In": quotaResetsIn } : undefined }
      );
    }

    if (status === 429) {
      if (cachedAny) {
        return NextResponse.json({
          ...cachedAny,
          stale: true,
          warning: "Rate limited. Showing last cached snapshot.",
          quotaRemaining,
          quotaResetsIn,
        });
      }
      return NextResponse.json(
        { error: "Rate limited by Toggl. Please retry shortly.", retryAfter, quotaRemaining, quotaResetsIn },
        { status: 429, headers: retryAfter ? { "Retry-After": retryAfter } : undefined }
      );
    }

    if (cachedAny) {
      await persistHistoricalError("team", null, dateInput, message);
      return NextResponse.json({
        ...cachedAny,
        stale: true,
        warning: "Toggl is unavailable. Showing last cached snapshot.",
      });
    }

    await persistHistoricalError("team", null, dateInput, message);
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 502 });
  }
}
