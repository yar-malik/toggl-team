import { cookies } from "next/headers";
import PlatformHomeClient from "@/app/components/PlatformHomeClient";
import { listMemberKpis, listMemberProfiles, listProjects } from "@/lib/manualTimeEntriesStore";

export default async function Home() {
  const [members, projects, kpis, cookieStore] = await Promise.all([
    listMemberProfiles(),
    listProjects(),
    listMemberKpis(),
    cookies(),
  ]);
  const currentUserEmail = cookieStore.get("voho_user_email")?.value ?? null;

  return (
    <PlatformHomeClient
      members={members.map((m) => ({ name: m.name, email: m.email, role: m.role }))}
      projects={projects.map((p) => ({ key: p.project_key, name: p.project_name, source: p.project_key.startsWith("manual:") ? "manual" : "external" }))}
      kpis={kpis.map((k) => ({ id: k.id, member: k.member_name, label: k.kpi_label, value: k.kpi_value, notes: k.notes }))}
      currentUserEmail={currentUserEmail}
    />
  );
}
