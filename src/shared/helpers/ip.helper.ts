import { Request } from 'express';

/**
 * Extracts the real client IP address from the request headers or socket.
 * Inspects proxy/CDN headers in priority order (Cloudflare -> X-Real-IP -> X-Forwarded-For -> req.ip).
 */
export function getClientIp(req: Request): string {
  // 1. Cloudflare CDN client IP header
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && typeof cfIp === 'string') {
    return cfIp.trim();
  }

  // 2. Nginx / reverse proxy header
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.trim();
  }

  // 3. Standard X-Forwarded-For header (leftmost IP is the original client IP)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const clientIp = rawIp.split(',')[0]?.trim();
    if (clientIp) {
      return clientIp;
    }
  }

  // 4. Express req.ip (when trust proxy is enabled)
  if (req.ip) {
    return req.ip;
  }

  // 5. Socket remote address fallback
  return req.socket?.remoteAddress || 'UNKNOWN';
}
