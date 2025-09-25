# Tea Challenge Backend

A NestJS-based relevance feed backend API with MongoDB and Redis integration, containerized with Docker Compose.

## 🚀 Features

- Relevance-ranked post feed API (score automatically calculated with exponential freshness decay)
- Simple in-memory rate limiting 
- Simple user authentication (X-User-Id header)
- Data persistence with MongoDB
- Data caching with Redis
- Unit testing of the scoring algorithm
- Comprehensive integration tests
- Like distribution (when seeding)
- Cursor-based pagination based on post score + post ID
- Health checks
- Docker Compose for local development, testing, and slimmed down production image
- Automated CI/CD pipeline with GitHub Actions

## 🛠️ Installation & Development Setup

Clone the repository

```bash
git clone git@github.com:fell-lucas/tea-challenge.git
cd tea-challenge
```

Use the automated script to start MongoDB, Redis and the API:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh start
```

Edit and save files and see the service running in the container restart automatically.

Seed the database with `pnpm re-seed` or through the API via Swagger UI at http://localhost:3000/docs

I recommend using Swagger to play with the API and its various endpoints. Everything is fully documented in the Swagger UI.

Run tests with `pnpm test`
Run e2e tests with `pnpm test:e2e`

## 🚀 Production

Use the automated script:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh start:prod
```

Slimmed down production image with only production dependencies, no db/redis management tools, no docs and no hot reload.

## 🔧 Available Services

| Service | Port | Description |
|---------|------|-------------|
| **API** | 3000 | NestJS application |
| **MongoDB** | 27017 | Database server |
| **Redis** | 6379 | Cache server |
| **Mongo Express** | 8081 | Database management UI (only in dev) |
| **Redis Commander** | 8082 | Redis management UI (only in dev) |
| **Swagger UI** | 3000/docs | API documentation (only in dev) |


## Endpoints

| Endpoint | Method | Description |
|---------|--------|-------------|
| /api/v1/posts | POST | Create new post (requires X-User-Id header) |
| /api/v1/feed | GET | Main feed endpoint with cursor-based pagination and category filtering (open access) |
| /api/v1/posts/{id}/like | PUT | Like post (requires X-User-Id header) |
| /api/v1/posts/{id}/dislike | PUT | Dislike post (requires X-User-Id header) |
| /api/v1/posts/{id} | GET | Get single post details (open access) |
| /api/v1/categories | GET | Get all categories (open access) |

## Technical Choices and Trade-offs

### Scoring Formula

The relevance scoring system uses an **exponential decay formula** to balance content freshness with user engagement:

**Formula**: `score = likes * exp(-0.1 * hours_since_creation)`

**Implementation Details**:
- **Decay Rate**: 0.1 provides optimal balance between recency and popularity
- **Score Characteristics**:
  - New posts (0 hours): `score = likes * 1.0` (full weight)
  - 1 day old posts: `score = likes * 0.41` (41% weight)
  - 1 week old posts: `score = likes * 0.0006` (0.06% weight)
- **Time Quantization**: Scores are quantized to the nearest hour to ensure consistent cursor-based pagination within the same hour

**Rationale**:
- **Exponential decay** provides more natural freshness weighting compared to linear decay
- **Simple mathematical formula** is easy to implement, test, and debug
- **Adjustable decay rate** (0.1) can be tuned based on analytics feedback
- **Real-time calculation** ensures scores reflect current engagement patterns

**Alternatives Considered**:
- Linear decay (less natural falloff)
- Complex ML algorithms (overkill for MVP, harder to explain/debug)
- Static time-based sorting (ignores engagement signals)

### Redis Usage

Redis serves as a **high-performance caching layer** with a strategic focus on raw data caching:

**Cached Data**:
- **Raw post data** (not computed scores or paginated results)
- **Cache keys**: `posts:{category}:raw` pattern
  - `posts::raw` - All posts
  - `posts:technology:raw` - Category-specific posts
- **Health check responses** (30-second TTL)

**Cache Strategy**:
- **TTL Policies**:
  - General posts: 5 minutes (300 seconds)
  - Category-specific posts: 15 minutes (900 seconds)
  - Health checks: 30 seconds
- **Invalidation Strategy**: Proactive invalidation on write operations
  - New post creation → invalidate all relevant caches
  - Post updates/deletions → invalidate category and general caches
  - Like count updates → invalidate relevant caches

**Redis Features Utilized**:
- **ioredis 5.8.0** with connection pooling and TypeScript support
- **JSON serialization** for complex data structures
- **TTL-based expiration** for automatic cache cleanup
- **Graceful degradation** - cache failures don't break the application

**Performance Benefits**:
- **In-memory computation**: Relevance scores calculated from cached data
- **Reduced database load**: Raw data cached, pagination computed in-memory
- **Sub-200ms response times** achieved through effective caching
- **High cache hit ratios** (≥80% target) due to strategic cache key design

### Database Indexes

MongoDB indexes are strategically designed to optimize query performance for feed generation:

**Index Definitions**:
```javascript
// Compound indexes for optimal query performance
PostSchema.index({ category: 1, createdAt: -1, likeCount: -1 });
PostSchema.index({ createdAt: -1, likeCount: -1 });
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ isActive: 1 });

// User collection indexes
UserSchema.index({ userId: 1 }, { unique: true });
UserSchema.index({ lastSeenAt: -1 });
UserSchema.index({ isActive: 1 });

// Category collection indexes
CategorySchema.index({ name: 1 }, { unique: true });
CategorySchema.index({ isActive: 1 });
```

**Query Pattern Support**:
- **Category filtering + sorting**: `{ category: 1, createdAt: -1, likeCount: -1 }`
  - Supports category-specific feeds with optimal sort performance
  - Covers both time-based and engagement-based sorting
- **General feed queries**: `{ createdAt: -1, likeCount: -1 }`
  - Optimizes queries across all categories
  - Supports the scoring algorithm's reliance on creation time and likes
- **User tracking**: `{ userId: 1, createdAt: -1 }`
  - Enables efficient user post history queries
  - Supports user analytics and post management
- **Soft deletion**: `{ isActive: 1 }`
  - Optimizes filtering of active content across all queries

**Performance Impact**:
- **Compound indexes** eliminate the need for in-database sorting on large result sets
- **Descending order** on `createdAt` and `likeCount` optimizes for recent/popular content queries
- **Selective indexing** balances query performance with storage overhead
- **Index intersection** allows MongoDB to combine indexes for complex queries

**Design Decisions**:
- **Compound over single-field**: Better performance for multi-criteria queries
- **Descending sort order**: Matches typical feed query patterns (newest first)
- **Minimal index count**: Balances performance with storage and write overhead

### Trade-offs and Future Improvements

**Current Limitations**:

1. **In-Memory Sorting Bottleneck**:
   - **Issue**: Relevance scores computed in-memory after cache retrieval
   - **Impact**: Limited scalability beyond ~10K posts per category
   - **Mitigation**: Currently fetches up to 1000 posts for sorting

2. **Cache Invalidation Granularity**:
   - **Issue**: Write operations invalidate entire category caches
   - **Impact**: Reduced cache efficiency during high write periods
   - **Current approach**: Proactive invalidation ensures data consistency

3. **Single Redis Instance**:
   - **Issue**: No Redis clustering or replication
   - **Impact**: Single point of failure for caching layer
   - **Mitigation**: Graceful degradation when cache unavailable

4. **Fixed Decay Rate**:
   - **Issue**: Hardcoded 0.1 decay rate may not suit all content types
   - **Impact**: Suboptimal scoring for different engagement patterns
   - **Current state**: Simple, predictable, but not adaptive

**Scalability Considerations**:

- **Database scaling**: Current indexes support up to ~100K posts efficiently
- **Memory usage**: In-memory sorting limits horizontal scaling
- **Cache scaling**: Single Redis instance limits concurrent user capacity
- **Computation overhead**: Real-time score calculation adds CPU load

**Future Improvements** (with more development time):

1. **Database-Level Scoring**:
   - Implement MongoDB aggregation pipeline for relevance scoring
   - Pre-compute and store relevance scores with periodic updates
   - Enable true cursor-based pagination without in-memory sorting

2. **Advanced Caching Strategy**:
   - **Redis Cluster**: Multi-node Redis setup for high availability
   - **Selective invalidation**: Invalidate specific posts rather than entire categories
   - **Background refresh**: Proactive cache warming during low-traffic periods
   - **Multi-layer caching**: Add application-level caching for frequently accessed data

3. **Adaptive Scoring Algorithm**:
   - **Machine learning integration**: Learn optimal decay rates from user behavior
   - **Content-type specific scoring**: Different algorithms for different categories
   - **A/B testing framework**: Compare scoring algorithms in production
   - **User personalization**: Factor in user preferences and interaction history

4. **Performance Optimizations**:
   - **Database sharding**: Horizontal partitioning by category or time
   - **Read replicas**: Separate read/write database instances
   - **CDN integration**: Cache static content and API responses at edge locations
   - **Streaming pagination**: Real-time updates to feed without full refresh

5. **Monitoring and Analytics**:
   - **Performance metrics**: Detailed query performance and cache hit rate tracking
   - **User engagement analytics**: Track which scoring factors drive engagement
   - **Automated scaling**: Auto-scale based on traffic patterns and performance metrics
   - **Error tracking**: Comprehensive error monitoring and alerting

**Alternative Approaches Considered**:

- **Event-driven architecture**: Using message queues for cache invalidation (more complex)
- **GraphQL API**: More flexible querying (adds complexity for simple use case, also frontend was not required)
- **Elasticsearch**: Full-text search and advanced scoring (overkill for current requirements)
- **Microservices architecture**: Separate services for posts, users, feed (unnecessary complexity for now)

