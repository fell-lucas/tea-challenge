import { ApiProperty } from '@nestjs/swagger';

export class SeedDataDto {
  @ApiProperty({
    description: 'Number of posts created',
    example: 5000,
  })
  postsCreated!: number;

  @ApiProperty({
    description: 'Number of categories created',
    example: 10,
  })
  categoriesCreated!: number;

  @ApiProperty({
    description: 'Number of users created',
    example: 100,
  })
  usersCreated!: number;
}

export class SeedResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Seed data',
    type: SeedDataDto,
  })
  data!: SeedDataDto;
}
