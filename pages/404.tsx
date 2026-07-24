import {PagesErrorPage} from '@/components/pages-error-page';

export const config = {runtime: 'nodejs', unstable_runtimeJS: false};

export default function PagesNotFound() {
  return <PagesErrorPage kind="not-found" />;
}
