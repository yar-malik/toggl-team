import "server-only";

export type TeamMember = {
  name: string;
  token: string;
};

export type TogglTimeEntry = {
  id: number;
  description: string | null;
  start: string;
  stop: string | null;
  duration: number;
  project_id?: number | null;
  tags?: string[] | null;
};

const TOGGL_API_BASE = "https://api.track.toggl.com/api/v9";

function parseTeamEnv(): TeamMember[] {
  const raw = process.env.TOGGL_TEAM;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as TeamMember[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.name === "string" && typeof item.token === "string")
      .map((item) => ({ name: item.name.trim(), token: item.token.trim() }))
      .filter((item) => item.name.length > 0 && item.token.length > 0);
  } catch {
    return [];
  }
}

export function getTeamMembers(): { name: string }[] {
  return parseTeamEnv().map((member) => ({ name: member.name }));
}

export function getTokenForMember(name: string): string | null {
  const team = parseTeamEnv();
  const member = team.find((item) => item.name.toLowerCase() === name.toLowerCase());
  return member?.token ?? null;
}

function authHeader(token: string): string {
  const basic = Buffer.from(`${token}:api_token`).toString("base64");
  return `Basic ${basic}`;
}

export async function fetchTimeEntries(token: string, startDate: string, endDate: string) {
  const url = new URL(`${TOGGL_API_BASE}/me/time_entries`);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const response = await fetch(url, {
    headers: {
      Authorization: authHeader(token),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = new Error(`Toggl request failed (${response.status})`);
    (error as Error & { status?: number; retryAfter?: string | null }).status = response.status;
    (error as Error & { status?: number; retryAfter?: string | null }).retryAfter =
      response.headers.get("Retry-After");
    throw error;
  }

  return (await response.json()) as TogglTimeEntry[];
}

export async function fetchCurrentEntry(token: string) {
  const url = `${TOGGL_API_BASE}/me/time_entries/current`;
  const response = await fetch(url, {
    headers: {
      Authorization: authHeader(token),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = new Error(`Toggl current entry failed (${response.status})`);
    (error as Error & { status?: number; retryAfter?: string | null }).status = response.status;
    (error as Error & { status?: number; retryAfter?: string | null }).retryAfter =
      response.headers.get("Retry-After");
    throw error;
  }

  return (await response.json()) as TogglTimeEntry | null;
}
