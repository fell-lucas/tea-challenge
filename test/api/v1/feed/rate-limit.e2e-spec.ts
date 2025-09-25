import { getAppForTesting } from '../../../setup-tests';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Rate Limiting', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await getAppForTesting();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow requests under the rate limit (100 req/sec per IP)', async () => {
    const promises = Array.from({ length: 10 }, () =>
      request(app.getHttpServer()).get('/api/v1/feed').expect(200),
    );

    const responses = await Promise.all(promises);
    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });
  });

  it('should apply rate limiting per IP address', async () => {
    const requests = [];
    for (let i = 0; i < 150; i++) {
      requests.push(request(app.getHttpServer()).get('/api/v1/feed'));
    }

    const responses = await Promise.allSettled(requests);

    // Some requests should succeed, some should be rate limited
    const successfulRequests = responses.filter(
      (result) =>
        result.status === 'fulfilled' && (result.value as any).status === 200,
    );
    const rateLimitedRequests = responses.filter(
      (result) =>
        result.status === 'fulfilled' && (result.value as any).status === 429,
    );

    expect(successfulRequests.length).toBeGreaterThan(0);
    expect(rateLimitedRequests.length).toBeGreaterThan(0);
  });

  it('should include rate limit headers in response', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/feed')
      .expect(200);

    expect(response.headers).toHaveProperty('x-ratelimit-limit');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    expect(response.headers).toHaveProperty('x-ratelimit-reset');
  });
});
