import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserHeaderDto {
  @ApiProperty({
    description: 'User identifier in UUID v7 format',
    pattern:
      '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    example: '01234567-89ab-7def-8123-456789abcdef',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    {
      message: 'X-User-Id must be a valid UUID v7 format',
    },
  )
  userId!: string;
}

export function validateUUIDv7(uuid: string): boolean {
  const uuidV7Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV7Regex.test(uuid);
}
