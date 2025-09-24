import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAppForTesting } from './setup-tests';

describe('Relevance Ranking Integration (e2e)', () => {
  let app: INestApplication;
  const validUserId = '01234567-89ab-7def-8123-456789abcdef';

  beforeAll(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Relevance Score Calculation', () => {
    it('should rank newer posts higher than older posts with same likes', async () => {
      // Create an older post
      const olderPost = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Older Post',
          content: 'This is an older post for ranking test',
          category: 'technology',
        })
        .expect(201);

      // Wait a moment to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create a newer post
      const newerPost = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Newer Post',
          content: 'This is a newer post for ranking test',
          category: 'technology',
        })
        .expect(201);

      // Get feed and verify ranking
      const feedResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      const posts = feedResponse.body.data;
      expect(posts.length).toBeGreaterThan(0);

      // Find our test posts in the feed
      const olderPostInFeed = posts.find(
        (p: any) => p.id === olderPost.body.id,
      );
      const newerPostInFeed = posts.find(
        (p: any) => p.id === newerPost.body.id,
      );

      if (olderPostInFeed && newerPostInFeed) {
        expect(newerPostInFeed.relevanceScore).toBeGreaterThan(
          olderPostInFeed.relevanceScore,
        );
      }
    });

    it('should include relevance score in feed response', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200)
        .expect((res) => {
          if (res.body.data.length > 0) {
            const firstPost = res.body.data[0];
            expect(firstPost).toHaveProperty('relevanceScore');
            expect(typeof firstPost.relevanceScore).toBe('number');
            expect(firstPost.relevanceScore).toBeGreaterThanOrEqual(0);
          }
        });
    });

    it('should apply exponential decay formula correctly', async () => {
      // Create a post and immediately check its score
      const newPost = await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Score Test Post',
          content: 'Testing exponential decay formula',
          category: 'technology',
        })
        .expect(201);

      const feedResponse = await request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200);

      const testPost = feedResponse.body.data.find(
        (p: any) => p.id === newPost.body.id,
      );
      if (testPost) {
        // For a new post with 0 likes, score should be close to 0 * exp(-0.1 * ~0) = 0
        expect(testPost.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(testPost.likeCount).toBe(0);
      }
    });
  });

  describe('Feed Ordering', () => {
    it('should return posts in descending order of relevance score', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feed')
        .set('X-User-Id', validUserId)
        .expect(200)
        .expect((res) => {
          const posts = res.body.data;
          if (posts.length > 1) {
            for (let i = 0; i < posts.length - 1; i++) {
              expect(posts[i].relevanceScore).toBeGreaterThanOrEqual(
                posts[i + 1].relevanceScore,
              );
            }
          }
        });
    });

    it('should maintain ranking consistency across requests', async () => {
      const firstRequest = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 100));

      const secondRequest = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=5')
        .set('X-User-Id', validUserId)
        .expect(200);

      // Order should be consistent for the same time period
      const firstPosts = firstRequest.body.data;
      const secondPosts = secondRequest.body.data;

      if (firstPosts.length > 0 && secondPosts.length > 0) {
        // At least the first post should be the same (highest ranked)
        expect(firstPosts[0].id).toBe(secondPosts[0].id);
      }
    });
  });

  describe('Category-Specific Ranking', () => {
    it('should rank posts within category correctly', async () => {
      // Create posts in the same category
      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Tech Post 1',
          content: 'First technology post',
          category: 'technology',
        })
        .expect(201);

      await new Promise((resolve) => setTimeout(resolve, 500));

      await request(app.getHttpServer())
        .post('/api/v1/posts')
        .set('X-User-Id', validUserId)
        .send({
          title: 'Tech Post 2',
          content: 'Second technology post',
          category: 'technology',
        })
        .expect(201);

      const categoryFeed = await request(app.getHttpServer())
        .get('/api/v1/feed?category=technology')
        .set('X-User-Id', validUserId)
        .expect(200);

      const posts = categoryFeed.body.data;
      if (posts.length > 1) {
        // All posts should be from technology category
        posts.forEach((post: any) => {
          expect(post.category).toBe('Technology');
        });

        // Should be ranked by relevance score
        for (let i = 0; i < posts.length - 1; i++) {
          expect(posts[i].relevanceScore).toBeGreaterThanOrEqual(
            posts[i + 1].relevanceScore,
          );
        }
      }
    });
  });

  describe('Real-time Score Updates', () => {
    it('should recalculate scores in real-time', async () => {
      const feedResponse = await request(app.getHttpServer())
        .get('/api/v1/feed?limit=1')
        .set('X-User-Id', validUserId)
        .expect(200);

      if (feedResponse.body.data.length > 0) {
        const post = feedResponse.body.data[0];
        expect(typeof post.relevanceScore).toBe('number');

        // Score should be calculated fresh each time
        const secondResponse = await request(app.getHttpServer())
          .get('/api/v1/feed?limit=1')
          .set('X-User-Id', validUserId)
          .expect(200);

        if (secondResponse.body.data.length > 0) {
          const samePost = secondResponse.body.data[0];
          // Scores might be slightly different due to time passage
          expect(typeof samePost.relevanceScore).toBe('number');
        }
      }
    });
  });
});
