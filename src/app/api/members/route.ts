import { NextRequest, NextResponse } from "next/server";
import { createMember, listMembers } from "@/lib/manualTimeEntriesStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CreateMemberBody = {
  name?: string;
};

export async function GET() {
  try {
    const members = await listMembers();
    return NextResponse.json({
      members: members.map((name) => ({ name })),
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: CreateMemberBody;
  try {
    body = (await request.json()) as CreateMemberBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Member name is required" }, { status: 400 });
  }

  try {
    const created = await createMember(name);
    return NextResponse.json({
      ok: true,
      member: { name: created },
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

