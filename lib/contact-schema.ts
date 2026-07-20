import {z} from 'zod';

export const CONTACT_LIMITS = {
  name: 120,
  email: 254,
  organization: 160,
  message: 2_000,
  turnstileToken: 2_048,
  honeypot: 120,
} as const;

export const contactRoles = [
  'educator',
  'school-representative',
  'parent-guardian',
  'researcher',
  'former-partner',
  'other-adult',
] as const;

export const contactTopics = [
  'support',
  'account-access',
  'curriculum',
  'resources',
  'research',
  'accessibility',
  'collaboration',
  'project-history',
] as const;

const optionalTrimmedText = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .optional()
    .default('')
    .transform((value) => value.trim());

export const contactRequestSchema = z
  .object({
    locale: z.enum(['en', 'es']),
    role: z.enum(contactRoles),
    name: z.string().trim().min(1).max(CONTACT_LIMITS.name),
    email: z
      .string()
      .trim()
      .max(CONTACT_LIMITS.email)
      .email()
      .transform((value) => value.toLowerCase()),
    organization: optionalTrimmedText(CONTACT_LIMITS.organization),
    topic: z.enum(contactTopics),
    message: z.string().trim().min(20).max(CONTACT_LIMITS.message),
    privacyConsent: z.literal(true),
    turnstileToken: z.string().trim().min(1).max(CONTACT_LIMITS.turnstileToken),
    // This field is intentionally invisible to people. A value indicates an
    // automated submission; the route quietly accepts and discards it.
    website: optionalTrimmedText(CONTACT_LIMITS.honeypot),
  })
  .strict();

export type ContactRequest = z.infer<typeof contactRequestSchema>;

export type ContactField =
  | 'role'
  | 'name'
  | 'email'
  | 'organization'
  | 'topic'
  | 'message'
  | 'privacyConsent'
  | 'turnstileToken';

export function isContactTopic(value: string): value is (typeof contactTopics)[number] {
  return (contactTopics as readonly string[]).includes(value);
}

const topicAliases: Record<string, (typeof contactTopics)[number]> = {
  instruction: 'curriculum',
  'family-support': 'account-access',
  privacy: 'accessibility',
  permissions: 'collaboration',
  'accessible-resource': 'resources',
  'resource-about-help-math': 'resources',
  'resource-html5-proposal': 'resources',
  'resource-help-math-2-scope': 'resources',
  'modernization-notes': 'resources',
};

export function normalizeContactTopic(value: string) {
  if (isContactTopic(value)) return value;
  return topicAliases[value];
}
