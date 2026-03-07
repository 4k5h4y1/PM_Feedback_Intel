export const CACHE_KEYS = {
  stats:    'dashboard:stats:v1',
  digest:   'dashboard:digest:weekly',
  segments: 'dashboard:segments:v1',
} as const;

export const CACHE_TTL = {
  stats:    300,   // 5 minutes
  digest:   3600,  // 1 hour
  segments: 300,   // 5 minutes
} as const;

export async function getCached<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key, 'text');
  if (!raw) return null;
  try { return JSON.parse(raw) as T; }
  catch { return null; }
}

export async function setCached(
  kv: KVNamespace,
  key: string,
  value: unknown,
  ttl: number,
): Promise<void> {
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
}

export async function invalidate(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key);
}
