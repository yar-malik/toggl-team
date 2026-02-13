import { notFound } from "next/navigation";
import MemberProfilePageClient from "@/app/components/MemberProfilePageClient";
import { getTeamMembers } from "@/lib/toggl";

function isValidDateInput(value: string | undefined) {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  let memberName = resolvedParams.name;
  try {
    memberName = decodeURIComponent(resolvedParams.name);
  } catch {
    notFound();
  }
  const members = getTeamMembers();
  const exists = members.some((member) => member.name.toLowerCase() === memberName.toLowerCase());
  if (!exists) {
    notFound();
  }

  const initialDate = isValidDateInput(resolvedSearch.date) ? resolvedSearch.date! : new Date().toISOString().slice(0, 10);
  return <MemberProfilePageClient memberName={memberName} initialDate={initialDate} />;
}
