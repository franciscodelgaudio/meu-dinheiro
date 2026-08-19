import "server-only";

import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    "Please define the UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables",
  );
}

declare global {
  var redis: Redis | undefined;
}

const redis =
  global.redis ??
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

global.redis = redis;

async function getRedisClient() {
  return redis;
}

export { getRedisClient };
