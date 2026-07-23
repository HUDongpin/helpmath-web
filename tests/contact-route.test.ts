import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildContactEmail,
  DEVELOPMENT_TURNSTILE_TOKEN,
  handleContactRequest,
  verifyTurnstile,
  type ContactRequestDependencies,
} from "../lib/contact-route";
import { contactRequestSchema } from "../lib/contact-schema";

const envKeys = [
  "NODE_ENV",
  "NEXT_PUBLIC_CONTACT_ENABLED",
  "NEXT_PUBLIC_SITE_URL",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_ALLOWED_HOSTNAMES",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "RESEND_API_KEY",
  "SUPPORT_TO_EMAIL",
  "SUPPORT_FROM_EMAIL",
] as const;
const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);
const originalFetch = globalThis.fetch;
function dependencies(
  resolveRepositoryGateApproved: () => boolean = () => true,
): ContactRequestDependencies {
  return {
    resolveRepositoryGateApproved,
    resolveDeploymentFlagValue: () =>
      process.env.NEXT_PUBLIC_CONTACT_ENABLED,
    isDeliveryConfigured: () =>
      Boolean(
        process.env.RESEND_API_KEY?.trim() &&
          process.env.SUPPORT_TO_EMAIL?.trim() &&
          process.env.SUPPORT_FROM_EMAIL?.trim(),
      ),
    verifyTurnstile: (token, remoteIp) =>
      verifyTurnstile(token, remoteIp, {
        secret: process.env.TURNSTILE_SECRET_KEY,
        environment: process.env.NODE_ENV,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        allowedHostnames: process.env.TURNSTILE_ALLOWED_HOSTNAMES,
        vercelUrl: process.env.VERCEL_URL,
        vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
        vercelProjectProductionUrl:
          process.env.VERCEL_PROJECT_PRODUCTION_URL,
        fetch: globalThis.fetch,
      }),
    deliverContact: async () => "failed",
  };
}
const POST = (request: Request) =>
  handleContactRequest(request, dependencies());

function setEnv(key: (typeof envKeys)[number], value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

function validRequest(overrides: Record<string, unknown> = {}) {
  return {
    locale: "en",
    role: "educator",
    name: "Ada Lovelace",
    email: "ada@example.org",
    organization: "Example School",
    topic: "support",
    message: "I need help opening a public demonstration.",
    privacyConsent: true,
    turnstileToken: "verified-token",
    website: "",
    ...overrides,
  };
}

function request(
  body: unknown,
  headers: Record<string, string | null> = {},
  url = "https://www.helpmath.ai/api/contact",
) {
  const requestHeaders = new Headers({
    "content-type": "application/json",
    origin: "https://www.helpmath.ai",
    "sec-fetch-site": "same-origin",
  });
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) requestHeaders.delete(name);
    else requestHeaders.set(name, value);
  }

  return new Request(url, {
    method: "POST",
    headers: requestHeaders,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function assertNoStore(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
}

beforeEach(() => {
  setEnv("NEXT_PUBLIC_CONTACT_ENABLED", "true");
});

afterEach(() => {
  for (const key of envKeys) {
    setEnv(key, originalEnv[key]);
  }
  globalThis.fetch = originalFetch;
});

describe("POST /api/contact", () => {
  it("fails closed when the deployment flag is true but the repository gate is holding", async () => {
    globalThis.fetch = async () => {
      throw new Error(
        "Turnstile must not be called while the repository gate is holding",
      );
    };

    const response = await handleContactRequest(
      request(validRequest()),
      dependencies(() => false),
    );
    const body = await response.json();
    assert.equal(response.status, 503);
    assertNoStore(response);
    assert.equal(body.error.code, "CONTACT_DISABLED");
  });

  it("addresses email to support and sets Reply-To to the validated sender", () => {
    const email = buildContactEmail(
      contactRequestSchema.parse(validRequest()),
      "HELP Math <support@helpmath.ai>",
      "team@helpmath.ai",
    );
    assert.deepEqual(email.to, ["team@helpmath.ai"]);
    assert.equal(email.replyTo, "ada@example.org");
    assert.doesNotMatch(email.text, /verified-token|turnstile/i);
  });

  it("keeps contact secrets and delivery code behind an explicit server-only boundary", () => {
    const serverSource = readFileSync("lib/contact-route-server.ts", "utf8");
    const requestSource = readFileSync("lib/contact-route.ts", "utf8");
    assert.match(serverSource, /import ["']server-only["']/u);
    assert.match(serverSource, /TURNSTILE_SECRET_KEY/u);
    assert.match(serverSource, /RESEND_API_KEY/u);
    assert.doesNotMatch(requestSource, /process\.env\.(?:TURNSTILE|RESEND)/u);
  });

  it("rejects header-injection addresses before they can become Reply-To", () => {
    for (const email of [
      "ada@example.org\r\nBcc: attacker@example.org",
      "ada@example.org\nReply-To: attacker@example.org",
    ]) {
      const parsed = contactRequestSchema.safeParse(validRequest({ email }));
      assert.equal(parsed.success, false, email);
    }
  });

  it("fails closed before parsing when contact intake is not explicitly enabled", async () => {
    setEnv("NEXT_PUBLIC_CONTACT_ENABLED", "false");
    globalThis.fetch = async () => {
      throw new Error("Turnstile must not be called while contact is disabled");
    };

    const response = await POST(
      request(validRequest(), { origin: null, "sec-fetch-site": null }),
    );
    const body = await response.json();
    assert.equal(response.status, 503);
    assertNoStore(response);
    assert.equal(body.error.code, "CONTACT_DISABLED");
  });

  it("allows a valid Origin with or without the optional fetch metadata header", async () => {
    setEnv("NODE_ENV", "production");
    delete process.env.TURNSTILE_SECRET_KEY;

    const validHeaders: Array<Record<string, string | null>> = [
      {},
      { "sec-fetch-site": null },
    ];
    for (const headers of validHeaders) {
      const response = await POST(request(validRequest(), headers));
      assert.equal(response.status, 503);
      assertNoStore(response);
      assert.equal(
        (await response.json()).error.code,
        "TURNSTILE_NOT_CONFIGURED",
      );
    }
  });

  it("fails closed on missing, null, malformed, or path-bearing Origin values", async () => {
    globalThis.fetch = async () => {
      throw new Error("Turnstile must not be called for a forbidden origin");
    };

    for (const origin of [
      null,
      "null",
      "not an origin",
      "https://www.helpmath.ai/forged-path",
      "https://attacker.example",
    ]) {
      const response = await POST(request("{not json", { origin }));
      const body = await response.json();
      assert.equal(response.status, 403, String(origin));
      assertNoStore(response);
      assert.equal(body.error.code, "CONTACT_FORBIDDEN");
    }
  });

  it("rejects same-site and cross-site fetch contexts before body parsing", async () => {
    globalThis.fetch = async () => {
      throw new Error(
        "Turnstile must not be called for a forbidden fetch context",
      );
    };

    for (const fetchSite of ["same-site", "cross-site", "none", ""]) {
      const response = await POST(
        request("{not json", { "sec-fetch-site": fetchSite }),
      );
      assert.equal(response.status, 403, fetchSite);
      assertNoStore(response);
      assert.equal((await response.json()).error.code, "CONTACT_FORBIDDEN");
    }

    const forged = await POST(
      request("{not json", {
        origin: "https://attacker.example",
        "sec-fetch-site": "same-origin",
      }),
    );
    assert.equal(forged.status, 403);
    assert.equal((await forged.json()).error.code, "CONTACT_FORBIDDEN");
  });

  it("accepts a validated Vercel forwarded origin without trusting malformed proxy headers", async () => {
    const forwarded = request(
      validRequest(),
      {
        "x-forwarded-host": "www.helpmath.ai",
        "x-forwarded-proto": "https",
      },
      "https://helpmath-web-internal.vercel.app/api/contact",
    );
    setEnv("NODE_ENV", "production");
    delete process.env.TURNSTILE_SECRET_KEY;
    const forwardedResponse = await POST(forwarded);
    assert.equal(forwardedResponse.status, 503);
    assert.equal(
      (await forwardedResponse.json()).error.code,
      "TURNSTILE_NOT_CONFIGURED",
    );

    for (const headers of [
      {
        "x-forwarded-host": "attacker.example@www.helpmath.ai",
        "x-forwarded-proto": "https",
      },
      {
        "x-forwarded-host": "www.helpmath.ai/path",
        "x-forwarded-proto": "https",
      },
      {
        "x-forwarded-host": "www.helpmath.ai",
        "x-forwarded-proto": "javascript",
      },
    ]) {
      const hostile = request(
        validRequest(),
        headers,
        "https://helpmath-web-internal.vercel.app/api/contact",
      );
      const response = await POST(hostile);
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, "CONTACT_FORBIDDEN");
    }
  });

  it("returns the same structured error envelope for malformed JSON", async () => {
    const response = await POST(request("{not json"));
    const body = await response.json();
    assert.equal(response.status, 400);
    assertNoStore(response);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "BAD_REQUEST");
    assert.equal(typeof body.error.message, "string");
  });

  it("rejects non-JSON and oversized request bodies before validation", async () => {
    const unsupported = await POST(
      request(JSON.stringify(validRequest()), { "content-type": "text/plain" }),
    );
    assert.equal(unsupported.status, 415);
    assertNoStore(unsupported);
    assert.equal(
      (await unsupported.json()).error.code,
      "UNSUPPORTED_MEDIA_TYPE",
    );

    const oversized = await POST(request(`"${"x".repeat(17_000)}"`));
    assert.equal(oversized.status, 413);
    assertNoStore(oversized);
    assert.equal((await oversized.json()).error.code, "PAYLOAD_TOO_LARGE");
  });

  it("returns field errors for invalid submissions", async () => {
    const response = await POST(
      request(validRequest({ email: "not-an-email" })),
    );
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.ok(body.error.fieldErrors.email);
  });

  it("quietly accepts and discards honeypot submissions", async () => {
    setEnv("NODE_ENV", "production");
    delete process.env.TURNSTILE_SECRET_KEY;
    const response = await POST(
      request(validRequest({ website: "https://bot.example" })),
    );
    assert.equal(response.status, 200);
    assertNoStore(response);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("fails closed when Turnstile is not configured in production", async () => {
    setEnv("NODE_ENV", "production");
    delete process.env.TURNSTILE_SECRET_KEY;
    const response = await POST(request(validRequest()));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, "TURNSTILE_NOT_CONFIGURED");
  });

  it("permits only the explicit local-development Turnstile simulation token", async () => {
    setEnv("NODE_ENV", "development");
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.RESEND_API_KEY;
    const response = await POST(
      request(validRequest({ turnstileToken: DEVELOPMENT_TURNSTILE_TOKEN })),
    );
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, "EMAIL_NOT_CONFIGURED");
  });

  it("does not treat arbitrary tokens as local-development verification", async () => {
    setEnv("NODE_ENV", "development");
    delete process.env.TURNSTILE_SECRET_KEY;
    const response = await POST(
      request(validRequest({ turnstileToken: "not-the-bypass" })),
    );
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, "TURNSTILE_NOT_CONFIGURED");
  });

  it("rejects a failed Turnstile verification before email delivery", async () => {
    setEnv("NODE_ENV", "production");
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    globalThis.fetch = async () => Response.json({ success: false });

    const response = await POST(
      request(validRequest(), { "x-forwarded-for": "203.0.113.8, 10.0.0.1" }),
    );
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.error.code, "TURNSTILE_FAILED");
  });

  it("rejects a successful token issued for a different Turnstile action", async () => {
    setEnv("NODE_ENV", "production");
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    globalThis.fetch = async () =>
      Response.json({ success: true, action: "login" });

    const response = await POST(request(validRequest()));
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.error.code, "TURNSTILE_FAILED");
  });

  it("rejects a successful token issued for a different hostname", async () => {
    setEnv("NODE_ENV", "production");
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    globalThis.fetch = async () =>
      Response.json({
        success: true,
        action: "contact",
        hostname: "attacker.example",
      });

    const response = await POST(request(validRequest()));
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.error.code, "TURNSTILE_FAILED");
  });

  it("verifies the Turnstile action and forwarded client address before delivery", async () => {
    setEnv("NODE_ENV", "production");
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    delete process.env.RESEND_API_KEY;
    let verificationBody = "";
    globalThis.fetch = async (input, init) => {
      assert.equal(
        String(input),
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      );
      verificationBody = String(init?.body);
      return Response.json({
        success: true,
        action: "contact",
        hostname: "www.helpmath.ai",
      });
    };

    const response = await POST(
      request(validRequest(), { "x-forwarded-for": "203.0.113.8, 10.0.0.1" }),
    );
    const body = await response.json();
    assert.match(verificationBody, /remoteip=203\.0\.113\.8/);
    assert.match(verificationBody, /response=verified-token/);
    assert.equal(response.status, 503);
    assert.equal(body.error.code, "EMAIL_NOT_CONFIGURED");
  });

  it("does not deliver when the repository gate closes during Turnstile verification", async () => {
    setEnv("NODE_ENV", "production");
    setEnv("TURNSTILE_SECRET_KEY", "test-secret");
    setEnv("RESEND_API_KEY", "test-resend-key");
    setEnv("SUPPORT_TO_EMAIL", "team@helpmath.ai");
    setEnv("SUPPORT_FROM_EMAIL", "HELP Math <support@helpmath.ai>");
    let repositoryGateApproved = true;
    let repositoryGateChecks = 0;
    let fetchCalls = 0;
    globalThis.fetch = async (input) => {
      fetchCalls += 1;
      assert.equal(
        String(input),
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        "Resend must not be called after the repository gate closes",
      );
      repositoryGateApproved = false;
      return Response.json({
        success: true,
        action: "contact",
        hostname: "www.helpmath.ai",
      });
    };

    const response = await handleContactRequest(
      request(validRequest()),
      dependencies(() => {
        repositoryGateChecks += 1;
        return repositoryGateApproved;
      }),
    );
    const body = await response.json();

    assert.equal(fetchCalls, 1);
    assert.equal(repositoryGateChecks, 2);
    assert.equal(response.status, 503);
    assertNoStore(response);
    assert.equal(body.error.code, "CONTACT_DISABLED");
  });

  it("accepts the Vercel branch URL as an injected preview hostname", async () => {
    setEnv("NODE_ENV", "production");
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.VERCEL_BRANCH_URL = "helpmath-git-review-example.vercel.app";
    delete process.env.RESEND_API_KEY;
    globalThis.fetch = async () =>
      Response.json({
        success: true,
        action: "contact",
        hostname: "helpmath-git-review-example.vercel.app",
      });

    const response = await POST(request(validRequest()));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, "EMAIL_NOT_CONFIGURED");
  });
});
