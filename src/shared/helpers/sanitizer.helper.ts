// Comprehensive regex matching sensitive keys and string values
const SENSITIVE_PATTERN =
  /(password|passwd|token|secret|pin|cvv|credential|auth|bearer|imei|apikey|api_key|privkey|privatekey)/i;

/**
 * Recursively redacts sensitive keys and sensitive string values in objects, arrays, and primitive strings.
 * Creates deep copies so in-memory request/response objects are never mutated.
 */
export function sanitizePayload<T>(data: T, parentKey = ''): T {
  if (data === null || data === undefined) {
    return data;
  }

  // 1. If the parent object key is sensitive (e.g. { currentPassword: "..." }), redact the entire value
  if (parentKey && SENSITIVE_PATTERN.test(parentKey)) {
    return '***REDACTED***' as unknown as T;
  }

  // 2. Handle Arrays
  if (Array.isArray(data)) {
    const cleanedArray = data.map(
      (item: string | object | number | boolean) => {
        if (typeof item === 'string' && SENSITIVE_PATTERN.test(item)) {
          return '***REDACTED***';
        }
        return sanitizePayload(item, parentKey);
      },
    );
    return cleanedArray as unknown as T;
  }

  // 3. Handle Plain Objects
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleanObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (SENSITIVE_PATTERN.test(key)) {
        cleanObj[key] = '***REDACTED***';
      } else {
        cleanObj[key] = sanitizePayload(value, key);
      }
    }
    return cleanObj as unknown as T;
  }

  // 4. Handle standalone sensitive string values
  if (typeof data === 'string' && SENSITIVE_PATTERN.test(data)) {
    return '***REDACTED***' as unknown as T;
  }

  return data;
}
