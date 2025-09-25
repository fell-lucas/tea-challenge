import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from '../../../setup-tests';

describe('Posts API (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef'; // UUID v7 format

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const validPostData: {
    title?: string;
    content?: string;
    category: string;
    tags?: string[];
  } = {
    title: 'Test Post for Feed Ranking',
    content:
      'This is a test post to verify the feed ranking algorithm works correctly.',
    category: 'technology',
    tags: ['test', 'ranking', 'algorithm'],
  };

  it('should create a post with valid X-User-Id header', () => {
    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', validUserId)
      .send(validPostData)
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data).toHaveProperty('title', validPostData.title);
        expect(res.body.data).toHaveProperty('content', validPostData.content);
        expect(res.body.data).toHaveProperty('category');
        expect(res.body.data).toHaveProperty('createdAt');
        expect(res.body.data).toHaveProperty('updatedAt');
        expect(res.body.data.engagement).toHaveProperty('likeCount', 0);
        expect(res.body.data).toHaveProperty('tags');
        expect(res.body.data).toHaveProperty('isActive', true);
        expect(Array.isArray(res.body.data.tags)).toBe(true);
      });
  });

  it('should return 401 when X-User-Id header is missing', () => {
    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .send(validPostData)
      .expect(401)
      .expect((res) => {
        expect(res.body).toHaveProperty('statusCode', 401);
        expect(res.body).toHaveProperty('message');
      });
  });

  it('should return 400 when X-User-Id header is invalid UUID v7', () => {
    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', 'invalid-uuid')
      .send(validPostData)
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('UUID v7');
      });
  });

  it('should return 400 when title is missing', () => {
    const invalidData = { ...validPostData };
    delete invalidData.title;

    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', validUserId)
      .send(invalidData)
      .expect(400);
  });

  it('should return 400 when title is too long', () => {
    const invalidData = {
      ...validPostData,
      title: 'a'.repeat(201), // Exceeds 200 character limit
    };

    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', validUserId)
      .send(invalidData)
      .expect(400);
  });

  it('should return 400 when content is missing', () => {
    const invalidData = { ...validPostData };
    delete invalidData.content;

    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', validUserId)
      .send(invalidData)
      .expect(400);
  });

  it('should return 400 when content is too long', () => {
    const invalidData = {
      ...validPostData,
      content: 'a'.repeat(5001), // Exceeds 5000 character limit
    };

    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', validUserId)
      .send(invalidData)
      .expect(400);
  });

  it('should return 400 when category is invalid', () => {
    const invalidData = {
      ...validPostData,
      category: 'invalid-category',
    };

    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', validUserId)
      .send(invalidData)
      .expect(400);
  });

  it('should accept valid categories', async () => {
    const validCategories = [
      'technology',
      'sports',
      'entertainment',
      'news',
      'lifestyle',
      'health',
      'travel',
      'food',
      'science',
      'business',
    ];

    for (const category of validCategories) {
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({ ...validPostData, category })
        .expect(201);
    }
  });

  it('should accept posts without tags', () => {
    const dataWithoutTags = { ...validPostData };
    delete dataWithoutTags.tags;

    return request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', validUserId)
      .send(dataWithoutTags)
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.tags).toEqual([]);
      });
  });
});
