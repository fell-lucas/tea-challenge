import { ApiProperty } from '@nestjs/swagger';
import type { CategoryName } from 'src/entities/category.entity';

export class FeedPostDto {
  @ApiProperty({
    description: 'Unique post identifier',
    example: '507f1f77bcf86cd799439011',
  })
  id!: string;

  @ApiProperty({
    description: 'Post title',
    maxLength: 200,
    example: 'Latest AI Breakthrough in Machine Learning',
  })
  title!: string;

  @ApiProperty({
    description: 'Post content (truncated to 200 characters for feed)',
    maxLength: 200,
    example:
      'Scientists have developed a new neural network architecture that significantly improves performance on natural language tasks. The breakthrough could revolutionize...',
  })
  content!: string;

  @ApiProperty({
    description: 'Post category display name',
    example: 'Technology',
  })
  category!: string;

  @ApiProperty({
    description: 'Post creation timestamp',
    example: '2025-01-23T10:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Number of likes',
    minimum: 0,
    example: 156,
  })
  likeCount!: number;

  @ApiProperty({
    description: 'Calculated relevance score',
    example: 142.3,
  })
  relevanceScore!: number;

  @ApiProperty({
    description: 'Optional post tags',
    type: [String],
    example: ['AI', 'machine-learning', 'research'],
  })
  tags?: string[];
}

export class PaginationInfoDto {
  @ApiProperty({
    description: 'Cursor for next page (null if no more pages)',
    example: '78.9_507f1f77bcf86cd799439012',
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({
    description: 'Cursor for previous page (null if first page)',
    example: '142.3_507f1f77bcf86cd799439010',
    nullable: true,
  })
  prevCursor!: string | null;

  @ApiProperty({
    description: 'Posts per page',
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: 'Estimated total number of posts',
    minimum: 0,
    example: 5000,
  })
  totalCount!: number;
}

export class ResponseMetaDto {
  @ApiProperty({
    description: 'Filter category (if applied)',
    example: 'technology',
    required: false,
  })
  category?: CategoryName;

  @ApiProperty({
    description: 'Whether raw data was served from cache',
    example: true,
  })
  cacheHit!: boolean;

  @ApiProperty({
    description: 'Response time in milliseconds',
    example: 45,
  })
  responseTime!: number;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2025-01-23T12:00:00.000Z',
  })
  timestamp!: string;
}

export class FeedResponseDto {
  @ApiProperty({
    description: 'Array of feed posts',
    type: [FeedPostDto],
  })
  data!: FeedPostDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationInfoDto,
  })
  pagination!: PaginationInfoDto;

  @ApiProperty({
    description: 'Response metadata',
    type: ResponseMetaDto,
  })
  meta!: ResponseMetaDto;
}

export function truncateContent(
  content: string,
  maxLength: number = 200,
): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Truncate to maxLength - 3 to account for "..."
  const truncated = content.substring(0, maxLength - 3);

  // Try to break at word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    // Only break at word if it's not too far back
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}
