import { NextRequest, NextResponse } from "next/server";
import { resolveCanonicalMemberName, updateStoredTimeEntry } from "@/lib/manualTimeEntriesStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type UpdateRequest = {
  member?: string;
  entryId?: number;
  description?: string | null;
  project?: string | null;
  startAt?: string;
  stopAt?: string;
  tzOffset?: number;
};

export async function POST(request: NextRequest) {
  let body: UpdateRequest;
  try {
    body = (await request.json()) as UpdateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const member = body.member?.trim() ?? "";
  if (!member) {
    return NextResponse.json({ error: "Missing member" }, { status: 400 });
  }
  const canonicalMember = await resolveCanonicalMemberName(member);
  if (!canonicalMember) {
    return NextResponse.json({ error: "Unknown member" }, { status: 404 });
  }

  const entryId = Number(body.entryId ?? 0);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return NextResponse.json({ error: "Invalid entryId" }, { status: 400 });
  }
  const startAt = body.startAt?.trim() ?? "";
  const stopAt = body.stopAt?.trim() ?? "";
  if (!startAt || !stopAt) {
    return NextResponse.json({ error: "Missing startAt/stopAt" }, { status: 400 });
  }

  try {
    const entry = await updateStoredTimeEntry({
      memberName: canonicalMember,
      entryId,
      description: body.description ?? null,
      projectName: body.project ?? null,
      startAtIso: startAt,
      stopAtIso: stopAt,
      tzOffsetMinutes: body.tzOffset,
    });
    return NextResponse.json({
      ok: true,
      entry,
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
