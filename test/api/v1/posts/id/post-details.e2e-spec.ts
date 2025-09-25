import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from '../../../../setup-tests';

describe('Post Details API (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef';
  let validPostId: string;

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();

    const postResponse = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', validUserId)
      .send({
        title: 'Test Post for Details',
        content: 'This is a test post for details testing.',
        category: 'technology',
        tags: ['test', 'details'],
      })
      .expect(201);

    validPostId = postResponse.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Post Details with Engagement', () => {
    it('should return post details without user engagement for anonymous users', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/posts/${validPostId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', validPostId);
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('content');
      expect(response.body.data.engagement).toHaveProperty(
        'userEngagement',
        null,
      );
      expect(response.body.data.engagement).toHaveProperty('likeCount');
      expect(response.body.data.engagement).toHaveProperty('dislikeCount');
    });

    it('should include user engagement status for authenticated users', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/posts/${validPostId}/like`)
        .set('X-User-Id', validUserId)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/posts/${validPostId}`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(response.body.data.engagement.userEngagement).toBe('like');
      expect(response.body.data.engagement.likeCount).toBeGreaterThan(0);
    });

    it('should show null user engagement when user has not engaged', async () => {
      const anotherUserId = '01234567-89ab-7def-8123-456789abcde0';

      const response = await request(app.getHttpServer())
        .get(`/api/v1/posts/${validPostId}`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      expect(response.body.data.engagement.userEngagement).toBeNull();
    });
  });
});
