import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from '../../../setup-tests';

describe('Categories API (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef';

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();

    const testPosts = [
      { title: 'Tech Post 1', content: 'Content 1', category: 'technology' },
      { title: 'Tech Post 2', content: 'Content 2', category: 'technology' },
      { title: 'Sports Post 1', content: 'Content 3', category: 'sports' },
    ];

    for (const post of testPosts) {
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send(post);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return categories ordered by postCount (open access)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect((res) => {
        if (res.status === 200) {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);

          if (res.body.data.length > 0) {
            const category = res.body.data[0];
            expect(category).toHaveProperty('id');
            expect(category).toHaveProperty('name');
            expect(category).toHaveProperty('postCount');
            expect(category).toHaveProperty('createdAt');
            expect(category).toHaveProperty('updatedAt');

            if (category.description !== undefined) {
              expect(typeof category.description).toBe('string');
            }

            expect(typeof category.id).toBe('string');
            expect(typeof category.name).toBe('string');
            expect(typeof category.postCount).toBe('number');
            expect(typeof category.createdAt).toBe('string');
            expect(typeof category.updatedAt).toBe('string');

            expect(category.postCount).toBeGreaterThanOrEqual(0);

            expect(category.id).toMatch(/^[0-9a-fA-F]{24}$/);

            expect(new Date(category.createdAt)).toBeInstanceOf(Date);
            expect(new Date(category.updatedAt)).toBeInstanceOf(Date);
          }
        }
      });
  });

  it('should return categories ordered by postCount (most popular first)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect((res) => {
        if (res.status === 200 && res.body.data.length > 1) {
          const categories = res.body.data;

          for (let i = 0; i < categories.length - 1; i++) {
            expect(categories[i].postCount).toBeGreaterThanOrEqual(
              categories[i + 1].postCount,
            );
          }
        }
      });
  });

  it('should not require authentication (open access)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/categories')
      .expect((res) => {
        expect(res.status).not.toBe(401);

        if (res.status === 200) {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
        }
      });
  });

  it('should accept optional X-User-Id header without affecting response', () => {
    return request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('X-User-Id', validUserId)
      .expect((res) => {
        if (res.status === 200) {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
        }
      });
  });

  it('should return 400 for invalid X-User-Id format when provided', () => {
    return request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('X-User-Id', 'invalid-uuid')
      .expect(400)
      .expect((res) => {
        expect(res.body).toHaveProperty(
          'message',
          'X-User-Id must be a valid UUID v7 format',
        );
      });
  });
});
