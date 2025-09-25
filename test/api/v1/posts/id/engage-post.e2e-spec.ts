import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from '../../../../setup-tests';

describe('Engage Post API (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef'; // UUID v7 format
  const anotherUserId = '01234567-89ab-7def-8123-456789abcde0'; // Different user
  let validPostId: string;

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();

    const postResponse = await request(app.getHttpServer())
      .post('/api/v1/posts')
      .set('X-User-Id', validUserId)
      .send({
        title: 'Test Post for Like Integration',
        content: 'This is a test post for like integration testing.',
        category: 'technology',
      })
      .expect(201);

    validPostId = postResponse.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Like Post Scenario', () => {
    it('should like a post for the first time', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/posts/${validPostId}/like`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('postId', validPostId);
      expect(response.body.data).toHaveProperty('engagementType', 'like');
      expect(response.body.data).toHaveProperty('success', true);
    });

    it('should be idempotent - like the same post again returns success', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/posts/${validPostId}/like`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('postId', validPostId);
      expect(response.body.data).toHaveProperty('engagementType', 'like');
      expect(response.body.data).toHaveProperty('success', true);
    });

    it('should verify like count is updated in post details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/posts/${validPostId}`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(response.body.data.engagement.likeCount).toBeGreaterThan(0);
      expect(response.body.data.engagement.userEngagement).toBe('like');
    });

    it('should handle multiple users liking the same post', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/posts/${validPostId}/like`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('engagementType', 'like');

      const postDetails = await request(app.getHttpServer())
        .get(`/api/v1/posts/${validPostId}`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      expect(postDetails.body.data.engagement.likeCount).toBeGreaterThanOrEqual(
        2,
      );
      expect(postDetails.body.data.engagement.userEngagement).toBe('like');
    });
  });

  describe('Dislike Post Scenario', () => {
    let dislikeTestPostId: string;

    beforeAll(async () => {
      const postResponse = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Test Post for Dislike Integration',
          content: 'This is a test post for dislike integration testing.',
          category: 'technology',
        })
        .expect(201);

      dislikeTestPostId = postResponse.body.data.id;
    });

    it('should successfully dislike a post with valid X-User-Id header', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/posts/${dislikeTestPostId}/dislike`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('postId', dislikeTestPostId);
      expect(response.body.data).toHaveProperty('engagementType', 'dislike');
      expect(response.body.data).toHaveProperty('success', true);
    });

    it('should return 401 when X-User-Id header is missing', () => {
      return request(app.getHttpServer())
        .put(`/api/v1/posts/${dislikeTestPostId}/dislike`)
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should return 400 when X-User-Id header is invalid UUID v7 format', () => {
      return request(app.getHttpServer())
        .put(`/api/v1/posts/${dislikeTestPostId}/dislike`)
        .set('X-User-Id', 'invalid-uuid')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('UUID v7');
        });
    });

    it("should return 404 when post ID doesn't exist", () => {
      const nonExistentPostId = '507f1f77bcf86cd799439011';
      return request(app.getHttpServer())
        .put(`/api/v1/posts/${nonExistentPostId}/dislike`)
        .set('X-User-Id', validUserId)
        .expect(404);
    });

    it('should return 400 when post ID is invalid ObjectId format', () => {
      const invalidPostId = 'invalid-post-id';
      return request(app.getHttpServer())
        .put(`/api/v1/posts/${invalidPostId}/dislike`)
        .set('X-User-Id', validUserId)
        .expect(400);
    });

    it('should increment dislike count when user dislikes a post', async () => {
      const initialResponse = await request(app.getHttpServer())
        .get(`/api/v1/posts/${dislikeTestPostId}`)
        .set('X-User-Id', validUserId)
        .expect(200);

      const initialDislikeCount =
        initialResponse.body.data.engagement.dislikeCount || 0;

      await request(app.getHttpServer())
        .put(`/api/v1/posts/${dislikeTestPostId}/dislike`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      const updatedResponse = await request(app.getHttpServer())
        .get(`/api/v1/posts/${dislikeTestPostId}`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      expect(updatedResponse.body.data.engagement.dislikeCount).toBe(
        initialDislikeCount + 1,
      );
      expect(updatedResponse.body.data.engagement.userEngagement).toBe(
        'dislike',
      );
    });

    it('should handle multiple users disliking the same post independently', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/posts/${dislikeTestPostId}/dislike`)
        .set('X-User-Id', validUserId)
        .expect(200);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/posts/${dislikeTestPostId}/dislike`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('engagementType', 'dislike');

      const postDetailsForUser1 = await request(app.getHttpServer())
        .get(`/api/v1/posts/${dislikeTestPostId}`)
        .set('X-User-Id', validUserId)
        .expect(200);

      const postDetailsForUser2 = await request(app.getHttpServer())
        .get(`/api/v1/posts/${dislikeTestPostId}`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      expect(postDetailsForUser1.body.data.engagement.userEngagement).toBe(
        'dislike',
      );
      expect(postDetailsForUser2.body.data.engagement.userEngagement).toBe(
        'dislike',
      );
      expect(
        postDetailsForUser1.body.data.engagement.dislikeCount,
      ).toBeGreaterThanOrEqual(2);
    });

    it('should be idempotent - dislike the same post again returns success', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/posts/${dislikeTestPostId}/dislike`)
        .set('X-User-Id', validUserId)
        .expect(200);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/posts/${dislikeTestPostId}/dislike`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('postId', dislikeTestPostId);
      expect(response.body.data).toHaveProperty('engagementType', 'dislike');
      expect(response.body.data).toHaveProperty('success', true);
    });

    it('should return proper response structure with updated engagement metrics', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/posts/${dislikeTestPostId}/dislike`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('postId');
      expect(response.body.data).toHaveProperty('engagementType');
      expect(response.body.data).toHaveProperty('success');

      const postDetails = await request(app.getHttpServer())
        .get(`/api/v1/posts/${dislikeTestPostId}`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(postDetails.body.data.engagement).toHaveProperty('likeCount');
      expect(postDetails.body.data.engagement).toHaveProperty('dislikeCount');
      expect(postDetails.body.data.engagement).toHaveProperty('userEngagement');
      expect(typeof postDetails.body.data.engagement.likeCount).toBe('number');
      expect(typeof postDetails.body.data.engagement.dislikeCount).toBe(
        'number',
      );
    });
  });

  describe('Like and Dislike Mutual Exclusivity', () => {
    let mutualExclusivityTestPostId: string;

    beforeAll(async () => {
      const postResponse = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Test Post for Mutual Exclusivity',
          content: 'This is a test post for mutual exclusivity testing.',
          category: 'technology',
        })
        .expect(201);

      mutualExclusivityTestPostId = postResponse.body.data.id;
    });

    it('should remove like when user dislikes a previously liked post', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/posts/${mutualExclusivityTestPostId}/like`)
        .set('X-User-Id', validUserId)
        .expect(200);

      const likedResponse = await request(app.getHttpServer())
        .get(`/api/v1/posts/${mutualExclusivityTestPostId}`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(likedResponse.body.data.engagement.userEngagement).toBe('like');
      expect(likedResponse.body.data.engagement.likeCount).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .put(`/api/v1/posts/${mutualExclusivityTestPostId}/dislike`)
        .set('X-User-Id', validUserId)
        .expect(200);

      const dislikedResponse = await request(app.getHttpServer())
        .get(`/api/v1/posts/${mutualExclusivityTestPostId}`)
        .set('X-User-Id', validUserId)
        .expect(200);

      expect(dislikedResponse.body.data.engagement.userEngagement).toBe(
        'dislike',
      );
      expect(
        dislikedResponse.body.data.engagement.dislikeCount,
      ).toBeGreaterThan(0);
      expect(dislikedResponse.body.data.engagement.likeCount).toBeLessThan(
        likedResponse.body.data.engagement.likeCount,
      );
    });

    it('should remove dislike when user likes a previously disliked post', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/posts/${mutualExclusivityTestPostId}/dislike`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      const dislikedResponse = await request(app.getHttpServer())
        .get(`/api/v1/posts/${mutualExclusivityTestPostId}`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      expect(dislikedResponse.body.data.engagement.userEngagement).toBe(
        'dislike',
      );
      expect(
        dislikedResponse.body.data.engagement.dislikeCount,
      ).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .put(`/api/v1/posts/${mutualExclusivityTestPostId}/like`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      const likedResponse = await request(app.getHttpServer())
        .get(`/api/v1/posts/${mutualExclusivityTestPostId}`)
        .set('X-User-Id', anotherUserId)
        .expect(200);

      expect(likedResponse.body.data.engagement.userEngagement).toBe('like');
      expect(likedResponse.body.data.engagement.likeCount).toBeGreaterThan(0);
      expect(likedResponse.body.data.engagement.dislikeCount).toBeLessThan(
        dislikedResponse.body.data.engagement.dislikeCount,
      );
    });

    it('should maintain accurate counts when multiple users engage differently', async () => {
      const user1 = '01234567-89ab-7def-8123-456789abcde2';
      const user2 = '01234567-89ab-7def-8123-456789abcde3';
      const user3 = '01234567-89ab-7def-8123-456789abcde4';

      await request(app.getHttpServer())
        .put(`/api/v1/posts/${mutualExclusivityTestPostId}/like`)
        .set('X-User-Id', user1)
        .expect(200);

      await request(app.getHttpServer())
        .put(`/api/v1/posts/${mutualExclusivityTestPostId}/dislike`)
        .set('X-User-Id', user2)
        .expect(200);

      await request(app.getHttpServer())
        .put(`/api/v1/posts/${mutualExclusivityTestPostId}/like`)
        .set('X-User-Id', user3)
        .expect(200);

      const finalResponse = await request(app.getHttpServer())
        .get(`/api/v1/posts/${mutualExclusivityTestPostId}`)
        .expect(200);

      expect(
        finalResponse.body.data.engagement.likeCount,
      ).toBeGreaterThanOrEqual(2);
      expect(
        finalResponse.body.data.engagement.dislikeCount,
      ).toBeGreaterThanOrEqual(1);

      const user1Response = await request(app.getHttpServer())
        .get(`/api/v1/posts/${mutualExclusivityTestPostId}`)
        .set('X-User-Id', user1)
        .expect(200);

      const user2Response = await request(app.getHttpServer())
        .get(`/api/v1/posts/${mutualExclusivityTestPostId}`)
        .set('X-User-Id', user2)
        .expect(200);

      const user3Response = await request(app.getHttpServer())
        .get(`/api/v1/posts/${mutualExclusivityTestPostId}`)
        .set('X-User-Id', user3)
        .expect(200);

      expect(user1Response.body.data.engagement.userEngagement).toBe('like');
      expect(user2Response.body.data.engagement.userEngagement).toBe('dislike');
      expect(user3Response.body.data.engagement.userEngagement).toBe('like');
    });
  });

  it('should update engagement timestamp', async () => {
    const initialResponse = await request(app.getHttpServer())
      .get(`/api/v1/posts/${validPostId}`)
      .expect(200);

    const initialEngagementTime = new Date(initialResponse.body.data.updatedAt);

    await new Promise((resolve) => setTimeout(resolve, 100));

    await request(app.getHttpServer())
      .put(`/api/v1/posts/${validPostId}/like`)
      .set('X-User-Id', validUserId)
      .expect(200);

    const updatedResponse = await request(app.getHttpServer())
      .get(`/api/v1/posts/${validPostId}`)
      .expect(200);

    const updatedEngagementTime = new Date(updatedResponse.body.data.updatedAt);

    expect(updatedEngagementTime.getTime()).toBeGreaterThanOrEqual(
      initialEngagementTime.getTime(),
    );
  });
});
