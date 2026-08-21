import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "@/lib/redis";

declare global {
  var ratelimiters: Map<string, Ratelimit> | undefined;
}

const ratelimiters = global.ratelimiters ?? new Map<string, Ratelimit>();
global.ratelimiters = ratelimiters;

interface RateLimiterOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export async function getRateLimiter({ key, limit, windowSeconds }: RateLimiterOptions) {
  const cached = ratelimiters.get(key);
  if (cached) {
    return cached;
  }

  const ratelimit = new Ratelimit({
    redis: await getRedisClient(),
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix: `ratelimit:${key}`,
  });

  ratelimiters.set(key, ratelimit);
  return ratelimit;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}
