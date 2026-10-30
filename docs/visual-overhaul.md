# Graphics-only field-house polish

## Scope and checkpoint

The existing React + Canvas 2D game and its photographic gym / pixel-art direction are retained. No engine, dependency, asset replacement, game-state or interaction architecture changes were made.

The working tree already contained substantial uncommitted work. Before editing, source/assets/tests were fingerprinted and the initially targeted files copied to `/tmp/boxing-visual-checkpoint-20261029`. This report compares against that working-tree checkpoint, not the older Git HEAD.

## Inspection and implementation plan

- Protected simulation: `shared/combat.ts` (attacks, damage, stamina, guard, movement, hit tests, round state, recovery), `shared/ai.ts`, `shared/hard-tactics.ts`, `shared/learned-ai.ts`, `shared/learning.ts`.
- Protected input/lifecycle: `src/App.tsx`, `src/motion/*`, `src/network.ts`, `server/index.ts`, `public/pose-worker.js`, component event handlers and modal focus hooks.
- Protected camera: `arenaCamera`, `cameraPoint`, `projectPoint`, world mesh dimensions and clipping/projection math. Protected poses: `src/game/punch-motion.ts`, `src/game/presentation.ts`, renderer pose calculations, action ages, hitstop, recovery and sprite frame selection.
- Visual surfaces: renderer particle drawing, cached sprite color/light treatment, procedural floor decoration, CSS.
- Sequence: establish baseline; checkpoint; refine existing sprite materials without moving/resampling artwork; improve effects; add floor paint/atmospheric lighting; apply cohesive UI styling; run tests/build/lint; visually inspect preview, live fullscreen and pause menu.

## Implemented presentation changes

- Red-corner crimson and blue-corner cobalt leather throughout existing standing, punching, guarding and knockdown rigs, including first-person arms. A deterministic load-time material pass retains source shading, every alpha value and authored image coordinates. Skin, cloth, wraps and purple hair are excluded from the leather mask.
- Stronger warm key lighting, cool bounce light and shaded sides on cached cutouts. Original anatomy, equipment, pixel silhouettes and animation rig remain intact.
- Finer directional impact streaks replace square confetti using the same event triggers, particle count and lifetime.
- A restrained painted floor crest is projected onto the existing timber floor using existing near-plane clipping. Its cached world vertices maintain parallax without creating a physical surface, obstacle or boundary.
- One cached warm-light/cool-vignette bitmap adds environmental depth behind the fighters. No per-frame pixel manipulation, new textures to download, new dependency or new lighting engine.
- Cohesive green, ivory and brushed-brass presentation across setup controls, roster, move details, HUD, timer, primary/secondary buttons, settings, help/result dialogs, recovery panel, ultimate control and pause menu.
- Cleaner borders/shadows; improved supporting-text typography and fighter names; less intrusive scanline opacity; visible keyboard focus; clearer segmented health and smooth guard/stamina finishes. Existing labels, interactions, responsive layout rules and saved preferences remain in place.
- Fixed a display-only fullscreen CSS inheritance issue where fighter-name max-width also limited guard/stamina fill elements to half their tracks.

## Files changed by this task

- `src/main.tsx`: import the final visual stylesheet.
- `src/championship-polish.css` (new): scoped presentation overrides, including native fullscreen dialogs.
- `src/game/character-art.ts`: matching red fallback glove palette.
- `src/game/reference-sprites.ts`: cached material variants and consistent lighting; optional corner selection only.
- `src/game/sprite-material.ts` (new): pure cached leather-pixel treatment.
- `src/game/renderer.ts`: pass fighter identity into artwork drawing and refine existing particle strokes. Pose math, timing, transforms and camera calculations are unchanged.
- `src/game/arena-world.ts`: decorative floor paint and cached light pass. Camera functions, photographic room mesh, environment dimensions and existing room drawing remain unchanged.
- `tests/sprite-material.test.ts` (new): deterministic palette treatment, alpha/skin/cloth/wrap/hair preservation and highlight ordering.
- `docs/visual-overhaul.md` (new): inspection, implementation, validation and limitations.

## Validation

- Baseline: 108 core tests passed before changes.
- Updated: 108 core tests pass. Includes attack timing, damage, guard/parry, dodge/duck, stamina, AI, motion gestures, knockdown/recovery, deterministic simulation, camera orbit, finite rendering geometry, balanced canvas state and renderer non-mutation of combat state across actions and match phases from both viewpoints.
- Eight learning/AI tests pass; two network tests pass, including authoritative lobby/combat, disconnect/resume, rematch and motion-mode stamina compatibility.
- New material test passes: `node --import tsx --test tests/sprite-material.test.ts`.
- `npm run build` and `npm run lint` pass.
- Working-tree fingerprint comparison: existing files changed only in the five presentation files listed above. Protected gameplay/input/AI/network/settings/UI-handler source files, original assets, dependencies and animation timing modules are byte-identical to the checkpoint.
- Direct Chrome review: before/after preview; red first-person and blue opponent gloves; floor crest and lighting; live fullscreen/countdown; existing J/K/Space input smoke test; pause menu. Corrected fullscreen meter clipping found in this review.

## Limitations

This is a material, lighting, effects and interface polish of existing pixel art, not replacement anatomy or a new character model. Existing sprite frame blending and contact/recovery poses are deliberately preserved. The photographic background's existing ring ropes/pads are baked into the panorama; they were not independently rebuilt or moved. No claim is made that every action was manually verified. Camera-driven controls, actual two-person online play, mobile devices, all result/recovery screens and cross-browser rendering were not manually exercised; relevant existing automated tests cover the underlying systems. Performance optimizations are structural (cached materials/lighting); no target-device FPS benchmark was taken. Existing visual limitations of the photographic projection and sprite rig remain.

## Follow-up: arena-first overlay layout

The subsequent layout request replaces the scrolling arcade page with a full-window arena, a floating top navigation bar, and a collapsible left corner panel containing the existing right-sidebar setup/match controls. Move Lab, Fighters, and Your Rounds are individually selectable overlay workspaces, with an explicit return-to-arena control. Hash navigation/back/forward selects the corresponding workspace; the arena remains mounted throughout. Guide, settings, sound, fullscreen, match menu, camera setup and the expandable round dashboard remain available.

This follow-up changes `src/App.tsx` only in UI state, hash navigation and JSX layout; it adds `src/game-shell.css`, imports it from `src/main.tsx`, and scopes two legacy hide rules in `src/fight-view.css` and `src/fullscreen-play.css` so they do not remove the new overlays. The earlier byte-identical statement for App applies to the graphics pass above, before this follow-up. Combat dispatch, input handlers, simulation, AI, round flow and camera code are unchanged in this layout pass.

Validation: build, lint and all 108 core tests pass. Chrome checks covered opening/closing the corner, top-level navigation, Fighters/round-history tabs, returning to the arena, and fullscreen overlay visibility. Corrected an inherited fullscreen timer positioning rule found during visual review. Narrow-screen CSS is provided; physical mobile-device testing was not performed.

## Follow-up: compact right corner and move ghosts

Moved the floating corner to the right, limited its height, reduced illustration/control spacing, retained scroll access to every setting, and kept the fight button visible at the bottom. Health/guard/stamina bars are slimmer and centered with room reserved for the open panel. The corner automatically hides on entering a match, can be reopened using Your Corner, and returns on leaving.

Added a presentation-only mini character for accepted jabs, crosses (mirrored jab art), hooks, blocks, slips, ducks and ultimates. It uses the existing six-pose atlas, two faint afterimages, a move caption and a 1.25-second fade. Pause freezes its animation; reduced-motion users receive an opacity-only fade. `ActionEchoTracker` reads local fighter state without writing to combat; it deduplicates held guard/hitstop and ignores idle, hurt and non-fighting phases. No combat loop or input handlers were changed.

Files: `src/App.tsx`, `src/game-shell.css`, `src/components/Arena.tsx` (import and visual child only), new `src/components/ActionGhost.tsx`, new `src/game/action-echo.ts`, and new `tests/action-echo.test.ts`.

Validation: build and lint pass; 108 core tests and three new action-observer tests pass. Browser review confirmed the compact right panel, centered meters and automatic hiding on fight start. Live ghost screenshot capture was interrupted by browser-control timeouts/concurrent interaction; its exact live appearance/fade was not manually confirmed. No mobile-device test was performed.

## Follow-up: left ringside tools, random ghosts and trained-only CPU

Removed the scouting report and the keyboard setup tagline. The 90-second match clock is retained. Moved the map out of the canvas into a responsive SVG using the same ring positions and scale; it now shares a bottom-left flex column with round telemetry, separated by an 18px gap (14px on narrow screens). Expanding telemetry moves the map upward rather than overlapping it. Health cards are wider and names, values and meters have additional inset padding. Each accepted move ghost receives a fresh random on-screen position bounded away from viewport edges; this randomness is presentation-only.

The user explicitly requested a CPU behavior change in this follow-up. All three live CPU difficulty selections now instantiate LearnedBot. Removed the opt-in checkbox, scripted combat fallback, and hard-mode tactical overrides. Retained the existing tier-specific response delays/attack spacing and legal action masks, plus existing non-policy knockdown recovery handling. Model availability gates initial starts, touch-glove starts and rematches. Disconnects are visible and retried without switching to scripted fighting. Controls, attack mechanics, damage, stamina/health, collisions, timers, recovery rules and online protocol were not changed; protected-file fingerprints match the original task checkpoint.

The previous saved policy failed the existing engine-hash compatibility check. Its ZIP/metadata were preserved. Trained a new compatible policy at `training/models/boxer-current.zip` (100,352 decisions) and changed the default training/serving path accordingly. This is one trained policy used at three response speeds, not three separately trained checkpoints. The local inference service is running on port 8766; restart it with `npm run ml:serve` if stopped. Saved weights/runs remain excluded from Git by the existing ignore rules.

Changed files for this follow-up: `src/App.tsx`, `src/components/ChallengerCard.tsx`, `src/components/ActionGhost.tsx`, `src/components/Arena.tsx`, new `src/components/RingMap.tsx`, `src/game/renderer.ts`, `src/game-shell.css`, `shared/learned-ai.ts`, `tests/learning.test.ts`, `training/common.py`, `training/serve.py`, `training/README.md`, `README.md`, this report, and the new ignored model/evaluation artifacts.

Validation: production build and lint pass. 108 core, nine learning, two network and four action/material tests pass (123 total). Model-service checks pass for prediction, action legality, schema rejection and local-origin restrictions. The new policy won nine held-out evaluator matches against scripted opponents (three each against Easy/Medium/Hard); these are small-sample offline policy checks, not an assessment of human difficulty or the live response-speed tiers. Chrome review confirmed no scouting/tagline, model-ready status, wider padded health cards, and the left map/telemetry gap. Random ghost locations were verified in code; a live fade/position sequence was not captured. Mobile-device and camera-driven trained matches were not manually tested.

## Follow-up: timer-menu match exit and top-left camera

Added EXIT MATCH to the existing timer menu, wired directly to the existing leave handler. Resume and fullscreen controls are retained. Browser testing opened the menu from the timer, activated EXIT MATCH and confirmed the setup screen returned.

Moved MotionCamera out of the collapsible right corner into an independent top-left overhang. Its responsive width fills the gap between the viewport margin and the centered health cards, with a matching top alignment and margins. The preview remains mounted/visible when the corner collapses; camera tracking, calibration, input callbacks and lifecycle logic are unchanged. Camera settings are retained in an expandable CAMERA TOOLS section. Live Chrome review confirmed the actual video and labeled tracking overlay fill the top-left card. Narrow screens place the preview below the scorecards; no physical mobile-device test was performed.

Files: `src/App.tsx`, `src/components/FightMenu.tsx`, `src/components/MotionCamera.tsx` (markup only), `src/components/Arena.tsx` (timer tooltip), and `src/game-shell.css`. Build, lint and 108 core regression tests pass.

## Follow-up: two-minute rounds, 135 HP and fourth-knockdown recovery

At the user's explicit request, changed the shared starting health to 135, introduced ROUND_SECONDS=120 and used it for match creation and policy time normalization, and changed per-fighter recovery targets to 20, 60, 100, 200 (capped at 200 for later knockdowns). The existing ten-second recovery window, get-up health (60), input rate limits and gesture detection are unchanged. Guide text and round labels were updated to match.

Tests explicitly assert 135/135 starting health and 7,200 ticks on both local and authoritative online matches, and complete fourth/fifth knockdown recoveries with exactly 200 alternating keyboard inputs. Existing camera recovery tests cover the first three goals; 200 camera movements inside the unchanged ten-second window were not demonstrated. The camera detector retains its existing 80ms emission interval, so a 200-input fourth recovery is not achievable through that detector alone within ten seconds; keyboard input remains available. No gesture timing was silently changed.

The rule change invalidated previous trained-policy metadata. Preserved earlier checkpoints, trained `training/models/boxer-120s-135hp.zip` for 100,352 decisions against the new rules, updated the default model path, and restarted the localhost inference service successfully. Build/lint, 108 core tests, nine learning tests, four action/material tests and two network tests pass (123 total). Browser inspection confirmed 135/135 health. Changed files: `shared/combat.ts`, `shared/learning.ts`, `src/App.tsx`, `tests/combat.test.mjs`, `tests/network.test.ts`, `tests/reference-sprites.test.mjs`, `training/common.py`, `training/README.md`, `README.md`, this report, and the new ignored model checkpoint/metadata.
