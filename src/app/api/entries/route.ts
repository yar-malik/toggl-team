import { NextRequest, NextResponse } from "next/server";
import { fetchCurrentEntry, fetchTimeEntries, getTokenForMember } from "@/lib/toggl";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_TTL_MS = 30 * 1000;

type CacheEntry = {
  expiresAt: number;
  payload: {
    entries: Awaited<ReturnType<typeof fetchTimeEntries>>;
    current: Awaited<ReturnType<typeof fetchCurrentEntry>>;
    totalSeconds: number;
    date: string;
  };
};

const responseCache = new Map<string, CacheEntry>();

function getCached(key: string) {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return cached.payload;
}

function setCached(key: string, payload: CacheEntry["payload"]) {
  responseCache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const member = searchParams.get("member");
  const dateParam = searchParams.get("date");

  if (!member) {
    return NextResponse.json({ error: "Missing member" }, { status: 400 });
  }

  const token = getTokenForMember(member);
  if (!token) {
    return NextResponse.json({ error: "Unknown member" }, { status: 404 });
  }

  const dateInput = dateParam ?? new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(dateInput)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const startDate = `${dateInput}T00:00:00Z`;
  const endDate = `${dateInput}T23:59:59Z`;
  const cacheKey = `${member.toLowerCase()}::${dateInput}`;

  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const [entries, current] = await Promise.all([
      fetchTimeEntries(token, startDate, endDate),
      fetchCurrentEntry(token),
    ]);

    const totalSeconds = entries.reduce((acc, entry) => {
      if (entry.duration >= 0) return acc + entry.duration;
      const startedAt = new Date(entry.start).getTime();
      if (Number.isNaN(startedAt)) return acc;
      const runningSeconds = Math.floor((Date.now() - startedAt) / 1000);
      return acc + runningSeconds;
    }, 0);

    const payload = { entries, current, totalSeconds, date: dateInput };
    setCached(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = (error as Error & { status?: number }).status ?? 502;
    const retryAfter = (error as Error & { retryAfter?: string | null }).retryAfter ?? null;

    if (status === 429) {
      return NextResponse.json(
        { error: "Rate limited by Toggl. Please retry shortly.", retryAfter },
        { status: 429, headers: retryAfter ? { "Retry-After": retryAfter } : undefined }
      );
    }

    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 502 });
  }
}
