import { NextRequest, NextResponse } from "next/server";
import {
  autoStopLongRunningTimers,
  backdateRunningEntry,
  getRunningEntry,
  isMaxTimeEntryError,
  resolveCanonicalMemberName,
  updateRunningEntryMetadata,
} from "@/lib/manualTimeEntriesStore";
import { readIdempotentResponse, writeIdempotentResponse } from "@/lib/idempotency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const member = searchParams.get("member")?.trim();
  if (!member) {
    return NextResponse.json({ error: "Missing member" }, { status: 400 });
  }

  const canonicalMember = await resolveCanonicalMemberName(member);
  if (!canonicalMember) {
    return NextResponse.json({ error: "Unknown member" }, { status: 404 });
  }

  try {
    const autoStoppedCount = await autoStopLongRunningTimers([canonicalMember], Number(searchParams.get("tzOffset")));
    const entry = await getRunningEntry(canonicalMember);
    return NextResponse.json({
      member: canonicalMember,
      current: entry,
      cachedAt: new Date().toISOString(),
      warning:
        autoStoppedCount > 0
          ? `${autoStoppedCount} running time entr${autoStoppedCount === 1 ? "y was" : "ies were"} auto-stopped at 2 hours.`
          : null,
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read running timer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type UpdateCurrentBody = {
  member?: string;
  description?: string | null;
  project?: string | null;
  elapsedSeconds?: number;
  tzOffset?: number;
};

export async function PATCH(request: NextRequest) {
  const idempotencyKey = request.headers.get("x-idempotency-key");
  let body: UpdateCurrentBody;
  try {
    body = (await request.json()) as UpdateCurrentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const member = body.member?.trim();
  if (!member) {
    return NextResponse.json({ error: "Missing member" }, { status: 400 });
  }

  const cached = await readIdempotentResponse({
    scope: "time-entries-current-patch",
    member,
    idempotencyKey,
  });
  if (cached) {
    return NextResponse.json(cached.body, { status: cached.status });
  }

  const canonicalMember = await resolveCanonicalMemberName(member);
  if (!canonicalMember) {
    return NextResponse.json({ error: "Unknown member" }, { status: 404 });
  }

  try {
    await autoStopLongRunningTimers([canonicalMember], body.tzOffset);
    const elapsedSeconds = Number(body.elapsedSeconds);
    const updated =
      Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0
        ? await backdateRunningEntry({
            memberName: canonicalMember,
            elapsedSeconds,
            description: body.description ?? null,
            projectName: body.project ?? null,
            tzOffsetMinutes: body.tzOffset,
          })
        : await updateRunningEntryMetadata({
            memberName: canonicalMember,
            description: body.description ?? null,
            projectName: body.project ?? null,
          });
    const responseBody = {
      ok: true,
      member: canonicalMember,
      current: updated,
      cachedAt: new Date().toISOString(),
      source: "db",
    };
    await writeIdempotentResponse({
      scope: "time-entries-current-patch",
      member: canonicalMember,
      idempotencyKey,
      status: 200,
      body: responseBody,
      ttlSeconds: 180,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update running timer";
    const responseBody = { error: message };
    const status = isMaxTimeEntryError(message) ? 400 : 500;
    await writeIdempotentResponse({
      scope: "time-entries-current-patch",
      member: canonicalMember,
      idempotencyKey,
      status,
      body: responseBody,
      ttlSeconds: 60,
    });
    return NextResponse.json(responseBody, { status });
  }
}
