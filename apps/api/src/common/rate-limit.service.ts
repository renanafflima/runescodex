import { HttpException, Injectable } from '@nestjs/common';

type Bucket = {
  windowStart: number;
  count: number;
};

/**
 * In-memory counters. Render currently runs a single web service, so one
 * process sees every request. A future second instance would not share these
 * counters.
 */
@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  consume(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || now - current.windowStart >= windowMs) {
      this.buckets.set(key, { windowStart: now, count: 1 });
      this.prune(now, windowMs);
      return;
    }

    if (current.count >= limit) {
      throw new HttpException(
        { statusCode: 429, message: 'Too many requests' },
        429,
      );
    }

    current.count += 1;
  }

  private prune(now: number, windowMs: number) {
    if (this.buckets.size < 5000) {
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart >= windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}
