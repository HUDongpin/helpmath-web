import {PagesErrorPage} from '@/components/pages-error-page';

export const config = {runtime: 'nodejs', unstable_runtimeJS: false};

// Do not accept or render an Error, URL, query, digest, or stack. This fallback
// can be reached by any Pages Router failure and must stay safe to cache/share.
export default function PagesError() {
  return <PagesErrorPage kind="unavailable" />;
}
