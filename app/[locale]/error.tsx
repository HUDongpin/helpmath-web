'use client';

import {ErrorRecovery} from '@/components/error-recovery';
import {useLocale} from '@/i18n/navigation';

type ErrorBoundaryProps = {
  error: Error & {digest?: string};
  reset: () => void;
  unstable_retry: () => void;
};

export default function LocalizedError({unstable_retry}: ErrorBoundaryProps) {
  const locale = useLocale();

  return <ErrorRecovery locale={locale} onRetry={unstable_retry} />;
}
