import 'server-only';

import {handleContactRequest} from '@/lib/contact-route';
import {
  deliverContact,
  isContactDeliveryConfigured,
  resolveContactDeploymentFlagValue,
  verifyContactTurnstile,
} from '@/lib/contact-route-server';
import {areContactManifestGatesApproved} from '@/lib/launch-gates';
import {isLegalCopyReady} from '@/lib/legal-copy-readiness';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleContactRequest(request, {
    resolveRepositoryGateApproved: () =>
      areContactManifestGatesApproved() && isLegalCopyReady(),
    resolveDeploymentFlagValue: resolveContactDeploymentFlagValue,
    isDeliveryConfigured: isContactDeliveryConfigured,
    verifyTurnstile: verifyContactTurnstile,
    deliverContact,
  });
}
