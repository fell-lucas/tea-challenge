import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from './setup-tests';

describe('Health API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('should return health status when services are healthy', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('dependencies');
          expect(res.body).toHaveProperty('memory');

          expect(res.body.dependencies).toHaveProperty('database');
          expect(res.body.dependencies).toHaveProperty('cache');

          expect(res.body.dependencies.database).toHaveProperty('status');
          expect(res.body.dependencies.database).toHaveProperty('responseTime');

          expect(res.body.dependencies.cache).toHaveProperty('status');
          expect(res.body.dependencies.cache).toHaveProperty('responseTime');

          expect(res.body.memory).toHaveProperty('used');
          expect(res.body.memory).toHaveProperty('total');
          expect(res.body.memory).toHaveProperty('percentage');

          expect(typeof res.body.uptime).toBe('number');
          expect(typeof res.body.memory.used).toBe('number');
          expect(typeof res.body.memory.total).toBe('number');
          expect(typeof res.body.memory.percentage).toBe('number');
        });
    });

    it('should include response time for each dependency', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(typeof res.body.dependencies.database.responseTime).toBe(
            'number',
          );
          expect(typeof res.body.dependencies.cache.responseTime).toBe(
            'number',
          );
          expect(
            res.body.dependencies.database.responseTime,
          ).toBeGreaterThanOrEqual(0);
          expect(
            res.body.dependencies.cache.responseTime,
          ).toBeGreaterThanOrEqual(0);
        });
    });

    it('should include memory usage information', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect(res.body.memory.percentage).toBeGreaterThan(0);
          expect(res.body.memory.percentage).toBeLessThanOrEqual(100);
          expect(res.body.memory.used).toBeGreaterThan(0);
          expect(res.body.memory.total).toBeGreaterThan(res.body.memory.used);
        });
    });
  });
});
