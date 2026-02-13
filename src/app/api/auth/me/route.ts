import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserFromAccessToken } from "@/lib/supabaseAuth";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("voho_access_token")?.value ?? "";
  if (!accessToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await getUserFromAccessToken(accessToken);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  });
}

