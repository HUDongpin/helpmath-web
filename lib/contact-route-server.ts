import "server-only";

import { Resend } from "resend";
import {
  buildContactEmail,
  verifyTurnstile,
  type ContactDeliveryStatus,
  type TurnstileRuntimeConfig,
  type TurnstileVerificationStatus,
} from "@/lib/contact-route";
import type { ContactRequest } from "@/lib/contact-schema";

function turnstileRuntimeConfig(): TurnstileRuntimeConfig {
  return {
    secret: process.env.TURNSTILE_SECRET_KEY,
    environment: process.env.NODE_ENV,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    allowedHostnames: process.env.TURNSTILE_ALLOWED_HOSTNAMES,
    vercelUrl: process.env.VERCEL_URL,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
    vercelProjectProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    fetch: globalThis.fetch,
  };
}

export function resolveContactDeploymentFlagValue() {
  return process.env.NEXT_PUBLIC_CONTACT_ENABLED;
}

export function verifyContactTurnstile(
  token: string,
  remoteIp: string | undefined,
): Promise<TurnstileVerificationStatus> {
  return verifyTurnstile(token, remoteIp, turnstileRuntimeConfig());
}

export function isContactDeliveryConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.SUPPORT_TO_EMAIL?.trim() &&
      process.env.SUPPORT_FROM_EMAIL?.trim(),
  );
}

export async function deliverContact(
  payload: ContactRequest,
): Promise<ContactDeliveryStatus> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.SUPPORT_TO_EMAIL?.trim();
  const from = process.env.SUPPORT_FROM_EMAIL?.trim();
  if (!apiKey || !to || !from) return "not-configured";

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send(
      buildContactEmail(payload, from, to),
    );
    return result.error ? "failed" : "delivered";
  } catch {
    return "failed";
  }
}
