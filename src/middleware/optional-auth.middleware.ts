import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { validateUUIDv7 } from '../dto/user-header.dto';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

@Injectable()
export class OptionalAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(OptionalAuthMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const userId = req.headers['x-user-id'] as string;

    // If no userId provided, continue without authentication
    if (!userId && userId !== '') {
      this.logger.debug(
        `No X-User-Id header provided for ${req.method} ${req.path} - continuing as anonymous`,
      );
      req.userId = undefined;
      next();
      return;
    }

    // If userId is provided, validate it
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
