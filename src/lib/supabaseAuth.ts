import "server-only";

export type AuthUser = {
  id: string;
  email?: string;
};

type PasswordSignInResult = {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
};

function getSupabaseUrl() {
  const value = process.env.SUPABASE_URL?.trim();
  if (!value) throw new Error("SUPABASE_URL is missing");
  return value;
}

function getAnonKey() {
  const value = process.env.SUPABASE_ANON_KEY?.trim();
  if (!value) throw new Error("SUPABASE_ANON_KEY is missing");
  return value;
}

function getServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  return value;
}

export async function signInWithPassword(email: string, password: string): Promise<PasswordSignInResult> {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: getAnonKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Invalid email or password");
  }
  return (await response.json()) as PasswordSignInResult;
}

export async function getUserFromAccessToken(accessToken: string): Promise<AuthUser | null> {
  if (!accessToken) return null;
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: getAnonKey(),
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as AuthUser;
}

export async function createAuthUser(input: { email: string; password: string }) {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: getServiceRoleKey(),
      Authorization: `Bearer ${getServiceRoleKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || "Failed to create auth user");
  }
  return response.json();
}

