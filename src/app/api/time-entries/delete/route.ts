import { NextRequest, NextResponse } from "next/server";
import { deleteStoredTimeEntry, resolveCanonicalMemberName } from "@/lib/manualTimeEntriesStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DeleteRequest = {
  member?: string;
  entryId?: number;
};

export async function POST(request: NextRequest) {
  let body: DeleteRequest;
  try {
    body = (await request.json()) as DeleteRequest;
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

  try {
    const result = await deleteStoredTimeEntry({
      memberName: canonicalMember,
      entryId,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
