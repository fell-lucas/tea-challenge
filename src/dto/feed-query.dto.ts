import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  Matches,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import type { CategoryName } from 'src/entities/category.entity';

export class FeedQueryDto {
  @ApiProperty({
    description: 'Cursor for pagination (format: score_postId)',
    example: '123.45_507f1f77bcf86cd799439011',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?_[a-f0-9]{24}$/, {
    message:
      'Cursor must be in format: score_postId (e.g., 123.45_507f1f77bcf86cd799439011)',
  })
  cursor?: string;

  @ApiProperty({
    description: 'Number of posts per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter posts by category',
    enum: [
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
    ],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn([
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
  ])
  category?: CategoryName;
}

export interface ParsedCursor {
  score: number;
  postId: string;
}

export function parseCursor(cursor: string): ParsedCursor {
  const [scoreStr, postId] = cursor.split('_');
  return {
    score: parseFloat(scoreStr),
    postId,
  };
}

export function createCursor(score: number, postId: string): string {
  return `${score}_${postId}`;
}
