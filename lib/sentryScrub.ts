import type { ErrorEvent } from '@sentry/react-native';

const REDACTED = '[Redacted]';
const SENSITIVE_KEY = /^(password|passwd|pwd|otp|token|refresh_?token|access_?token|authorization|cookie|set-cookie|jwt|secret|api[_-]?key)$/i;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const PHONE_PATTERN = /(?:\+?20|0)?1[0125]\d{8}/g;

function scrubString(value: string): string {
  return value.replace(JWT_PATTERN, REDACTED).replace(PHONE_PATTERN, REDACTED);
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) out[k] = REDACTED;
      else out[k] = scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

function scrubHeaders(headers: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!headers) return headers;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_KEY.test(k)) out[k] = REDACTED;
    else out[k] = typeof v === 'string' ? scrubString(v) : v;
  }
  return out;
}

export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    event.request.headers = scrubHeaders(event.request.headers) as typeof event.request.headers;
    event.request.cookies = undefined;
    if (event.request.data !== undefined) {
      event.request.data = scrubValue(event.request.data);
    }
    if (event.request.query_string && typeof event.request.query_string === 'string') {
      event.request.query_string = scrubString(event.request.query_string);
    }
  }
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  if (event.message) event.message = scrubString(event.message);
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value);
    }
  }
  return event;
}
