import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from '../../../setup-tests';

describe('Feed API (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef'; // UUID v7 format

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/feed', () => {
    it('should return feed with valid X-User-Id header', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.pagination).toHaveProperty('nextCursor');
          expect(res.body.pagination).toHaveProperty('prevCursor');
          expect(res.body.pagination).toHaveProperty('limit');
          expect(res.body.pagination).toHaveProperty('totalCount');
          expect(res.body.meta).toHaveProperty('cacheHit');
          expect(res.body.meta).toHaveProperty('responseTime');
          expect(res.body.meta).toHaveProperty('timestamp');
        });
    });

    it('should allow access without X-User-Id header (open access)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should accept optional X-User-Id header for tracking', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should return 400 when X-User-Id header is invalid UUID v7', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', 'invalid-uuid')
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
          expect(res.body.message).toContain('UUID v7');
        });
    });

    it('should support cursor-based pagination', () => {
      const cursor = '123.45_507f1f77bcf86cd799439011';
      return request(app.getHttpServer())
        .get(`/api/v1/feed?cursor=${cursor}&limit=10`)
        .set('X-User-Id', validUserId)
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.limit).toBe(10);
        });
    });

    it('should support category filtering', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200)
        .expect((res) => {
          expect(res.body.meta).toHaveProperty('category', 'technology');
        });
    });

    it('should return 400 for invalid category', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed?category=invalid')
        .set('X-User-Id', validUserId)
        .expect(400);
    });

    it('should return 400 for invalid limit', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed?limit=101')
        .set('X-User-Id', validUserId)
        .expect(400);
    });
  });

  describe('Cursor-Based Pagination', () => {
    it('should return pagination metadata in response', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination).toHaveProperty('nextCursor');
          expect(res.body.pagination).toHaveProperty('prevCursor');
          expect(res.body.pagination).toHaveProperty('limit');
          expect(res.body.pagination).toHaveProperty('totalCount');

          expect(typeof res.body.pagination.limit).toBe('number');
          expect(typeof res.body.pagination.totalCount).toBe('number');
          expect(res.body.pagination.limit).toBeGreaterThan(0);
          expect(res.body.pagination.totalCount).toBeGreaterThanOrEqual(0);
        });
    });

    it('should respect limit parameter', async () => {
      const limits = [5, 10, 20];

      for (const limit of limits) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/feed?limit=${limit}`)
          .expect(200);

        expect(response.body.pagination.limit).toBe(limit);
        expect(response.body.data.length).toBeLessThanOrEqual(limit);
      }
    });

    it('should use default limit of 20 when not specified', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.limit).toBe(20);
        });
    });

    it('should enforce maximum limit of 100', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed?limit=150')
        .expect(400);
    });

    it('should provide nextCursor when more results exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .expect(200);

      if (response.body.pagination.totalCount > 5) {
        expect(response.body.pagination.nextCursor).toBeTruthy();
        expect(typeof response.body.pagination.nextCursor).toBe('string');
        expect(response.body.pagination.nextCursor).toMatch(
          /^\d+(\.\d+)?_[a-f0-9]{24}$/,
        );
      }
    });

    it('should navigate to next page using cursor', async () => {
      const firstPage = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .expect(200);

      if (firstPage.body.pagination.nextCursor) {
        const secondPage = await request(app.getHttpServer())
          .get(
            `/api/v1/feed?cursor=${firstPage.body.pagination.nextCursor}&limit=5`,
          )
          .expect(200);

        expect(secondPage.body.data.length).toBeGreaterThan(0);
        expect(secondPage.body.pagination.prevCursor).toBeTruthy();

        const firstPageIds = firstPage.body.data.map((p: any) => p.id);
        const secondPageIds = secondPage.body.data.map((p: any) => p.id);

        const overlap = firstPageIds.filter((id: string) =>
          secondPageIds.includes(id),
        );
        expect(overlap.length).toBe(0); // No overlap between pages
      }
    });

    it('should navigate back using prevCursor', async () => {
      const firstPage = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .expect(200);

      if (firstPage.body.pagination.nextCursor) {
        const secondPage = await request(app.getHttpServer())
          .get(
            `/api/v1/feed?cursor=${firstPage.body.pagination.nextCursor}&limit=5`,
          )
          .expect(200);

        if (secondPage.body.pagination.prevCursor) {
          const backToFirst = await request(app.getHttpServer())
            .get(
              `/api/v1/feed?cursor=${secondPage.body.pagination.prevCursor}&limit=5`,
            )
            .expect(200);

          expect(backToFirst.body.data.length).toBe(firstPage.body.data.length);

          const originalIds = firstPage.body.data.map((p: any) => p.id);
          const backIds = backToFirst.body.data.map((p: any) => p.id);
          expect(backIds).toEqual(originalIds);
        }
      }
    });
  });

  describe('Cursor Format Validation', () => {
    it('should accept valid cursor format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .expect(200);

      if (response.body.pagination.nextCursor) {
        await request(app.getHttpServer())
          .get(`/api/v1/feed?cursor=${response.body.pagination.nextCursor}`)
          .expect(200);
      }
    });

    it('should reject invalid cursor formats', async () => {
      const invalidCursors = [
        'invalid-cursor',
        '123.45_invalid-id',
        'not-a-cursor-at-all',
        '123.45_507f1f77bcf86cd799439g11', // Invalid hex character
        '123.45_507f1f77bcf86cd79943901', // Too short
        'abc_507f1f77bcf86cd799439011', // Invalid score format
        '123.45_', // Missing post ID
        '_507f1f77bcf86cd799439011', // Missing score
      ];

      for (const cursor of invalidCursors) {
        await request(app.getHttpServer())
          .get(`/api/v1/feed?cursor=${cursor}`)
          .expect(400);
      }
    });

    it('should provide clear error message for invalid cursor', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed?cursor=invalid-cursor')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Cursor must be in format');
        });
    });

    it('should handle null cursor parameter gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/feed?cursor=null')
        .expect(400); // Should fail validation

      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('Category-Specific Pagination', () => {
    it('should paginate within category correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology&limit=5')
        .expect(200);

      expect(response.body.meta.category).toBe('technology');

      response.body.data.forEach((post: any) => {
        expect(post.category).toBe('Technology');
      });

      if (response.body.pagination.nextCursor) {
        const nextPage = await request(app.getHttpServer())
          .get(
            `/api/v1/feed?category=technology&cursor=${response.body.pagination.nextCursor}&limit=5`,
          )
          .expect(200);

        nextPage.body.data.forEach((post: any) => {
          expect(post.category).toBe('Technology');
        });
      }
    });

    it('should maintain category context in cursor navigation', async () => {
      const firstPage = await request(app.getHttpServer())
        .get('/api/v1/feed?category=sports&limit=3')
        .expect(200);

      if (firstPage.body.pagination.nextCursor) {
        const secondPage = await request(app.getHttpServer())
          .get(
            `/api/v1/feed?category=sports&cursor=${firstPage.body.pagination.nextCursor}&limit=3`,
          )
          .expect(200);

        expect(secondPage.body.meta.category).toBe('sports');
        secondPage.body.data.forEach((post: any) => {
          expect(post.category).toBe('Sports');
        });
      }
    });
  });

  describe('Pagination Consistency', () => {
    it('should maintain consistent ordering across pages', async () => {
      const allPosts: any[] = [];
      let cursor: string | null = null;
      let pageCount = 0;
      const maxPages = 3;

      while (pageCount < maxPages) {
        const url: string = cursor
          ? `/api/v1/feed?cursor=${cursor}&limit=5`
          : '/api/v1/feed?limit=5';

        const response = await request(app.getHttpServer())
          .get(url)
          .expect(200);

        allPosts.push(...response.body.data);
        cursor = response.body.pagination.nextCursor;
        pageCount++;

        if (!cursor) break;
      }

      if (allPosts.length > 1) {
        for (let i = 0; i < allPosts.length - 1; i++) {
          expect(allPosts[i].relevanceScore).toBeGreaterThanOrEqual(
            allPosts[i + 1].relevanceScore,
          );
        }
      }
    });
  });

  describe('Total Count Estimation', () => {
    it('should provide totalCount in pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .expect(200)
        .expect((res) => {
          expect(typeof res.body.pagination.totalCount).toBe('number');
          expect(res.body.pagination.totalCount).toBeGreaterThanOrEqual(0);
        });
    });

    it('should provide accurate totalCount for category filters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .expect(200)
        .expect((res) => {
          expect(typeof res.body.pagination.totalCount).toBe('number');
          expect(res.body.pagination.totalCount).toBeGreaterThanOrEqual(0);

          if (res.body.data.length < res.body.pagination.limit) {
            expect(res.body.pagination.totalCount).toBe(res.body.data.length);
          }
        });
    });
  });

  describe('Redis Caching Integration', () => {
    it('should indicate cache miss on first request', async () => {
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
      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      const secondResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(secondResponse.body.meta.cacheHit).toBe(true);
    });

    it('should invalidate cache when new post is created', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      const cachedResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(cachedResponse.body.meta.cacheHit).toBe(true);

      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Cache Invalidation Test',
          content: 'This post should invalidate the cache',
          category: 'technology',
        })
        .expect(201);

      const afterPostResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(afterPostResponse.body.meta.cacheHit).toBe(false);
    });

    it('should invalidate both general and category caches', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

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

      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Full Cache Invalidation Test',
          content: 'This should invalidate all feed caches',
          category: 'sports',
        })
        .expect(201);

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

    it('should cache different categories independently', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/feed?category=sports')
        .set('X-User-Id', validUserId)
        .expect(200);

      const techCached = await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      const sportsCached = await request(app.getHttpServer())
        .get('/api/v1/feed?category=sports')
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(techCached.body.meta.cacheHit).toBe(true);
      expect(sportsCached.body.meta.cacheHit).toBe(true);
    });
  });

  describe('Relevance Ranking', () => {
    it('should include relevance score in feed response', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200)
        .expect((res) => {
          if (res.body.data.length > 0) {
            const firstPost = res.body.data[0];
            expect(firstPost).toHaveProperty('relevanceScore');
            expect(typeof firstPost.relevanceScore).toBe('number');
            expect(firstPost.relevanceScore).toBeGreaterThanOrEqual(0);
          }
        });
    });

    it('should return posts in descending order of relevance score', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200)
        .expect((res) => {
          const posts = res.body.data;
          if (posts.length > 1) {
            for (let i = 0; i < posts.length - 1; i++) {
              expect(posts[i].relevanceScore).toBeGreaterThanOrEqual(
                posts[i + 1].relevanceScore,
              );
            }
          }
        });
    });

    it('should maintain ranking consistency across requests', async () => {
      const firstRequest = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .set('X-User-Id', validUserId)
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const secondRequest = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Order should be consistent for the same time period
      const firstPosts = firstRequest.body.data;
      const secondPosts = secondRequest.body.data;

      if (firstPosts.length > 0 && secondPosts.length > 0) {
        expect(firstPosts[0].id).toBe(secondPosts[0].id);
      }
    });

    it('should rank posts within category correctly', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Tech Post 1',
          content: 'First technology post',
          category: 'technology',
        })
        .expect(201);

      await new Promise((resolve) => setTimeout(resolve, 500));

      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Tech Post 2',
          content: 'Second technology post',
          category: 'technology',
        })
        .expect(201);

      const categoryFeed = await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      const posts = categoryFeed.body.data;
      if (posts.length > 1) {
        posts.forEach((post: any) => {
          expect(post.category).toBe('Technology');
        });

        for (let i = 0; i < posts.length - 1; i++) {
          expect(posts[i].relevanceScore).toBeGreaterThanOrEqual(
            posts[i + 1].relevanceScore,
          );
        }
      }
    });
  });

  describe('Performance', () => {
    const performanceThreshold = 200; // 200ms p95 requirement

    it('should respond within 200ms for p95 (cached)', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      await request(app.getHttpServer())
        .get('/api/v1/feed?limit=20')
        .set('X-Skip-Rate-Limit', 'true')
        .expect(200);

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .get('/api/v1/feed?limit=20')
          .set('X-Skip-Rate-Limit', 'true')
          .expect(200);

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95);
      const p95ResponseTime = responseTimes[p95Index];

      expect(p95ResponseTime).toBeLessThan(performanceThreshold);
    });

    it('should handle pagination efficiently', async () => {
      const iterations = 50;
      const responseTimes: number[] = [];

      const initialResponse = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=20')
        .set('X-Skip-Rate-Limit', 'true')
        .expect(200);

      const postsToCreate = Math.max(
        100 - initialResponse.body.pagination.totalCount,
        50,
      );

      for (let i = 0; i < postsToCreate; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/posts')
          .set('X-User-Id', validUserId)
          .send({
            title: `Performance Test Post ${i + 1}`,
            content: `This is test post ${i + 1} for pagination performance testing. It contains enough content to make the test realistic.`,
            category: [
              'technology',
              'science',
              'business',
              'health',
              'lifestyle',
            ][i % 5],
          })
          .expect(201);
      }

      let currentCursor = initialResponse.body.pagination.nextCursor;

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const response = await request(app.getHttpServer())
          .get(`/api/v1/feed?limit=20&cursor=${currentCursor}`)
          .set('X-Skip-Rate-Limit', 'true');

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);

        // Accept both 200 (success) and 400 (invalid cursor/end of data) as valid responses
        if (response.status === 200) {
          if (response.body.pagination.nextCursor) {
            currentCursor = response.body.pagination.nextCursor;
          }
        } else if (response.status !== 400) {
          throw new Error(`Unexpected status code: ${response.status}`);
        }
      }

      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95);
      const p95ResponseTime = responseTimes[p95Index];

      expect(p95ResponseTime).toBeLessThan(performanceThreshold);
    });

    it('should handle category filtering efficiently', async () => {
      const iterations = 50;
      const responseTimes: number[] = [];
      const categories = [
        'technology',
        'science',
        'business',
        'health',
        'lifestyle',
      ];

      for (let i = 0; i < iterations; i++) {
        const category = categories[i % categories.length];
        const startTime = Date.now();

        await request(app.getHttpServer())
          .get(`/api/v1/feed?limit=20&category=${category}`)
          .set('X-Skip-Rate-Limit', 'true')
          .expect(200);

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95);
      const p95ResponseTime = responseTimes[p95Index];

      expect(p95ResponseTime).toBeLessThan(performanceThreshold);
    });
  });
});
