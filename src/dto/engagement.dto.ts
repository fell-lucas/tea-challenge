import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EngagementType } from '../entities/user-engagement.entity';

export class EngagementDataDto {
  @ApiProperty({
    description: 'Post MongoDB ID that was engaged with',
    example: '507f1f77bcf86cd799439011',
  })
  postId!: string;

  @ApiProperty({
    description: 'Type of engagement applied',
    enum: EngagementType,
    example: EngagementType.LIKE,
  })
  @IsEnum(EngagementType)
  engagementType!: EngagementType;

  @ApiProperty({
    description: 'Confirmation that engagement was processed',
    example: true,
  })
  success!: boolean;
}

export class EngagementResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Engagement data',
  })
  data!: EngagementDataDto;
}
