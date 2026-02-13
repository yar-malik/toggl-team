import { NextRequest, NextResponse } from "next/server";
import { listMemberKpis, resolveCanonicalMemberName, upsertMemberKpi } from "@/lib/manualTimeEntriesStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type UpsertKpiBody = {
  member?: string;
  label?: string;
  value?: string;
  notes?: string | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const memberRaw = searchParams.get("member")?.trim() ?? "";

  try {
    const canonical = memberRaw ? await resolveCanonicalMemberName(memberRaw) : null;
    const kpis = await listMemberKpis(canonical ?? (memberRaw || null));
    const resolvedMember = canonical ?? (memberRaw || null);
    return NextResponse.json({
      member: resolvedMember,
      kpis: kpis.map((item) => ({
        id: item.id,
        member: item.member_name,
        label: item.kpi_label,
        value: item.kpi_value,
        notes: item.notes,
        updatedAt: item.updated_at,
      })),
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load KPIs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: UpsertKpiBody;
  try {
    body = (await request.json()) as UpsertKpiBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const memberRaw = body.member?.trim() ?? "";
  const label = body.label?.trim() ?? "";
  const value = body.value?.trim() ?? "";
  if (!memberRaw) return NextResponse.json({ error: "Member is required" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "KPI label is required" }, { status: 400 });
  if (!value) return NextResponse.json({ error: "KPI value is required" }, { status: 400 });

  try {
    const canonicalMember = (await resolveCanonicalMemberName(memberRaw)) ?? memberRaw;
    const saved = await upsertMemberKpi({
      memberName: canonicalMember,
      label,
      value,
      notes: body.notes ?? null,
    });
    return NextResponse.json({
      ok: true,
      kpi: saved
        ? {
            id: saved.id,
            member: saved.member_name,
            label: saved.kpi_label,
            value: saved.kpi_value,
            notes: saved.notes,
            updatedAt: saved.updated_at,
          }
        : null,
      source: "db",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save KPI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
