#!/usr/bin/env node

import {
  StableLinkError,
  checkStableLinks,
  loadStableLinkConfiguration,
} from "./stable-external-links-lib.mjs";

try {
  const registry = await loadStableLinkConfiguration();
  const summary = await checkStableLinks(registry.links, registry.requestPolicy);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.failed > 0) process.exitCode = 1;
} catch (caught) {
  const error =
    caught instanceof StableLinkError ? caught.code : "configuration-load-failed";
  process.stdout.write(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        outcome: "failed",
        error,
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
}
