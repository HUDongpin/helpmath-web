import type {NextRequest} from 'next/server';

import {
  languageSwitchMethodNotAllowed,
  switchLanguage,
} from '@/lib/language-switch-route';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{locale: string}>;
};

export async function GET(request: NextRequest, {params}: RouteContext) {
  return switchLanguage(request, (await params).locale);
}

export const HEAD = GET;
export const DELETE = languageSwitchMethodNotAllowed;
export const OPTIONS = languageSwitchMethodNotAllowed;
export const PATCH = languageSwitchMethodNotAllowed;
export const POST = languageSwitchMethodNotAllowed;
export const PUT = languageSwitchMethodNotAllowed;
