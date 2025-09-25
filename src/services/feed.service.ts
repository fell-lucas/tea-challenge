import { Injectable, Logger } from '@nestjs/common';
import { PostService } from './post.service';
import { CategoryService } from './category.service';
import { CacheService } from './cache.service';
import {
  FeedQueryDto,
  ParsedCursor,
  parseCursor,
  createCursor,
} from '../dto/feed-query.dto';
import {
  FeedResponseDto,
  FeedPostDto,
  truncateContent,
} from '../dto/feed-response.dto';
import { type Post } from '../entities/post.entity';

interface CachedPostData {
  posts: (Post & { _id: string })[];
  totalCount: number;
}

interface PostWithScore extends Post {
  _id: string;
  relevanceScore: number;
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private postService: PostService,
    private categoryService: CategoryService,
    private cacheService: CacheService,
  ) {}

  async getFeed(query: FeedQueryDto): Promise<FeedResponseDto> {
    const startTime = Date.now();
    let cacheHit = false;

    try {
      // Parse cursor if provided
      let parsedCursor: ParsedCursor | undefined;
      if (query.cursor) {
        parsedCursor = parseCursor(query.cursor);
      }

      // Try to get from cache first
      const cacheKey = this.getCacheKey(query.category);
      let posts: (Post & { _id: string })[] = [];
      let totalCount = 0;

      const cachedData = await this.cacheService.get<CachedPostData>(cacheKey);
      if (cachedData) {
        cacheHit = true;
        posts = cachedData.posts;
        totalCount = cachedData.totalCount;
      } else {
        const result = await this.postService.findAll(query.category, 1000); // Get more for sorting
        posts = result.posts.map(
          (post) => post.toObject() as Post & { _id: string },
        );
        totalCount = result.totalCount;

        // Cache the raw data
        await this.cacheService.set(
          cacheKey,
          { posts, totalCount },
          this.getCacheTTL(query.category),
        );
      }

      // Calculate relevance scores and sort
      const postsWithScores: PostWithScore[] = posts
        .map((post) => ({
          ...post,
          relevanceScore: this.calculateRelevanceScore(post),
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Apply cursor-based pagination
      const paginatedResult = this.applyCursorPagination(
        postsWithScores,
        query,
        parsedCursor,
      );

      const responseTime = Date.now() - startTime;

      return {
        data: paginatedResult.data.map((post) =>
          this.transformToFeedPost(post),
        ),
        pagination: {
          nextCursor: paginatedResult.nextCursor,
          prevCursor: paginatedResult.prevCursor,
          limit: query.limit ?? 20,
          totalCount,
        },
        meta: {
          category: query.category,
          cacheHit,
          responseTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Error getting feed:', error);
      throw error;
    }
  }

  calculateRelevanceScore(post: Post & { _id: string }): number {
    // Quantize time to the nearest hour to ensure consistent scores within the same hour
    // This prevents cursor pagination issues caused by constantly changing scores
    // Using the hour is just an example, the quantization interval can be adjusted
    const HOUR_IN_MS = 1000 * 60 * 60;
    const currentTime = Date.now();
    const createdAt = new Date(post.createdAt);
    const quantizedTime = Math.floor(currentTime / HOUR_IN_MS) * HOUR_IN_MS;

    const hoursOld = (quantizedTime - createdAt.getTime()) / HOUR_IN_MS;
    const decayFactor = Math.exp(-0.1 * hoursOld);
    return post.likeCount * decayFactor;
  }

  applyCursorPagination(
    posts: PostWithScore[],
    query: FeedQueryDto,
    cursor?: ParsedCursor,
  ) {
    const limit = query.limit ?? 20;
    let startIndex = 0;

    if (cursor) {
      // Find the cursor post first, with small tolerance for floating-point precision
      const SCORE_TOLERANCE = 0.001;
      const cursorPostIndex = posts.findIndex(
        (post) =>
          Math.abs(post.relevanceScore - cursor.score) < SCORE_TOLERANCE &&
          post._id.toString() === cursor.postId,
      );

      if (cursorPostIndex !== -1) {
        // Start from the post immediately after the cursor post
        startIndex = cursorPostIndex + 1;
      } else {
        // If cursor post not found, find the first post that would come after it
        startIndex = posts.findIndex(
          (post) =>
            post.relevanceScore < cursor.score ||
            (post.relevanceScore === cursor.score &&
              post._id.toString() > cursor.postId),
        );
      }

      // If no post matches (cursor is beyond all posts), return empty results
      if (startIndex === -1 || startIndex >= posts.length) {
        return {
          data: [],
          nextCursor: null,
          prevCursor: null,
        };
      }
    }

    const endIndex = startIndex + limit;
    const data = posts.slice(startIndex, endIndex);

    const nextCursor =
      endIndex < posts.length && data.length > 0
        ? createCursor(
            data[data.length - 1].relevanceScore,
            data[data.length - 1]._id.toString(),
          )
        : null;

    let prevCursor: string | null = null;
    if (startIndex > 0) {
      // Calculate the boundaries of the previous page
      const prevPageEndIndex = startIndex;
      const prevPageStartIndex = Math.max(0, prevPageEndIndex - limit);

      if (prevPageStartIndex > 0) {
        // If there's a page before the previous page, use its last item as prevCursor
        const pageBeforePrevLastItem = posts[prevPageStartIndex - 1];
        prevCursor = createCursor(
          pageBeforePrevLastItem.relevanceScore,
          pageBeforePrevLastItem._id.toString(),
        );
      } else if (prevPageStartIndex === 0) {
        // Special case: we're on the second page, create a special cursor for first page
        // Use a cursor that will return the first page (before the first item)
        const firstPost = posts[0];
        // Create a cursor with a slightly higher score to ensure it returns from the beginning
        prevCursor = createCursor(
          firstPost.relevanceScore + 0.1,
          '000000000000000000000000',
        );
      }
    }

    return { data, nextCursor, prevCursor };
  }

  private transformToFeedPost(post: Post & { _id: string }): FeedPostDto {
    return {
      id: post._id.toString(),
      title: post.title,
      content: truncateContent(post.content, 200),
      category: this.categoryService.getDisplayName(post.category),
      createdAt: new Date(post.createdAt).toISOString(),
      likeCount: post.likeCount,
      relevanceScore: Math.round(post.relevanceScore * 10) / 10, // Round to 1 decimal
      tags: post.tags ?? [],
    };
  }

  getCacheKey(category?: string): string {
    return category ? `posts:${category}:raw` : 'posts::raw';
  }

  getCacheTTL(category?: string): number {
    return category ? 15 * 60 : 5 * 60; // 15 min for category, 5 min for general
  }

  async invalidateCache(): Promise<void> {
    try {
      // Invalidate all feed caches
      const keys = [
        'posts::raw',
        'posts:technology:raw',
        'posts:sports:raw',
        'posts:entertainment:raw',
        'posts:news:raw',
        'posts:lifestyle:raw',
        'posts:health:raw',
        'posts:travel:raw',
        'posts:food:raw',
        'posts:science:raw',
        'posts:business:raw',
      ];

      await Promise.all(keys.map((key) => this.cacheService.del(key)));
      this.logger.log('Invalidated all feed caches');
    } catch (error) {
      this.logger.error('Error invalidating cache:', error);
    }
  }
}
