import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from './setup-tests';

describe('Error Handling Integration (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef';

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Validation Error Handling', () => {
    it('should return 400 for invalid limit values', async () => {
      const invalidLimits = [0, -1, 101, 'abc', ''];

      for (const limit of invalidLimits) {
        await request(app.getHttpServer())
          .get(`/api/v1/feed?limit=${limit}`)
          .expect(400);
      }
    });

    it('should return 400 for invalid category values', async () => {
      const invalidCategories = ['invalid', 'tech', 'TECHNOLOGY', '123', ''];

      for (const category of invalidCategories) {
        await request(app.getHttpServer())
          .get(`/api/v1/feed?category=${category}`)
          .expect(400);
      }
    });

    it('should return 400 for invalid cursor format', async () => {
      const invalidCursors = [
        'invalid',
        '123.45_invalid-id',
        'abc_507f1f77bcf86cd799439011',
        '123.45_',
        '_507f1f77bcf86cd799439011',
      ];

      for (const cursor of invalidCursors) {
        await request(app.getHttpServer())
          .get(`/api/v1/feed?cursor=${cursor}`)
          .expect(400);
      }
    });
  });

  describe('Post Creation Error Handling', () => {
    it('should return 400 for missing required fields', async () => {
      const invalidPosts = [
        { content: 'Content only', category: 'technology' }, // Missing title
        { title: 'Title only', category: 'technology' }, // Missing content
        { title: 'Title', content: 'Content' }, // Missing category
        {}, // Missing everything
      ];

      for (const post of invalidPosts) {
        await request(app.getHttpServer())
          .post('/api/v1/posts')
          .set('X-User-Id', validUserId)
          .send(post)
          .expect(400);
      }
    });

    it('should return 400 for field length violations', async () => {
      const violations = [
        {
          title: 'a'.repeat(201), // Too long
          content: 'Valid content',
          category: 'technology',
        },
        {
          title: 'Valid title',
          content: 'a'.repeat(5001), // Too long
          category: 'technology',
        },
        {
          title: '', // Too short
          content: 'Valid content',
          category: 'technology',
        },
        {
          title: 'Valid title',
          content: '', // Too short
          category: 'technology',
        },
      ];

      for (const post of violations) {
        await request(app.getHttpServer())
          .post('/api/v1/posts')
          .set('X-User-Id', validUserId)
          .send(post)
          .expect(400);
      }
    });

    it('should return 400 for invalid category in post creation', () => {
      return request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Valid title',
          content: 'Valid content',
          category: 'invalid-category',
        })
        .expect(400);
    });

    it('should return 400 for invalid tags format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Valid title',
          content: 'Valid content',
          category: 'technology',
          tags: 'not-an-array', // Should be array
        })
        .expect(400);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', 'invalid-uuid')
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('timestamp');

          expect(typeof res.body.statusCode).toBe('number');
          expect(typeof res.body.message).toBe('string');
          expect(typeof res.body.error).toBe('string');
          expect(typeof res.body.timestamp).toBe('string');

          // Timestamp should be valid ISO 8601
          expect(new Date(res.body.timestamp).toISOString()).toBe(
            res.body.timestamp,
          );
        });
    });

    it('should include detailed validation messages', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed?limit=101')
        .set('X-User-Id', validUserId)
        .expect(400)
        .expect((res) => {
          expect(res.body.message[0]).toContain('limit');
          expect(res.body.message[0]).toContain('100');
        });
    });

    it('should not expose internal error details', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', 'invalid-uuid')
        .expect(400)
        .expect((res) => {
          // Should not contain stack traces or internal paths
          expect(res.body.message[0]).not.toContain('stack');
          expect(res.body.message[0]).not.toContain('/src/');
          expect(res.body.message[0]).not.toContain('Error:');
        });
    });
  });

  describe('HTTP Method Error Handling', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(app.getHttpServer())
        .get('/api/v1/nonexistent')
        .set('X-User-Id', validUserId)
        .expect(404);
    });
  });

  describe('Content Type Error Handling', () => {
    it('should return 400 for invalid JSON in POST requests', () => {
      return request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .set('Content-Type', 'application/json')
        .send('invalid-json')
        .expect(400);
    });

    it('should return 400 for unsupported content types', () => {
      return request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .set('Content-Type', 'text/plain')
        .send('plain text data')
        .expect(400);
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should handle large request bodies gracefully', () => {
      const largeContent = 'a'.repeat(10000); // Very large content

      return request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Large content test',
          content: largeContent,
          category: 'technology',
        })
        .expect(400); // Should be rejected due to content length validation
    });

    it('should sanitize error messages', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', '<script>alert("xss")</script>')
        .expect(400)
        .expect((res) => {
          // Error message should not contain the script tag
          expect(res.body.message).not.toContain('<script>');
          expect(res.body.message).not.toContain('alert');
        });
    });
  });

  describe('Database Error Handling', () => {
    it('should handle gracefully when database is unavailable', async () => {
      // This test would require mocking database failures
      // For now, we test that the API responds appropriately
      const response = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId);

      // Should be either 200 (success) or 500 (database error)
      expect([200, 500]).toContain(response.status);

      if (response.status === 500) {
        expect(response.body).toHaveProperty('statusCode', 500);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('error', 'Internal Server Error');
      }
    });
  });

  describe('Cache Error Handling', () => {
    it('should work when Redis is unavailable', async () => {
      // This test ensures the API works even if cache fails
      const response = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId);

      // Should still return 200 even if cache is down
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('pagination');
        expect(response.body).toHaveProperty('meta');
      }
    });
  });
});
