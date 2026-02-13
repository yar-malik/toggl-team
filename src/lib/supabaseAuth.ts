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

type AdminUser = {
  id: string;
  email?: string;
};

async function listAuthUsers(): Promise<AdminUser[]> {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/admin/users?page=1&per_page=1000`, {
    method: "GET",
    headers: {
      apikey: getServiceRoleKey(),
      Authorization: `Bearer ${getServiceRoleKey()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to list auth users");
  }
  const payload = (await response.json()) as { users?: AdminUser[] };
  return Array.isArray(payload.users) ? payload.users : [];
}

async function updateAuthUserPassword(userId: string, password: string) {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      apikey: getServiceRoleKey(),
      Authorization: `Bearer ${getServiceRoleKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password,
      email_confirm: true,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || "Failed to update auth user password");
  }
}

export async function upsertAuthUser(input: { email: string; password: string }) {
  try {
    await createAuthUser(input);
    return { action: "created" as const };
  } catch {
    const users = await listAuthUsers();
    const existing = users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase());
    if (!existing?.id) {
      throw new Error(`Unable to find existing auth user for ${input.email}`);
    }
    await updateAuthUserPassword(existing.id, input.password);
    return { action: "updated_password" as const };
  }
}
