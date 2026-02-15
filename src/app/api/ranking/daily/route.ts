import { NextRequest, NextResponse } from "next/server";
import { canonicalizeMemberName } from "@/lib/memberNames";
import { listMemberProfiles } from "@/lib/manualTimeEntriesStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders() {
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey: token,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

type Row = {
  member_name: string;
  total_seconds: number | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim() ?? new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const members = await listMemberProfiles();
  const memberNames = members.map((item) => canonicalizeMemberName(item.name)).filter(Boolean);
  if (memberNames.length === 0) {
    return NextResponse.json({
      date,
      members: [],
      source: "db",
      warning: "No members configured.",
    });
  }

  const memberFilter = `in.(${memberNames
    .map((name) => `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",")})`;
  const url =
    `${process.env.SUPABASE_URL}/rest/v1/daily_member_stats` +
    `?select=member_name,total_seconds` +
    `&member_name=${encodeURIComponent(memberFilter)}` +
    `&stat_date=eq.${encodeURIComponent(date)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: supabaseHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to load daily ranking." }, { status: 500 });
    }
    const rows = (await response.json()) as Row[];
    const byMember = new Map<string, number>();
    for (const row of rows) {
      byMember.set(canonicalizeMemberName(row.member_name), Math.max(0, Number(row.total_seconds ?? 0)));
    }

    const result = memberNames.map((name) => ({
      name,
      seconds: byMember.get(name) ?? 0,
    }));

    return NextResponse.json({
      date,
      members: result,
      source: "db",
      warning: null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load daily ranking." }, { status: 500 });
  }
}

