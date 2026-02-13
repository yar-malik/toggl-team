import { NextRequest, NextResponse } from "next/server";
import { createMember, listMemberProfiles, upsertMemberProfile } from "@/lib/manualTimeEntriesStore";
import { createAuthUser } from "@/lib/supabaseAuth";
import { requireAdminOrThrow } from "@/lib/authorization";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CreateMemberBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
};

export async function GET() {
  try {
    const members = await listMemberProfiles();
    return NextResponse.json({
      members,
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
  const email = body.email?.trim() || null;
  const password = body.password?.trim() || null;
  const role = body.role?.trim() || "member";

  try {
    await requireAdminOrThrow();
    await createMember(name);
    if (email && password) {
      await createAuthUser({ email, password });
    }
    const created = await upsertMemberProfile({ name, email, role });
    return NextResponse.json({
      ok: true,
      member: {
        name: created.member_name,
        email: created.email,
        role: created.role,
      },
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
