import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EngagementType } from '../entities/user-engagement.entity';

export class EngagementMetricsDto {
  @ApiProperty({
    description: 'Total number of likes',
    example: 42,
    minimum: 0,
  })
  likeCount!: number;

  @ApiProperty({
    description: 'Total number of dislikes',
    example: 3,
    minimum: 0,
  })
  dislikeCount!: number;

  @ApiPropertyOptional({
    description:
      "Current user's engagement (null if not authenticated or no engagement)",
    enum: EngagementType,
    example: EngagementType.LIKE,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(EngagementType)
  userEngagement?: EngagementType | null;
}

export class PostDetailsDto {
  @ApiProperty({
    description: 'Post unique identifier (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
  })
  id!: string;

  @ApiProperty({
    description: 'Post title',
    example: 'The Art of Tea Brewing',
  })
  title!: string;

  @ApiProperty({
    description: 'Post content',
    example: 'Tea brewing is both an art and a science...',
  })
  content!: string;

  @ApiProperty({
    description: "Author's user ID (UUID v7)",
    example: '01234567-89ab-cdef-0123-456789abcdef',
  })
  userId!: string;

  @ApiProperty({
    description: 'Category name',
    example: 'lifestyle',
  })
  category!: string;

  @ApiProperty({
    description: 'Post creation timestamp',
    example: '2025-09-24T10:30:00Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Post last update timestamp',
    example: '2025-09-24T10:30:00Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Post relevance score',
    example: 85.5,
  })
  relevanceScore!: number;

  @ApiProperty({
    description: 'Engagement metrics',
  })
  engagement!: EngagementMetricsDto;

  @ApiPropertyOptional({
    description: 'Post tags',
    example: ['brewing', 'tea', 'lifestyle'],
  })
  tags?: string[];

  @ApiProperty({
    description: 'Whether the post is active',
    example: true,
  })
  isActive!: boolean;
}

export class PostDetailsResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Post details data',
  })
  data!: PostDetailsDto;
}
