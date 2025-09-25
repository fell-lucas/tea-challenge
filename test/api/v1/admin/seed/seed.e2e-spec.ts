import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from '../../../../setup-tests';

/**
 * This test is skipped normally because the database is shared between all tests.
 */
describe('Seed API (e2e)', () => {
  let app: INestApplication;
  const postsToCreate = 5000;

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/admin/seed', () => {
    it('should invalidate cache, clear existing data and re-seed database successfully', () => {
      if (!process.env.RESEED) {
        return request(app.getHttpServer()).get('/api/v1/health');
      }

      return request(app.getHttpServer())
        .post(`/api/v1/admin/seed?totalPosts=${postsToCreate}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('postsCreated');
          expect(res.body).toHaveProperty('categoriesCreated');
          expect(res.body).toHaveProperty('usersCreated');
          expect(res.body).toHaveProperty('timestamp');

          expect(res.body.message).toBe('Database seeded successfully');
          expect(typeof res.body.postsCreated).toBe('number');
          expect(typeof res.body.categoriesCreated).toBe('number');
          expect(typeof res.body.usersCreated).toBe('number');
          expect(res.body.postsCreated).toBeGreaterThanOrEqual(postsToCreate);
          expect(res.body.categoriesCreated).toBe(10);
          expect(res.body.usersCreated).toBeGreaterThan(0);
        });
    }, 300000); // 5 minutes max
  });
});
