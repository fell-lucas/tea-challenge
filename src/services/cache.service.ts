import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      return null; // Graceful degradation
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
      // Don't throw - cache failures shouldn't break the app
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  async getInfo(): Promise<{ status: string; responseTime: number }> {
    const startTime = Date.now();
    try {
      await this.redis.ping();
      const responseTime = Date.now() - startTime;
      return { status: 'ok', responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return { status: 'error', responseTime };
    }
  }

  // Engagement-specific caching methods
  async getPostEngagementMetrics(
    postId: string,
  ): Promise<{ likeCount: number; dislikeCount: number } | null> {
    return this.get(`engagement:metrics:${postId}`);
  }

  async setPostEngagementMetrics(
    postId: string,
    metrics: { likeCount: number; dislikeCount: number },
    ttlSeconds: number = 300, // 5 minutes
  ): Promise<void> {
    await this.set(`engagement:metrics:${postId}`, metrics, ttlSeconds);
  }

  async getUserEngagement(
    userId: string,
    postId: string,
  ): Promise<string | null> {
    return this.get(`engagement:user:${userId}:${postId}`);
  }

  async setUserEngagement(
    userId: string,
    postId: string,
    engagementType: string,
    ttlSeconds: number = 600, // 10 minutes
  ): Promise<void> {
    await this.set(
      `engagement:user:${userId}:${postId}`,
      engagementType,
      ttlSeconds,
    );
  }

  async invalidatePostEngagement(postId: string): Promise<void> {
    await this.delPattern(`engagement:*:${postId}`);
    await this.del(`engagement:metrics:${postId}`);
    this.logger.debug(`Invalidated engagement cache for post ${postId}`);
  }

  async invalidateUserEngagement(
    userId: string,
    postId?: string,
  ): Promise<void> {
    if (postId) {
      await this.del(`engagement:user:${userId}:${postId}`);
    } else {
      await this.delPattern(`engagement:user:${userId}:*`);
    }
    this.logger.debug(
      `Invalidated user engagement cache for user ${userId}${postId ? ` and post ${postId}` : ''}`,
    );
  }

  // Category-specific caching methods
  async getCategoriesByPopularity(): Promise<any[] | null> {
    return this.get('categories:by-popularity');
  }

  async setCategoriesByPopularity(
    categories: any[],
    ttlSeconds: number = 900, // 15 minutes
  ): Promise<void> {
    await this.set('categories:by-popularity', categories, ttlSeconds);
  }

  async getCategoryPostCount(categoryId: string): Promise<number | null> {
    return this.get(`category:postcount:${categoryId}`);
  }

  async setCategoryPostCount(
    categoryId: string,
    postCount: number,
    ttlSeconds: number = 600, // 10 minutes
  ): Promise<void> {
    await this.set(`category:postcount:${categoryId}`, postCount, ttlSeconds);
  }

  async invalidateCategoryCache(categoryId?: string): Promise<void> {
    await this.del('categories:by-popularity');
    if (categoryId) {
      await this.del(`category:postcount:${categoryId}`);
    } else {
      await this.delPattern('category:postcount:*');
    }
    this.logger.debug(
      `Invalidated category cache${categoryId ? ` for category ${categoryId}` : ''}`,
    );
  }

  // Post details caching (enhanced with engagement)
  async getPostDetails(postId: string, userId?: string): Promise<any | null> {
    const cacheKey = userId
      ? `post:details:${postId}:user:${userId}`
      : `post:details:${postId}:anonymous`;
    return this.get(cacheKey);
  }

  async setPostDetails(
    postId: string,
    postDetails: any,
    userId?: string,
    ttlSeconds: number = 300, // 5 minutes
  ): Promise<void> {
    const cacheKey = userId
      ? `post:details:${postId}:user:${userId}`
      : `post:details:${postId}:anonymous`;
    await this.set(cacheKey, postDetails, ttlSeconds);
  }

  async invalidatePostDetails(postId: string): Promise<void> {
    await this.delPattern(`post:details:${postId}:*`);
    this.logger.debug(`Invalidated post details cache for post ${postId}`);
  }

  // Bulk invalidation for engagement changes
  async invalidateEngagementRelatedCaches(
    postId: string,
    userId: string,
  ): Promise<void> {
    await this.invalidatePostEngagement(postId);
    await this.invalidateUserEngagement(userId, postId);
    await this.invalidatePostDetails(postId);

    this.logger.debug(
      `Invalidated all engagement-related caches for post ${postId} and user ${userId}`,
    );
  }
}
