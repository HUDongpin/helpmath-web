type JsonObject = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN =
  /(?:token|secret|password|passphrase|cookie|private.?key|authorization|credential|api.?key)/iu;
const CREDENTIAL_SHAPED_VALUE_PATTERN =
  /(?:Bearer\s+[A-Za-z0-9._~-]{16,}|Basic\s+[A-Za-z0-9+/=]{16,}|gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|vercel_[A-Za-z0-9]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|re_[A-Za-z0-9_-]{16,}|0x[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|https?:\/\/[^/\s:@]+:[^@\s/]+@|(?:token|secret|password|passphrase|api[_-]?key|authorization)=)/iu;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function inspectForSensitiveContent(
  value: unknown,
  field: string,
  errors: string[],
) {
  const stack: Array<{ value: unknown; field: string; depth: number }> = [
    { value, field, depth: 0 },
  ];
  const seen = new WeakSet<object>();
  let visited = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    visited += 1;
    if (visited > 50_000) {
      errors.push(`${field} exceeds the supported 50000-node content limit`);
      return;
    }
    if (current.depth > 100) {
      errors.push(`${field} exceeds the supported 100-level nesting limit`);
      return;
    }
    if (typeof current.value === "object" && current.value !== null) {
      if (seen.has(current.value)) {
        errors.push(`${current.field} contains a cyclic object reference`);
        continue;
      }
      seen.add(current.value);
    }
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({
          value: current.value[index],
          field: `${current.field}[${index}]`,
          depth: current.depth + 1,
        });
      }
      continue;
    }
    if (!isObject(current.value)) {
      if (
        typeof current.value === "string" &&
        CREDENTIAL_SHAPED_VALUE_PATTERN.test(current.value)
      ) {
        errors.push(`${current.field} contains credential-shaped content`);
      }
      continue;
    }
    const entries = Object.entries(current.value);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, entry] = entries[index];
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        errors.push(`${current.field} contains sensitive field ${key}`);
      }
      stack.push({
        value: entry,
        field: `${current.field}.${key}`,
        depth: current.depth + 1,
      });
    }
  }
}
