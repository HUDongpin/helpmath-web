type JsonObject = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN =
  /(?:token|secret|password|passphrase|cookie|private.?key|authorization|credential|api.?key)/iu;
const CREDENTIAL_SHAPED_VALUE_PATTERN =
  /(?:Bearer\s+[A-Za-z0-9._~-]{16,}|Basic\s+[A-Za-z0-9+/=]{16,}|gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|vercel_[A-Za-z0-9]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|re_[A-Za-z0-9_-]{16,}|0x[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|https?:\/\/[^/\s:@]+:[^@\s/]+@|(?:token|secret|password|passphrase|api[_-]?key|authorization)=)/iu;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function inspectForSensitiveContent(
  value: unknown,
  field: string,
  errors: string[],
) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      inspectForSensitiveContent(entry, `${field}[${index}]`, errors),
    );
    return;
  }
  if (!isObject(value)) {
    if (typeof value === 'string' && CREDENTIAL_SHAPED_VALUE_PATTERN.test(value)) {
      errors.push(`${field} contains credential-shaped content`);
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      errors.push(`${field} contains sensitive field ${key}`);
    }
    inspectForSensitiveContent(entry, `${field}.${key}`, errors);
  }
}
