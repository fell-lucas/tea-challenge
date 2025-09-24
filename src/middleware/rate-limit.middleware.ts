import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly limit = 100; // 100 requests per second per IP
  private readonly windowMs = 1000; // 1 second window

  use(req: Request, res: Response, next: NextFunction) {
    // Testing bypass
    if (
      req.headers['x-skip-rate-limit'] &&
      process.env.NODE_ENV !== 'production'
    ) {
      next();
      return;
    }

    const clientIp = this.getClientIp(req);
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const resetTime = windowStart + this.windowMs;

    // Get or create rate limit entry for this IP
    let entry = this.rateLimitMap.get(clientIp);

    if (!entry || entry.resetTime <= now) {
      // Create new entry or reset expired entry
      entry = {
        count: 0,
        resetTime,
      };
      this.rateLimitMap.set(clientIp, entry);
    }

    // Increment request count
    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', this.limit);
    res.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, this.limit - entry.count),
    );
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    // Check if limit exceeded
    if (entry.count > this.limit) {
      this.logger.warn(
        `Rate limit exceeded for IP ${clientIp}: ${entry.count}/${this.limit} requests`,
      );

      res.setHeader('Retry-After', Math.ceil((entry.resetTime - now) / 1000));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          error: 'Rate limit exceeded',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.debug(
      `Rate limit check passed for IP ${clientIp}: ${entry.count}/${this.limit} requests`,
    );

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      // 1% chance to clean up
      this.cleanupExpiredEntries(now);
    }

    next();
  }

  private getClientIp(req: Request): string {
    // Check for forwarded IP first (for proxy/load balancer scenarios)
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    // Check for real IP header
    const realIp = req.headers['x-real-ip'] as string;
    if (realIp) {
      return realIp;
    }

    // Fall back to connection remote address
    return (
      req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'
    );
  }

  private cleanupExpiredEntries(now: number): void {
    let cleanedCount = 0;
    for (const [ip, entry] of this.rateLimitMap.entries()) {
      if (entry.resetTime <= now) {
        this.rateLimitMap.delete(ip);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(
        `Cleaned up ${cleanedCount} expired rate limit entries`,
      );
    }
  }

  // Method to get current rate limit status for an IP (useful for testing)
  getRateLimitStatus(
    ip: string,
  ): { count: number; limit: number; resetTime: number } | null {
    const entry = this.rateLimitMap.get(ip);
    if (!entry) {
      return null;
    }

    return {
      count: entry.count,
      limit: this.limit,
      resetTime: entry.resetTime,
    };
  }

  // Method to reset rate limit for an IP (useful for testing)
  resetRateLimit(ip: string): void {
    this.rateLimitMap.delete(ip);
    this.logger.debug(`Rate limit reset for IP ${ip}`);
  }
}
