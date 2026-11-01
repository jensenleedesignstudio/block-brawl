# Release audit — 29 October 2026

Maintenance update, 30 October 2026: the code-style cleanup described below supersedes the original test count and file inventory. The release blockers remain unchanged.

Final automated verification, 30 October 2026: `npm run verify` passes ESLint, TypeScript unused-code checks, production compilation/build and all 123 tests, with zero failures or skips. The style gate now also enforces semicolons and final newlines. `npm run ml:check` completes a full simulated match and verifies seeded resets, action masks and bridge cleanup; the running model service passes prediction/schema/mask/origin checks. The production dependency audit reports zero known vulnerabilities. Python syntax trees and model fingerprints remain valid, and 55 formatting-only JavaScript/TypeScript comparisons remain equivalent. A limited credential-pattern scan found no matches in the public build. README now contains a reviewer-oriented source map and the single-command verification procedure. No gameplay changes or publication occurred during this final verification; the previously documented hosted-AI, fourth camera recovery and platform-verification blockers still prevent full public-release sign-off. Manual browser/device testing was not repeated in this final pass.

Status: **local release candidate; full public release is not yet signed off.** Nothing was published, deployed, purchased, or made newly public during this audit.

## Architecture and scope

The existing React 19 / TypeScript / Vite client renders its Canvas 2D arena independently of a 60 Hz combat simulation. Local CPU matches use the installed Python MaskablePPO service; the Node / Express / Socket.IO server owns online match simulation. MediaPipe runs camera inference locally in a worker. Fighters use the existing sprite rigs, the gym uses existing photographic materials and projected geometry, and the floating corner, toolbar and tool tabs remain intact.

Reviewed setup, toolbar, health/guard/stamina HUD, timer menu, results/rematch, guide, settings, Move Lab, Fighters, session history, party connection flow, input release handling, camera cleanup, rendering presentation, audio lifecycle, model availability, production serving, assets and dependency metadata. Existing rendering, combat, motion recognition and AI policy code were retained.

## Findings and fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | Installed body-parser 2.3.0 had an npm advisory (GHSA-27r3-jxmh-p828). | Updated only this transitive dependency to compatible 2.4.0. Final production npm audit reports zero known vulnerabilities. |
| Medium | Tool tabs covered the arena while keyboard/camera input could still reach combat. | Treat tools/results as input-blocking overlays; local matches pause while tools cover the ring. Online simulation continues as before. |
| Medium | Guard/movement release could be discarded after an overlay opened; blur did not clear movement. | Allow only release/stop commands through the overlay gate and release movement on blur. Combat controls and action timing are unchanged. |
| Medium | Disconnected lobby guests could occupy a seat indefinitely while their host stayed connected. | Clear abandoned lobby seats after the existing 20-second reconnect grace; notify the remaining fighter of their index. Active-match disconnect rules are untouched. |
| Medium | Late online snapshots could update a client after it left its party. | Ignore room updates for other party codes and snapshots when no session exists. |
| Medium | A failed multiplayer script load left setup with no retry action. | Added Retry connection to the existing party setup. Socket.IO's normal reconnect still handles established connections. |
| Medium | At tablet widths, reserving two sidebar widths squeezed the centered scorecards. | Give scorecards full available width at 761–1100 px; move the existing corner and camera below their row. This CSS change still needs device-level visual sign-off. |
| Low | Long party names could crowd connection status. | Truncate the displayed name with a full-name tooltip; keep status visible. |
| Low | Audio context creation could throw and prevent a match start on unsupported/unavailable audio devices. | Audio initialization now fails gracefully; completed effect nodes disconnect. |
| Low | Fingerprinted JS/CSS were not explicitly cached immutably. | Cache only Vite fingerprinted assets for one year; HTML and unversioned art retain revalidation. |
| Low | Documentation still described a neon arena, old button names and playable standalone AI exports. | Updated descriptions to the actual gym, current controls, top-left camera and trained-only server requirement. Updated metadata/theme color, font preconnects, minimum Node version and environment-file ignores. |

The initial tool-tab ID concern did **not** reproduce on code inspection; no ID rewrite was needed. No new visual assets, effects, gameplay modes, dependencies or narration were added.

## Gameplay preservation

SHA-256 fingerprints of all seven existing files in `shared/` and `src/motion/` match the pre-audit checkpoint at `/tmp/boxing-release-checkpoint/protected.json`. Combat rules, AI policies, motion detectors, damage, hitboxes, movement, attack/recovery frames, stamina, health, timers and win conditions were not edited. Rendering geometry, animation timing and existing art were not changed. The only input-flow changes prevent unintended combat behind overlays and clear held inputs after interruption.

The current values remain 135 HP, one 120-second round, 60 HP on successful recovery, and recovery goals 20 / 60 / 100 / 200 (200 from the fourth knockdown onward). Spoken narration remains disconnected.

## Verification

- Production build, TypeScript client/server compilation and ESLint pass.
- `npm test`: **128 passing, zero failing or skipped** (108 core tests plus 20 TypeScript tests). The default command now includes previously separate learning, action-echo, material and invite checks, plus new audio and production checks.
- Real local Socket.IO tests cover party creation, code validation, vacant seat reuse, host transfer, disconnected lobby seat expiry, ready gating, authoritative combat, reconnect, rematch and motion-mode behavior.
- Production HTTP checks verify HTML, JS/CSS, referenced art, favicon, pose worker and SIMD/non-SIMD MediaPipe files; cache and content-type headers; health endpoint; and 404 responses for private/source paths.
- Model-service checks pass for valid masked predictions, schema/action-mask rejection and local-origin restrictions.
- All source-referenced art paths exist. A limited private-key / common-token-pattern scan of public/build text assets found no matches; this is not a comprehensive security assessment.
- Desktop Chrome manual smoke test: settings open/close and fullscreen preference, AI start and damage, Move Lab filters, Fighters selection disabled during a match, tool navigation, timer pause menu, Resume, natural knockdown and knockout, defeat result, Rematch resetting both fighters to 135 HP, Exit Match restoring setup, guide, and a completed result in session history. Browser automation initially failed; an isolated native Chrome window allowed these later checks.
- `git diff --check` passes. No FPS improvement claim is made: changes avoid extra visual effects and improve resource/cache handling, but device performance was not benchmarked.

## Remaining launch blockers and limits

1. **Hosted CPU play:** the frontend now supports `VITE_MODEL_URL` and the Python service supports exact allowed origins via `MODEL_ALLOWED_ORIGINS` / `--allowed-origin`. Local development retains its loopback default; unconfigured public builds no longer contact visitors' loopback services. The backend, compatible weights and HTTPS endpoint still need to be provisioned, then the Vercel frontend must be rebuilt with that endpoint. The existing Docker image contains multiplayer/client only, not Python or weights. No hosted endpoint has been supplied or deployed here. No scripted fallback was introduced.
2. **Fourth camera recovery:** the existing 80 ms recovery output limit permits at most about 125 inputs in the 10-second window, below the requested 200. Left untouched because changing the target, time window or detector rate changes gameplay. Keyboard recovery remains the available route; its extreme speed requirement is also unchanged.
3. **Device/browser sign-off:** no successful mobile/tablet emulation capture, physical-device test, Safari/Firefox test, full camera-calibrated match, fullscreen-permission fallback test or screen-reader session was completed in this pass. Native keyboard Escape automation was inconclusive; timer-click pause/resume/exit was verified. Long-duration memory/FPS, high-latency internet and load tests remain unperformed.
4. **Hosting operations:** parties are in memory, require one Node instance, and vanish on restart. HTTP health/assets were tested locally; Docker execution, HTTPS/WebSocket hosting and a real cross-internet friend match remain unverified. Camera models need an initial Google download; fonts have local fallbacks. Settings and the last-five history remain session-only as before; page-refresh party recovery is not implemented.

## Files changed in this pass

| Files | Purpose |
| --- | --- |
| `src/App.tsx` | Overlay/input release guards, tool pause, party retry, late-snapshot guards, readable party names and standalone guidance. |
| `src/game-shell.css` | Tablet scorecard clearance and party name/status overflow. |
| `src/components/Arena.tsx` | Clear paused-state resume instruction. |
| `src/components/CircuitRoster.tsx` | Match existing VS CPU label. |
| `src/components/MotionCamera.tsx`, `src/network.ts` | Correct standalone/server requirement messages only. |
| `src/game/audio.ts` | Graceful audio availability and effect cleanup. |
| `server/index.ts` | Disconnected lobby cleanup, fingerprinted asset caching and response headers. |
| `index.html` | Current metadata/theme color and font preconnects. |
| `package.json`, `package-lock.json` | Comprehensive default tests, minimum Node version and targeted security patch. |
| `.gitignore` | Exclude environment variants while retaining the example. |
| `tests/audio.test.ts`, `tests/production.test.ts`, `tests/network.test.ts` | Meaningful audio, production and lobby regression coverage. |
| `README.md`, `docs/release-readiness.md` | Accurate usage and release status/evidence. |

Before approval to release, resolve the hosted-model and recovery requirements, complete the unverified supported-platform checks, rerun `npm run build`, `npm run lint`, `npm test`, and `npm audit --omit=dev`, then explicitly approve the chosen deployment. These commands do not publish the game.

## Code-style cleanup — 30 October 2026

Applied the conventions present in the project: four-space indentation, double quotes, semicolons, spaced named-function/method parentheses, readable multiline expressions and consistent section spacing. Added `.editorconfig`, documented the conventions in README, and added ESLint checks for quotes, function spacing and trailing spaces. A pinned formatter was used temporarily; no formatter dependency was added to the project. Prior chats outside this conversation were unavailable, and no additional style preferences were provided during this pass.

Removed six verified obsolete files: the disconnected narrator and its two tests (`src/game/announcer.ts`, `tests/announcer.test.mjs`), the unimported illustration (`src/components/StreetIllustration.tsx`), the command dock hidden by the permanent game shell (`src/components/ArenaCommands.tsx`), the retired tactical helper (`shared/hard-tactics.ts`) and its three isolated tests, and the offline exporter incompatible with trained-only play (`scripts/export-offline.mjs`). Updated imports and test lists accordingly. Also removed unused scouting-profile fields and 125 CSS selector branches belonging exclusively to retired UI.

Validation: build, lint, TypeScript unused-local/parameter checks, and all **123 remaining tests** pass. The five removed tests belonged only to the deleted narrator/tactical modules; active combat and motion regression coverage remains. Syntax-tree comparisons confirm equivalent executable structure in 55 files changed only by formatting; all Python ASTs also match. The challenger card returns identical React output for 36 prop combinations after removing its unused data. All 16 stylesheet comparisons preserve the remaining CSS after accounting for retired selectors and equivalent custom-property whitespace. No modules remain outside the application/server/training/test import graph.

`shared/combat.ts` and `shared/learning.ts` remain byte-identical to the cleanup checkpoint, and their hash still matches the saved model metadata. Other engine/input files changed only in whitespace where applicable. The six deletions and all formatting changes are backed up under `/tmp/boxing-code-style-checkpoint`. Trained checkpoints, active art, build tools, dependencies and release documentation were retained. Production JS/CSS are approximately 320.54 / 166.14 kB before compression; this is a size reduction, not a measured frame-rate improvement. This maintenance pass did not repeat manual browser/device tests.

Follow-up unused-file review: removed the unreferenced `.venv-1` environment (approximately 1.1 GB), `.test-build` and `training/__pycache__`. All project launchers use `.venv`; its AI imports were verified, its packages cover the duplicate's AI dependencies, and no open files were detected in the duplicate before removal. Added alternate-environment/cache exclusions to Git and Docker rules. A renewed import/export reference scan found no additional orphaned source modules or single-reference exports. ESLint and TypeScript unused-local/parameter checks passed. No gameplay source was modified in this follow-up; the full regression suite was not repeated for these environment/cache deletions. The removed environment's package inventory is retained in `/tmp/boxing-removed-environment-packages.json`.

Hosted-AI configuration follow-up: the Vercel error was traced to hardcoded loopback health and prediction URLs. Added a shared frontend endpoint resolver, an optional service URL argument to `LearnedBot`, exact-origin CORS settings for the Python service, and accurate public-site availability messages. `npm run verify` passes all 126 tests, including three new endpoint tests. A temporary loopback-only service accepted an explicitly allowed HTTPS frontend origin and existing local origins, returned valid masked predictions, and rejected invalid schemas/masks and an unapproved origin. This validates the configuration plumbing, not an actual hosted deployment or cross-internet latency. Combat, model features, response pacing/timeouts and the saved engine hash remain unchanged. README documents deployment prerequisites and Vercel variables; these edits have not been committed, pushed or deployed by the assistant.

Render preparation: added `Dockerfile.ai`, its allowlisted build context, `npm run ml:package`, and `docs/deploy-ai-render.md`. A validated 229 KB release checkpoint and matching metadata are prepared under `deployment/model/` for the user to review before committing; committing to a public repository makes that release model public. The image installs both runtimes and CPU-only PyTorch, loads/checks the checkpoint during build, and uses Render's port. Packaging, prediction/origin checks, build/lint and all 126 regression tests pass. The Linux CPU wheel is available. Full Docker build/execution remains unverified because Docker Desktop's daemon was stopped; the attempted build failed before running any image instructions. No Render service, hosting plan, Git push or Vercel redeployment was performed.

Live connection diagnosis: the Vercel bundle for `https://block-brawl-ecru.vercel.app` contains the correct AI and multiplayer URLs. Both Render health endpoints respond successfully. Requests carrying this exact frontend origin returned AI HTTP 403 and a multiplayer handshake without `Access-Control-Allow-Origin`; the owner must correct `MODEL_ALLOWED_ORIGINS` and `CLIENT_ORIGIN` on their respective Render services. Exact settings are recorded in `docs/deploy-ai-render.md`. Replaced the separate backend-hosted Socket.IO script download and its 12-second timeout with a lazy frontend-bundled client. Socket.IO still connects to the same configured backend with the existing reconnection behavior. The production asset check now covers lazy chunks. Build, lint, unused-code checks and all **127 tests** pass; no combat rules changed. The client patch is local until committed/pushed and rebuilt, and the Render allowlists have not been edited by the assistant.

Follow-up live check: multiplayer's CORS response is now correct. Two temporary clients successfully connected over WebSocket, created/joined a private party, and entered countdown with 135 HP each before disconnecting. AI still rejects the frontend origin with HTTP 403, and Vercel still serves the old frontend bundle. Browser interaction and a completed remote match remain unverified. No service configuration or deployment was changed by the assistant.

Artwork loading fix — 1 November 2026: the renderer previously displayed procedural fallback fighters and scenery until the PNG artwork finished loading, and retained those graphics when downloads failed. The arena now waits for all five fighter images, both gym textures and sprite material preparation before displaying the scene. Loading and recoverable error messages replace the old-graphics flash; retry reloads only failed images. The combat loop continues unchanged. New checks cover incomplete downloads, failures, retry, material-processing errors and non-mutating rendering during loading. Build, lint, unused-code checks and all 128 tests passed. Final edits after verification only restore existing whitespace. The live Vercel HTML already has revalidation headers; no service worker or random graphics selector was found. This patch remains local until committed, pushed and deployed; browser visual verification remains outstanding.

Party camera sharing: added opt-in, muted WebRTC camera panels for both seated players. Motion users can reuse their existing capture stream; keyboard users can grant camera permission separately. Only connection metadata is relayed through the Node server to the other seated player. Sharing stops on party departure and camera errors do not modify combat. VITE_RTC_ICE_SERVERS can configure TURN; default STUN alone cannot connect every restricted network. Deploy both the Node backend and frontend for this feature. Finished matches no longer render live first-person gloves or the recovery prompt. Full verification passed 129 tests; subsequent rendering assertions passed all 106 core tests, lint and type checking passed. Actual two-device video and the reported blue-glove appearance remain unverified; the finished-state overlay path has regression coverage.
