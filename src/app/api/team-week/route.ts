import { NextRequest, NextResponse } from "next/server";
import { fetchTimeEntries, getTeamMembers, getTokenForMember } from "@/lib/toggl";
import { getCacheSnapshot, setCacheSnapshot } from "@/lib/cacheStore";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_TTL_MS = 30 * 60 * 1000;

type DaySummary = {
  date: string;
  seconds: number;
  entryCount: number;
};

type MemberWeekPayload = {
  name: string;
  totalSeconds: number;
  entryCount: number;
  days: DaySummary[];
};

type CacheEntry = {
  startDate: string;
  endDate: string;
  weekDates: string[];
  members: MemberWeekPayload[];
  cachedAt: string;
  quotaRemaining?: string | null;
  quotaResetsIn?: string | null;
};

function getEntrySeconds(entry: Awaited<ReturnType<typeof fetchTimeEntries>>[number]) {
  if (entry.duration >= 0) return entry.duration;
  const startedAt = new Date(entry.start).getTime();
  if (Number.isNaN(startedAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function getLastSevenDates(endDate: string) {
  const end = new Date(`${endDate}T00:00:00Z`);
  const dates: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const forceRefresh = searchParams.get("refresh") === "1";

  const endDate = dateParam ?? new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(endDate)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const weekDates = getLastSevenDates(endDate);
  const startDate = weekDates[0];
  const cacheKey = `team-week::${startDate}::${endDate}`;
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
      warning: "Showing last cached 7-day snapshot. Click Refresh view to fetch newer data.",
    });
  }
  if (!forceRefresh && !cachedAny) {
    return NextResponse.json({
      startDate,
      endDate,
      weekDates,
      members: members.map((member) => ({
        name: member.name,
        totalSeconds: 0,
        entryCount: 0,
        days: weekDates.map((date) => ({ date, seconds: 0, entryCount: 0 })),
      })),
      cachedAt: new Date().toISOString(),
      stale: true,
      warning: "No cached 7-day snapshot yet. Click Refresh view to load data.",
    });
  }

  try {
    const results = await Promise.all(
      members.map(async (member) => {
        const token = getTokenForMember(member.name);
        const emptyDays = weekDates.map((date) => ({ date, seconds: 0, entryCount: 0 }));
        if (!token) {
          return { name: member.name, totalSeconds: 0, entryCount: 0, days: emptyDays };
        }

        const entries = await fetchTimeEntries(token, `${startDate}T00:00:00Z`, `${endDate}T23:59:59Z`);
        const dayMap = new Map<string, DaySummary>(
          weekDates.map((date) => [date, { date, seconds: 0, entryCount: 0 }])
        );

        for (const entry of entries) {
          const day = entry.start.slice(0, 10);
          const bucket = dayMap.get(day);
          if (!bucket) continue;
          bucket.seconds += getEntrySeconds(entry);
          bucket.entryCount += 1;
        }

        const days = weekDates.map((date) => dayMap.get(date) ?? { date, seconds: 0, entryCount: 0 });
        const totalSeconds = days.reduce((acc, day) => acc + day.seconds, 0);
        const entryCount = days.reduce((acc, day) => acc + day.entryCount, 0);
        return { name: member.name, totalSeconds, entryCount, days };
      })
    );

    const sorted = [...results].sort((a, b) => {
      if (b.totalSeconds !== a.totalSeconds) return b.totalSeconds - a.totalSeconds;
      if (b.entryCount !== a.entryCount) return b.entryCount - a.entryCount;
      return a.name.localeCompare(b.name);
    });

    const payload: CacheEntry = {
      startDate,
      endDate,
      weekDates,
      members: sorted,
      cachedAt: new Date().toISOString(),
    };
    await setCacheSnapshot(cacheKey, payload, CACHE_TTL_MS);
    return NextResponse.json({ ...payload, stale: false, warning: null });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 502;
    const quotaRemaining = (error as Error & { quotaRemaining?: string | null }).quotaRemaining ?? null;
    const quotaResetsIn = (error as Error & { quotaResetsIn?: string | null }).quotaResetsIn ?? null;

    if ((status === 402 || status === 429) && cachedAny) {
      return NextResponse.json({
        ...cachedAny,
        stale: true,
        warning: "Quota/rate limit reached. Showing last cached 7-day snapshot.",
        quotaRemaining,
        quotaResetsIn,
      });
    }

    if (cachedAny) {
      return NextResponse.json({
        ...cachedAny,
        stale: true,
        warning: "Toggl unavailable. Showing last cached 7-day snapshot.",
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 502 });
  }
}
