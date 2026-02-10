import "server-only";

type MemoryEntry = {
  payload: unknown;
  expiresAt: number;
};

const memoryCache = new Map<string, MemoryEntry>();

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getMemory<T>(key: string, allowExpired: boolean): T | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (!allowExpired && Date.now() > hit.expiresAt) return null;
  return hit.payload as T;
}

function setMemory(key: string, payload: unknown, expiresAt: number) {
  memoryCache.set(key, { payload, expiresAt });
}

type SnapshotRow = {
  payload: unknown;
  expires_at: string;
};

async function getSupabaseSnapshot<T>(key: string): Promise<{ payload: T; expiresAt: number } | null> {
  if (!isSupabaseConfigured()) return null;

  const base = process.env.SUPABASE_URL!;
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const encodedKey = encodeURIComponent(key);
  const url =
    `${base}/rest/v1/cache_snapshots` +
    `?select=payload,expires_at&cache_key=eq.${encodedKey}&order=updated_at.desc&limit=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const rows = (await response.json()) as SnapshotRow[];
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0];
  const expiresAt = new Date(row.expires_at).getTime();
  if (Number.isNaN(expiresAt)) return null;
  return { payload: row.payload as T, expiresAt };
}

async function setSupabaseSnapshot(key: string, payload: unknown, expiresAt: number) {
  if (!isSupabaseConfigured()) return;

  const base = process.env.SUPABASE_URL!;
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const url = `${base}/rest/v1/cache_snapshots`;
  const body = [
    {
      cache_key: key,
      payload,
      expires_at: new Date(expiresAt).toISOString(),
    },
  ];

  await fetch(url, {
    method: "POST",
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => undefined);
}

export async function getCacheSnapshot<T>(key: string, allowExpired = false): Promise<T | null> {
  const memory = getMemory<T>(key, allowExpired);
  if (memory) return memory;

  const db = await getSupabaseSnapshot<T>(key);
  if (!db) return null;
  setMemory(key, db.payload, db.expiresAt);

  if (!allowExpired && Date.now() > db.expiresAt) return null;
  return db.payload;
}

export async function setCacheSnapshot<T>(key: string, payload: T, ttlMs: number): Promise<void> {
  const expiresAt = Date.now() + ttlMs;
  setMemory(key, payload, expiresAt);
  await setSupabaseSnapshot(key, payload, expiresAt);
}
