import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from './setup-tests';

describe('Performance Tests (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef';
  const performanceThreshold = 200; // 200ms p95 requirement

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Feed Endpoint Performance', () => {
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

    it('should respond within 200ms for p95 (uncached)', async () => {
      const iterations = 20; // Fewer iterations for uncached tests
      const responseTimes: number[] = [];

      // Measure response times with different user IDs to avoid cache hits
      for (let i = 0; i < iterations; i++) {
        const testUserId = `01234567-89ab-7def-8123-45678${i.toString().padStart(7, '0')}`;
        const startTime = Date.now();

        await request(app.getHttpServer())
          .get('/api/v1/feed?limit=20')
          .set('X-User-Id', testUserId)
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

      const cursor = initialResponse.body.pagination.nextCursor;

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .get(`/api/v1/feed?limit=20&cursor=${cursor}`)
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

  describe('Post Creation Performance', () => {
    it('should create posts within performance threshold', async () => {
      const iterations = 50;
      const responseTimes: number[] = [];

      const postData = {
        title: 'Performance Test Post',
        content: 'This is a performance test post content',
        category: 'technology',
        tags: ['performance', 'test'],
      };

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .post('/api/v1/posts')
          .set('X-Skip-Rate-Limit', 'true')
          .set('X-User-Id', validUserId)
          .send({
            ...postData,
            title: `${postData.title} ${i}`,
          })
          .expect(201);

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95);
      const p95ResponseTime = responseTimes[p95Index];

      expect(p95ResponseTime).toBeLessThan(performanceThreshold);
    });
  });

  describe('Health Check Performance', () => {
    it('should respond to health checks quickly', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .get('/api/v1/health')
          .set('X-Skip-Rate-Limit', 'true')
          .expect(200);

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95);
      const p95ResponseTime = responseTimes[p95Index];

      expect(p95ResponseTime).toBeLessThan(50);
    });
  });
});
