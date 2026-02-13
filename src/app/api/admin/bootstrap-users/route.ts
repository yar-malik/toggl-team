import { NextRequest, NextResponse } from "next/server";
import { upsertMemberProfile } from "@/lib/manualTimeEntriesStore";
import { upsertAuthUser } from "@/lib/supabaseAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BootstrapUser = {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
};

type BootstrapBody = {
  users?: BootstrapUser[];
};

function getBootstrapSecret() {
  return process.env.BOOTSTRAP_ADMIN_SECRET?.trim() ?? "";
}

export async function POST(request: NextRequest) {
  const expectedSecret = getBootstrapSecret();
  const providedSecret = request.headers.get("x-bootstrap-secret")?.trim() ?? "";
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized bootstrap request" }, { status: 401 });
  }

  let body: BootstrapBody;
  try {
    body = (await request.json()) as BootstrapBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const users = Array.isArray(body.users) ? body.users : [];
  if (users.length === 0) {
    return NextResponse.json({ error: "users array is required" }, { status: 400 });
  }

  const results: Array<{ email: string; name: string; auth: string; role: string }> = [];
  const errors: Array<{ email: string; error: string }> = [];

  for (const item of users) {
    const name = item.name?.trim() ?? "";
    const email = item.email?.trim() ?? "";
    const password = item.password ?? "";
    const role = item.role?.trim() || "member";
    if (!name || !email || !password) {
      errors.push({ email: email || "(missing)", error: "name, email and password are required" });
      continue;
    }

    try {
      const auth = await upsertAuthUser({ email, password });
      await upsertMemberProfile({ name, email, role });
      results.push({ email, name, auth: auth.action, role });
    } catch (error) {
      errors.push({ email, error: error instanceof Error ? error.message : "Unknown bootstrap error" });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    createdOrUpdated: results,
    errors,
  });
}

