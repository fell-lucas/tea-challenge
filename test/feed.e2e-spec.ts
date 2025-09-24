import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from './setup-tests';

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

    it('should return 400 for invalid cursor format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed?cursor=invalid-cursor')
        .set('X-User-Id', validUserId)
        .expect(400)
        .expect((res) => {
          expect(res.body.message[0]).toContain('Cursor must be in format');
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
});
