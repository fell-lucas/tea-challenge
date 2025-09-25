import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { validateUUIDv7 } from '../dto/user-header.dto';

@Injectable()
export class UserAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(UserAuthMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      this.logger.warn(
        `Missing X-User-Id header for ${req.method} ${req.path}`,
      );
      throw new BadRequestException('X-User-Id header is required');
    }

    if (!validateUUIDv7(userId)) {
      this.logger.warn(
        `Invalid X-User-Id format: ${userId} for ${req.method} ${req.path}`,
      );
      throw new BadRequestException('X-User-Id must be a valid UUID v7 format');
    }

    req.userId = userId;

    this.logger.debug(
      `Valid X-User-Id: ${userId} for ${req.method} ${req.path}`,
    );
    next();
  }
}
