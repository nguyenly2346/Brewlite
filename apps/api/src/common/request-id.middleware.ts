import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

// Chỉ chấp nhận id do client gửi nếu ngắn và chỉ gồm ký tự an toàn
// (tránh log injection); ngược lại tự sinh UUID mới.
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

const logger = new Logger('HTTP');

export function resolveRequestId(incoming: unknown): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  return typeof value === 'string' && SAFE_ID.test(value) ? value : randomUUID();
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  (req as Request & { id?: string }).id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    // Chỉ log path (không log query string, header Authorization, body)
    const path = req.originalUrl.split('?')[0];
    const line = `[${requestId}] ${req.method} ${path} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });

  requestContext.run({ requestId }, next);
}
