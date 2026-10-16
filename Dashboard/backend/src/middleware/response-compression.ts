import type { NextFunction, Request, Response } from 'express';
import { gzipSync } from 'node:zlib';

const MIN_SIZE_BYTES = 1024;

/**
 * Compresses JSON responses with gzip when the client advertises support for it. The dashboard
 * predictions payload is several megabytes, so this cuts the transferred size substantially without
 * adding a dependency. Browsers decompress transparently.
 */
export function responseCompression(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const acceptEncoding = request.headers['accept-encoding'] ?? '';

  if (!/\bgzip\b/i.test(acceptEncoding)) {
    next();
    return;
  }

  const originalJson = response.json.bind(response);

  response.json = ((body: unknown) => {
    const json = JSON.stringify(body);

    if (json.length < MIN_SIZE_BYTES) {
      return originalJson(body);
    }

    const compressed = gzipSync(Buffer.from(json, 'utf8'));
    response.setHeader('Content-Encoding', 'gzip');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Vary', 'Accept-Encoding');
    return response.send(compressed);
  }) as unknown as Response['json'];

  next();
}
