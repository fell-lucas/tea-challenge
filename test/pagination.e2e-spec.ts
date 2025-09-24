import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from './setup-tests';

describe('Cursor-Based Pagination Integration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Basic Pagination', () => {
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
  });

  describe('Cursor Navigation', () => {
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

    it('should not provide nextCursor when no more results exist', async () => {
      // Get a large limit to potentially reach the end
      const response = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=100')
        .expect(200);

      if (response.body.data.length < 100) {
        expect(response.body.pagination.nextCursor).toBeNull();
      }
    });

    it('should navigate to next page using cursor', async () => {
      // Get first page
      const firstPage = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .expect(200);

      if (firstPage.body.pagination.nextCursor) {
        // Get second page using cursor
        const secondPage = await request(app.getHttpServer())
          .get(
            `/api/v1/feed?cursor=${firstPage.body.pagination.nextCursor}&limit=5`,
          )
          .expect(200);

        expect(secondPage.body.data.length).toBeGreaterThan(0);
        expect(secondPage.body.pagination.prevCursor).toBeTruthy();

        // Posts should be different
        const firstPageIds = firstPage.body.data.map((p: any) => p.id);
        const secondPageIds = secondPage.body.data.map((p: any) => p.id);

        const overlap = firstPageIds.filter((id: string) =>
          secondPageIds.includes(id),
        );
        expect(overlap.length).toBe(0); // No overlap between pages
      }
    });

    it('should navigate back using prevCursor', async () => {
      // Get first page
      const firstPage = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .expect(200);

      if (firstPage.body.pagination.nextCursor) {
        // Get second page
        const secondPage = await request(app.getHttpServer())
          .get(
            `/api/v1/feed?cursor=${firstPage.body.pagination.nextCursor}&limit=5`,
          )
          .expect(200);

        if (secondPage.body.pagination.prevCursor) {
          // Navigate back to first page
          const backToFirst = await request(app.getHttpServer())
            .get(
              `/api/v1/feed?cursor=${secondPage.body.pagination.prevCursor}&limit=5`,
            )
            .expect(200);

          // Should get the same results as first page
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
      // First get a valid cursor
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
          expect(res.body.message[0]).toContain('Cursor must be in format');
        });
    });
  });

  describe('Category-Specific Pagination', () => {
    it('should paginate within category correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology&limit=5')
        .expect(200);

      expect(response.body.meta.category).toBe('technology');

      // All posts should be from technology category
      response.body.data.forEach((post: any) => {
        expect(post.category).toBe('Technology');
      });

      if (response.body.pagination.nextCursor) {
        const nextPage = await request(app.getHttpServer())
          .get(
            `/api/v1/feed?category=technology&cursor=${response.body.pagination.nextCursor}&limit=5`,
          )
          .expect(200);

        // Next page should also be technology posts
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
      const maxPages = 3; // Limit to avoid infinite loop

      // Collect posts from multiple pages
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

      // Verify posts are in descending order of relevance score
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

          // Total count should be <= data length when data length < limit
          if (res.body.data.length < res.body.pagination.limit) {
            expect(res.body.pagination.totalCount).toBe(res.body.data.length);
          }
        });
    });
  });
});
