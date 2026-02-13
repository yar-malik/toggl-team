import { NextRequest, NextResponse } from "next/server";
import { getRunningEntry, resolveCanonicalMemberName } from "@/lib/manualTimeEntriesStore";

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
    const entry = await getRunningEntry(canonicalMember);
    return NextResponse.json({
      member: canonicalMember,
      current: entry,
      cachedAt: new Date().toISOString(),
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read running timer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
