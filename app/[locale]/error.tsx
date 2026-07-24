'use client';

import {useParams} from 'next/navigation';

import {ErrorRecovery} from '@/components/error-recovery';
import type {Locale} from '@/content/types';

type ErrorBoundaryProps = {
  error: Error & {digest?: string};
  reset: () => void;
  unstable_retry: () => void;
};

export default function LocalizedError({unstable_retry}: ErrorBoundaryProps) {
  const params = useParams();
  const locale: Locale = params?.locale === 'es' ? 'es' : 'en';

  return <ErrorRecovery locale={locale} onRetry={unstable_retry} />;
}
