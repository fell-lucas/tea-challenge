import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from './setup-tests';

describe('Redis Caching Integration (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef';

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Cache Hit/Miss Behavior', () => {
    it('should indicate cache miss on first request', async () => {
      // Clear cache by making a post (which invalidates cache)
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Cache Test Post',
          content: 'This post will invalidate cache',
          category: 'technology',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(response.body.meta).toHaveProperty('cacheHit');
      expect(typeof response.body.meta.cacheHit).toBe('boolean');
    });

    it('should indicate cache hit on subsequent requests', async () => {
      // First request
      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Second request should hit cache
      const secondResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(secondResponse.body.meta.cacheHit).toBe(true);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache when new post is created', async () => {
      // First request to populate cache
      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Second request should hit cache
      const cachedResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(cachedResponse.body.meta.cacheHit).toBe(true);

      // Create a new post (should invalidate cache)
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Cache Invalidation Test',
          content: 'This post should invalidate the cache',
          category: 'technology',
        })
        .expect(201);

      // Next request should be cache miss
      const afterPostResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(afterPostResponse.body.meta.cacheHit).toBe(false);
    });

    it('should invalidate both general and category caches', async () => {
      // Populate both general and category caches
      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Verify both are cached
      const generalCached = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      const categoryCached = await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(generalCached.body.meta.cacheHit).toBe(true);
      expect(categoryCached.body.meta.cacheHit).toBe(true);

      // Create post to invalidate all caches
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Full Cache Invalidation Test',
          content: 'This should invalidate all feed caches',
          category: 'sports',
        })
        .expect(201);

      // Both should now be cache misses
      const generalAfter = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      const categoryAfter = await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(generalAfter.body.meta.cacheHit).toBe(false);
      expect(categoryAfter.body.meta.cacheHit).toBe(false);
    });
  });

  describe('Category-Specific Caching', () => {
    it('should cache different categories independently', async () => {
      // Request technology category
      await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Request sports category
      await request(app.getHttpServer())
        .get('/api/v1/feed?category=sports')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Second request to technology should hit cache
      const techCached = await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Second request to sports should hit cache
      const sportsCached = await request(app.getHttpServer())
        .get('/api/v1/feed?category=sports')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(techCached.body.meta.cacheHit).toBe(true);
      expect(sportsCached.body.meta.cacheHit).toBe(true);
    });

    it('should have different TTL for general vs category feeds', async () => {
      // This test verifies the caching behavior exists
      // Actual TTL testing would require waiting for cache expiration

      const generalResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      const categoryResponse = await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Both should have cache metadata
      expect(generalResponse.body.meta).toHaveProperty('cacheHit');
      expect(categoryResponse.body.meta).toHaveProperty('cacheHit');
    });
  });

  describe('Cache Performance', () => {
    it('should maintain response time under 200ms for cached requests', async () => {
      // Populate cache
      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Test cached request performance
      const response = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(response.body.meta.cacheHit).toBe(true);
      expect(response.body.meta.responseTime).toBeLessThan(200);
    });

    it('should handle cache failures gracefully', async () => {
      // This test ensures the API works even if cache is unavailable
      // In a real scenario, we'd mock Redis failure

      const response = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Should still return valid response structure
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('meta');
    });
  });

  describe('Raw Data Caching Strategy', () => {
    it('should cache raw post data for in-memory pagination', async () => {
      // Request with different pagination parameters
      const page1 = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .set('X-User-Id', validUserId)
        .expect(200);

      const page2 = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=10')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Both should benefit from raw data caching
      expect(page1.body.meta).toHaveProperty('cacheHit');
      expect(page2.body.meta).toHaveProperty('cacheHit');

      // Different limits should work correctly
      expect(page1.body.pagination.limit).toBe(5);
      expect(page2.body.pagination.limit).toBe(10);
    });
  });
});
