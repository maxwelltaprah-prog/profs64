import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { rateLimited } from "./errors";
import { logger } from "./logger";

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  limit(key: string): Promise<LimitResult>;
}

export interface LimiterConfig {
  /** Stable name; part of every key so limiters do not share counters. */
  name: string;
  limit: number;
  windowSeconds: number;
}

const MAX_TRACKED_KEYS = 10_000;

// Fixed-window counter held in process memory. Correct for one instance only; production
// with several instances should set the Upstash variables.
export function createMemoryLimiter(
  config: LimiterConfig,
  now: () => number = Date.now,
): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  const windowMs = config.windowSeconds * 1000;

  return {
    async limit(key) {
      const current = now();
      const entry = windows.get(key);
      if (entry === undefined || entry.resetAt <= current) {
        if (windows.size >= MAX_TRACKED_KEYS) {
          for (const [k, v] of windows) if (v.resetAt <= current) windows.delete(k);
          if (windows.size >= MAX_TRACKED_KEYS) {
            const oldest = windows.keys().next().value;
            if (oldest !== undefined) windows.delete(oldest);
          }
        }
        windows.set(key, { count: 1, resetAt: current + windowMs });
        return { allowed: true, remaining: config.limit - 1, retryAfterSeconds: 0 };
      }
      entry.count += 1;
      const allowed = entry.count <= config.limit;
      return {
        allowed,
        remaining: Math.max(0, config.limit - entry.count),
        retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((entry.resetAt - current) / 1000)),
      };
    },
  };
}

function createUpstashLimiter(config: LimiterConfig, fallback: RateLimiter): RateLimiter {
  const limiter = new Ratelimit({
    redis: new Redis({
      url: process.env["UPSTASH_REDIS_REST_URL"] ?? "",
      token: process.env["UPSTASH_REDIS_REST_TOKEN"] ?? "",
    }),
    limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
    prefix: `buildr:${config.name}`,
    timeout: 1500,
  });

  return {
    async limit(key) {
      try {
        const result = await limiter.limit(key);
        return {
          allowed: result.success,
          remaining: result.remaining,
          retryAfterSeconds: result.success
            ? 0
            : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
        };
      } catch {
        // Redis outage must not take authentication down, and must not silently disable
        // limiting either: fall back to the per-process limiter and say so.
        logger.warn("rate_limit_backend_unavailable", { limiter: config.name });
        return fallback.limit(key);
      }
    },
  };
}

const cache = new Map<string, RateLimiter>();

export function getLimiter(config: LimiterConfig): RateLimiter {
  const cached = cache.get(config.name);
  if (cached) return cached;
  const memory = createMemoryLimiter(config);
  const useUpstash =
    Boolean(process.env["UPSTASH_REDIS_REST_URL"]) &&
    Boolean(process.env["UPSTASH_REDIS_REST_TOKEN"]);
  const limiter = useUpstash ? createUpstashLimiter(config, memory) : memory;
  cache.set(config.name, limiter);
  return limiter;
}

// Throws a 429 AppError when any of the keys is over its limit.
export async function enforceLimits(
  checks: ReadonlyArray<{ config: LimiterConfig; key: string }>,
): Promise<void> {
  for (const { config, key } of checks) {
    const result = await getLimiter(config).limit(key);
    if (!result.allowed) throw rateLimited(result.retryAfterSeconds);
  }
}

export const LIMITS = {
  loginIp: { name: "login-ip", limit: 30, windowSeconds: 600 },
  loginAccount: { name: "login-account", limit: 5, windowSeconds: 600 },
  signupIp: { name: "signup-ip", limit: 5, windowSeconds: 3600 },
  resetIp: { name: "reset-ip", limit: 5, windowSeconds: 3600 },
  resetAccount: { name: "reset-account", limit: 3, windowSeconds: 3600 },
  chatUser: { name: "chat-user", limit: 20, windowSeconds: 600 },
  chatIp: { name: "chat-ip", limit: 60, windowSeconds: 600 },
  accountExportUser: { name: "account-export-user", limit: 5, windowSeconds: 3600 },
  accountDeleteUser: { name: "account-delete-user", limit: 5, windowSeconds: 3600 },
  projectCreateUser: { name: "project-create-user", limit: 20, windowSeconds: 3600 },
  passwordChangeUser: { name: "password-change-user", limit: 5, windowSeconds: 3600 },
} as const satisfies Record<string, LimiterConfig>;
