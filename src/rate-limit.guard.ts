import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

interface RateLimitEntry {
  windowStart: number;
  count: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_REQUESTS = 50;
  private static buckets = new Map<string, RateLimitEntry>();

  static reset(): void {
    RateLimitGuard.buckets.clear();
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const ip = (req.ip ?? req.connection?.remoteAddress ?? 'unknown') as string;
    const path = (req.route?.path ?? req.url ?? 'unknown') as string;

    const key = `${ip}:${path}`;
    const now = Date.now();

    const entry = RateLimitGuard.buckets.get(key);

    if (!entry || now - entry.windowStart > RateLimitGuard.WINDOW_MS) {
      RateLimitGuard.buckets.set(key, { windowStart: now, count: 1 });
      return true;
    }

    entry.count += 1;

    if (entry.count > RateLimitGuard.MAX_REQUESTS) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
