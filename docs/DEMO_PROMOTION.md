# Demo promotion boundary

The live Flash migration workbench is outside this repository. Public builds
use the reviewed snapshot in `demos/` and the 12 approved PNG derivatives in
`public/flash-assets/`; they never import a live migration workspace.

To promote a later conversion:

1. Complete the workbench audit, deterministic keyframe capture, behavior
   tests, visual comparison, accessibility checks, and acceptance checklist.
2. Record source hashes, stage, FPS, frame count, validation status, and every
   known exception.
3. Copy only reviewed browser-native runtime files and derivative assets into
   this repository. Do not copy FLA, SWF, Ruffle, catalogs, or source paths.
4. Update `demos/SNAPSHOT.json` and its integrity test.
5. Keep the public label `conditional` until the strict migration gate is
   actually complete and owner-accepted.
6. Run the full Quality workflow and inspect the Vercel Preview before merge.

