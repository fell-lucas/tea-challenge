import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from './setup-tests';

describe('Authentication Integration (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef'; // UUID v7 format
  const anotherUserId = '01234567-89ab-7def-8123-456789abcde0'; // Another UUID v7

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('X-User-Id Header Validation', () => {
    it('should accept valid UUID v7 format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);
    });

    it('should reject invalid UUID formats', async () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '12345678-1234-1234-1234-123456789abc', // UUID v4 format
        '01234567-89ab-4def-8123-456789abcdef', // UUID v4 (version 4)
        '01234567-89ab-1def-8123-456789abcdef', // UUID v1 (version 1)
        'not-a-uuid-at-all',
        '',
        '01234567-89ab-7def-8123-456789abcdefg', // Too long
        '01234567-89ab-7def-8123-456789abcde', // Too short
      ];

      for (const invalidUUID of invalidUUIDs) {
        await request(app.getHttpServer())
          .get('/api/v1/feed')
          .set('X-User-Id', invalidUUID)
          .expect(400);
      }
    });

    it('should accept missing X-User-Id header', () => {
      return request(app.getHttpServer()).get('/api/v1/feed').expect(200);
    });
  });

  describe('User Tracking and Creation', () => {
    it('should automatically create user on first interaction if X-User-Id is provided', async () => {
      const newUserId = '01234567-89ab-7def-8123-456789abcde1';

      // First request should create the user
      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', newUserId)
        .expect(200);

      // Subsequent requests should work with the same user
      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', newUserId)
        .expect(200);
    });

    it('should track user activity across requests', async () => {
      // Make multiple requests with the same user ID
      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      // User should be tracked consistently
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Test Post',
          content: 'Test content for user tracking',
          category: 'technology',
        })
        .expect(201);
    });

    it('should handle multiple users independently', async () => {
      // Create posts with different users
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Post by User 1',
          content: 'Content by first user',
          category: 'technology',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', anotherUserId)
        .send({
          title: 'Post by User 2',
          content: 'Content by second user',
          category: 'sports',
        })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', anotherUserId)
        .expect(200);
    });
  });

  describe('User-Post Relationships', () => {
    it('should associate posts with the correct user', async () => {
      const postData = {
        title: 'User Association Test',
        content: 'This post should be associated with the user',
        category: 'technology',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send(postData)
        .expect(201);

      // The post should be created successfully
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(postData.title);
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages for authentication failures', () => {
      return request(app.getHttpServer())
        .post('/api/v1/posts')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });
});
