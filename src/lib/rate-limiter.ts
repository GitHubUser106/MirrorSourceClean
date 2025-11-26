import { NextRequest } from "next/server";

// Updated to 20 as requested
export const DAILY_LIMIT = 20;

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string; // ISO date string
}

// --- IN-MEMORY STORE (Works immediately for testing) ---
// In a real deployment (Vercel), serverless functions restart, so this memory clears.
// For persistent production data, use Vercel KV (Redis).
const memoryStore = new Map<string, { count: number; date: string }>();

export function getIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "127.0.0.1";
  return ip;
}

export async function checkRateLimit(req: NextRequest): Promise<{ success: boolean; info: UsageInfo }> {
  const ip = getIp(req);
  const now = new Date();
  const today = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // --- VERCEL KV (REDIS) IMPLEMENTATION EXAMPLE ---
  /*
  import { kv } from "@vercel/kv";
  const key = `usage:${ip}:${today}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, 86400); // Expire in 24 hours
  const used = count;
  */

  // --- IN-MEMORY IMPLEMENTATION (Current) ---
  let record = memoryStore.get(ip);
  
  // Reset if it's a new day
  if (!record || record.date !== today) {
    record = { count: 0, date: today };
  }

  const used = record.count;
  
  // Calculate reset time (Midnight UTC)
  const resetDate = new Date(now);
  resetDate.setUTCHours(24, 0, 0, 0);
  
  const info: UsageInfo = {
    used,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - used),
    resetAt: resetDate.toISOString(),
  };

  return {
    success: used < DAILY_LIMIT,
    info,
  };
}

export async function incrementUsage(req: NextRequest): Promise<UsageInfo> {
  const ip = getIp(req);
  const today = new Date().toISOString().split("T")[0];

  // --- VERCEL KV EXAMPLE ---
  // await kv.incr(`usage:${ip}:${today}`);
  
  // --- IN-MEMORY EXAMPLE ---
  let record = memoryStore.get(ip);
  if (!record || record.date !== today) {
    record = { count: 0, date: today };
  }
  
  record.count += 1;
  memoryStore.set(ip, record);

  return (await checkRateLimit(req)).info;
}