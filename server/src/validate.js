// Input validation + outbound fetch helpers (10 s timeout, no secrets logged).
export function badRequest(res, message) {
  return res.status(400).json({ error: 'bad_request', message });
}

export function reqString(value, { required = true, max = 10000, field = 'field' } = {}) {
  if (value === undefined || value === null) {
    if (required) return { error: `${field} is required` };
    return { value: undefined };
  }
  if (typeof value !== 'string') return { error: `${field} must be a string` };
  const trimmed = value.trim();
  if (required && !trimmed) return { error: `${field} must not be empty` };
  if (trimmed.length > max) return { error: `${field} is too long (max ${max} characters)` };
  return { value: trimmed };
}

export function reqEnum(value, allowed, { required = true, field = 'field' } = {}) {
  if (value === undefined || value === null) {
    if (required) return { error: `${field} is required` };
    return { value: undefined };
  }
  if (!allowed.includes(value)) {
    return { error: `${field} must be one of: ${allowed.join(', ')}` };
  }
  return { value };
}

export function reqStringArray(value, { required = false, maxItems = 10, allowed, field = 'field' } = {}) {
  if (value === undefined || value === null) {
    if (required) return { error: `${field} is required` };
    return { value: undefined };
  }
  if (!Array.isArray(value) || value.length === 0) {
    return { error: `${field} must be a non-empty array` };
  }
  if (value.length > maxItems) return { error: `${field} has too many items (max ${maxItems})` };
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) {
      return { error: `${field} must contain only non-empty strings` };
    }
    if (allowed && !allowed.includes(item.trim())) {
      return { error: `${field} contains an unsupported value: ${item}` };
    }
  }
  return { value: value.map((v) => v.trim()) };
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
