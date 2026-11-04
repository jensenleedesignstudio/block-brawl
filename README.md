# Block Brawl

A browser boxing game with webcam motion controls, trained CPU opponents, and online friend matches. Pixel-art fighters meet a photographic gym, green-and-brass controls, and synthesized arcade music.

[Play Block Brawl](https://block-brawl-ecru.vercel.app) · [Verification and known limits](docs/release-readiness.md) · [Train an opponent](training/README.md)

For a first visit, choose keyboard controls and VS CPU. Wait for the opponent service to connect, then enter the ring. Use J / K to punch and Space to block; the guide explains the remaining moves. Motion controls require a camera and room to move. Online matches require a second player.

The client uses React, TypeScript, and Canvas. MediaPipe recognizes gestures locally in a worker; the Socket.IO server owns online combat state. The CPU opponent uses a trained policy served by a separate Python service.

## Run

**Opened an old `dist/offline.html` directly?** Use the server commands below instead. The current trained-only CPU mode requires the local model service, and `file://` pages cannot use that service or the pose worker. Allowing camera permission does not fix this.

Requires Node.js 22.12 or newer and npm. From this directory:

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies multiplayer requests to the Node server on port 3001. Both processes start together. To start individually, use `npm run dev:client` and `npm run dev:server` in separate terminals.

Production:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. The Node server serves the production client and Socket.IO together. No environment variables are needed for this same-origin setup. `.env.example` documents the optional port, allowed frontend origins and separate frontend/backend configuration. Vite reads `.env` automatically; export server variables in the shell (e.g. `PORT=3002 npm start`) or load them with your hosting platform.

## Play

Choose **VS CPU**, select a difficulty and enter the ring. The arena is shown from your fighter’s perspective, with your gloves in the foreground and the opponent ahead. Your fighter automatically approaches the opponent, while webcam players can lean toward or away from the camera to move forward or back. Both fighters start with 135 HP. Each fight is one two-minute round, decided by knockout or remaining health; equal health produces a draw. Hits, damage dealt and session wins are scored. Rematch from the results screen.

Block Brawl uses red and blue pixel-art fighters in the Iron & Oak boxing gym, with a green-and-brass arcade HUD. The opponent faces the camera and throws punches toward you. Victory and defeat lead directly to the results and rematch screen.

| Key | Action | Motion gesture |
| --- | --- | --- |
| J | Left jab | Quickly extend the left arm, then return to guard |
| K | Right cross | Quickly extend the right arm, then return to guard |
| L | Hook | Sweep the right fist horizontally inward with a bent elbow |
| Space (hold) | Block | Hold both hands beside the face |
| A / D | Slip left / right | Move the head and shoulders sideways together |
| S | Duck | Drop the head by bending the knees |
| Escape | Open the pause / fight menu | Click the round timer |

Keyboard inputs remain available as a fallback when motion controls are enabled. Losing window focus pauses AI matches and releases keyboard block. Online matches keep running on focus loss.

After motion calibration, raise both hands beside your head, or extend both fists toward the camera, and hold for 0.6 seconds. Watch the start-progress bar. Hands may stay about shoulder-width apart; closed fists are not required because this tracker measures wrists and arm joints. This starts the AI fight, or readies you in an online room once both players have joined. Starting a match requests native fullscreen when Automatic fullscreen is enabled in Settings. The live camera remains in the top-left. The round timer opens Resume, Exit Fullscreen and Exit Match; online matches keep running while the menu is open. The camera reports each arm's elbow angle or “out of view” to help adjust framing.

Blocks absorb roughly 80% of damage and drain the visible guard meter while held. Releasing guard refills it; an empty meter breaks guard until it recovers. Raising guard in the 12 frames before impact makes a perfect block: the punch deals no damage and the attacker is dazed briefly. Slips avoid jabs and crosses during their active window, while hooks catch slips. Ducks avoid crosses and hooks, while jabs catch ducks. Attacks have startup, active and recovery frames. Defensive moves have recovery cooldowns, so timing matters. Hook windup is slower and its range is shorter. Repeated keydown events are ignored, and action states reject attack spam.

### AI

- **Easy:** long attack delays, predictable jab–jab–cross pattern, slow reactions and rare defense.
- **Medium:** more frequent attacks and combinations, moderate reaction delays, blocks and slips.
- **Hard:** faster decisions, more combinations, responsive defense and attack selection that punishes guard.

AI difficulty changes behavior, not health or damage. Seeded AI decisions and fixed-step combat rules are deterministic.

## Webcam setup

1. Select **Motion controls**. Allow camera permission.
2. Wait for the pose model to load. Face the camera rather than standing sideways. A slight boxing stance is fine, but keep both shoulders, elbows, wrists and hips visible; use good lighting.
3. Raise your hands into a relaxed guard. Calibration starts automatically and takes approximately three seconds (40 confidently tracked samples).
4. Check the labeled body points, confidence, and recognized gestures in the camera panel. Drive either fist forward, then retract to guard; you do not need to fully straighten your elbow. To slip, move the head and shoulders sideways together. Drop your head to duck. Lean your body toward the camera to advance or away to retreat. Then start the match.

The mirrored preview labels the head, shoulders, elbows, hands, and hips. Mint marks the left arm, orange the right, and purple the hips. Anatomical left/right are preserved in the mirrored preview. Slips require both the head and shoulder center to move at least 0.25 calibrated shoulder widths in the same direction, with simultaneous movement over two frames. Head movement alone and shoulder movement alone do not slip. Punches trigger during rapid extension from roughly 95 degrees, using a 180 ms history of elbow opening and increasing shoulder-to-wrist reach. Retracting at least 25 degrees from the stroke’s peak rearms that hand, including during cooldown. Holding an extended arm and slow stretches do not punch. Tracking gaps and changes between world/image geometry reset the motion history. The joint calculation uses MediaPipe world landmarks when available, with normalized landmarks as fallback. Each arm has its own visibility gate; hidden hips or the other hand no longer disable a visible punch. Ducking uses head height. Recalibrate after changing camera position; webcam depth estimates benefit from good lighting and clear elbow visibility.

Pose inference runs in a dedicated worker at a maximum of roughly 15 FPS with one frame in flight. The game renders with requestAnimationFrame independently. Camera frames stay on the device; only action names, block state, and forward/back movement are sent to the server. MediaPipe SDK and WASM are copied from the installed npm package by `predev` / `prebuild` and served locally. The lite model downloads from Google on first use, so initial motion setup needs internet access. If starting only the client process, first run `npm run setup:vision`. A classic worker is used for compatibility with the SDK’s WASM loader. The app loads Google Fonts with system fallbacks.

Camera permission needs **localhost or HTTPS**. A plain HTTP LAN IP normally supports keyboard play only. Camera/model failures display retry and keyboard fallback guidance. Switch to Keyboard or leave the arena to stop the camera; navigating away also stops tracks and terminates the worker. Tracking loss releases guard and blocks new pose actions until confident landmarks return.

## Two-player multiplayer

1. Start `npm run dev`.
2. Open two browser tabs at http://localhost:5173 (or separate browsers).
3. In each, select **Online** and enter a fighter name.
4. Player 1 selects **Create party**, then shares the six-character party code or selects **Copy invite link**.
5. Player 2 opens the invite (which selects Online and fills in the code), or enters the code manually, then selects **Join party**. Opening an invite does not automatically join or start a match.
6. Choose controls and calibrate if using a webcam. Both players press **READY UP**.
7. After the countdown, each browser controls its own fighter. Both players must ready again for a rematch.

Use keyboard controls when testing two tabs with one physical camera. Two devices can use their own webcams independently. For LAN keyboard testing, open `http://HOST_LAN_IP:5173` on the second device and allow ports 5173/3001 through the host firewall as needed. For internet webcam play, deploy the production Node app behind HTTPS with WebSocket support. A static-only host cannot run the multiplayer server. If frontend/backend are hosted separately, set `VITE_SERVER_URL` at build time and `CLIENT_ORIGIN` on the server.

The server owns the 60 Hz simulation, range checks, damage, cooldowns, clock and winner. Snapshots are sent at 20 Hz. It accepts only whitelisted actions, caps message size, rate-limits events, permits two players per room, and never accepts client-supplied damage or fighter positions. Client input has no prediction; internet latency will be visible.

### Hosting the online version

When started with `npm run dev`, `npm run dev:server`, or `npm start`, the Node server also starts the installed local Python model service if it is not already running. This keeps CPU fights available without a separate terminal. It reuses an existing service and stops only the child it launched. Set `AUTO_START_MODEL=0` to disable automatic startup. If the Python environment or training tools are absent, online play still works; CPU setup is documented in `training/README.md`.

The production app already serves the game and multiplayer from one Node process: run `npm ci`, `npm run build`, then `npm start`. Share the public HTTPS URL with friends. Both players must use the same server; a localhost invite works only on your own computer. Invite links contain the public party code, never reconnect credentials.

A `Dockerfile` is also provided: build with `docker build -t boxing-party .`, then run `docker run --rm -p 3001:3001 boxing-party`. For internet access, host this container behind HTTPS on a service that supports persistent Node processes and WebSockets; route traffic to `PORT` (default 3001). `/api/health` is the health endpoint. Use **one server instance**: parties are in memory, are lost on restart, and are not shared between replicas. The multiplayer container does not include the local Python service used for trained CPU opponents; human-vs-human parties do not need that service.

Leaving a party before a match immediately frees the seat; if its creator leaves, the remaining fighter retains the code and can invite another friend. During matches, existing disconnect, recovery, forfeit and rematch rules apply.

Transient disconnection pauses the match for up to 20 seconds. The same open tab reconnects using its private in-memory room token. After the grace period the connected fighter wins. Leaving voluntarily forfeits immediately. A page reload intentionally loses its anonymous identity: create a new room. Empty disconnected rooms are cleaned up. Rooms and scores are in memory and reset on server restart; no authentication, database, ranked ladder, spectators or cross-process room scaling is included.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run test:core` compiles and runs deterministic combat, AI and synthetic landmark tests with Node’s built-in runner. `npm run test:network` runs a real ephemeral HTTP/Socket.IO server and multiple clients to verify rooms, readiness, validated combat, capacity, pause/reconnect, rematch and forfeit. Automated landmark tests exercise the detector mathematics; they do not certify real-world camera accuracy.

## Layout

- `shared/combat.ts` — serializable, fixed-step combat rules
- `shared/ai.ts` — seeded difficulty profiles and bot decisions
- `server/index.ts` — Express, room lifecycle and authoritative simulation
- `src/game/` — procedural Canvas renderer and Web Audio effects
- `src/motion/` — calibration and gesture recognition
- `public/pose-worker.js` — classic MediaPipe inference worker
- `src/components/` — arena loop/HUD and camera lifecycle/debug UI
- `src/App.tsx` — setup, controls, lobby, results and socket lifecycle
- `tests/` — combat, gesture and live network tests

## MVP limits

Each match contains one round; the result screen offers rematches. Motion recognition is heuristic, not a trained boxing classifier, and needs physical testing across cameras and body types. There is no client prediction or snapshot interpolation yet. Rooms survive connection interruptions, but not a page reload or server restart. The development environment’s dependency/network and verification results are recorded in `VERIFICATION.md`.

MediaPipe implementation reference: [Google’s Pose Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

### Rising Breaker

Dealing regular punch damage adds 1.5 charge per damage point; taking damage adds 1. Charge caps at 100. Spend a full meter by pressing **R**, tapping **UNLEASH**, or rapidly raising **one hand above your head whether or not its elbow is visible**. Keep the opposite hand visible and lower. Lower both hands to reset the gesture. The camera checks upward speed rather than elbow angle for this move; a slow raise or two raised hands will not trigger it. Rising Breaker starts with an **18-damage uppercut**, then throws **three quick 2-damage punches** (24 damage total if all connect), with separate uppercut and alternating combo animations. The AI can use it too. It can be interrupted, parried, blocked, slipped, or ducked. Ultimate damage does not recharge the attacker.

Getting punched no longer cancels an ongoing punch animation. If the opponent hits before your punch connects, your swing finishes and displays **MISS** without dealing damage. Punching during the hurt reaction also plays a swing that misses. Perfect blocks still daze the attacker.

### Circling footwork

Fighters automatically circle around a shared floor position while maintaining eye contact and combat distance. Slips influence the circling direction; stepping toward or away from the camera still controls range. A perspective camera follows the circular path and turns toward the opponent. The gym scenery rotates through view as fighters circle. The ring-position radar shows both positions. Footwork is simulated on the authoritative combat clock and freezes during hitstop and when the round ends.

### Knockdowns and getting up

Zero health starts a 10-second knockdown count instead of ending the match immediately. The round clock, circling, and attacks pause. Alternate fresh **J / K** presses: **20** on your first knockdown, **60** on your second, and **100** on your third, and **200** on your fourth and later knockdowns. Counts are separate for each fighter and reset on a new match. Use the same number of inputs for camera recovery: move either or both hands vertically. Each distinct large, fast upward or downward stroke counts once; a slower upward lift also counts after a 120 ms pause at the top. Palm orientation and alternating hands are not required. A counted stroke cannot count again until a meaningful direction reversal. Holding keys, stationary hands, small jitter, and tracking reacquisition do not count. Keyboard recovery remains available in camera mode. **Known limitation:** the camera detector emits at most one recovery input every 80 ms, so the fourth-knockdown target of 200 cannot be reached using camera input alone in ten seconds.

A successful recovery restores **60 HP** and guard, with a one-second restart countdown. Failure to recover ends the match by knockout. Both human fighters and AI can be knocked down; online recovery progress and the countdown are server-authoritative and pause on disconnection. The additional MediaPipe hand model tracks hand Y coordinates locally and only runs hand inference during recovery.

### Punch animation

Regular punches snap forward in three frames and retract within eight frames after contact. Jab, cross, and hook recovery now lasts 8, 12, and 18 frames respectively. Rising Breaker lowers and drives only the right fist straight upward while the left stays in guard, then plays its three small followup punches.

### Illustrated recovery view

Knockdowns show the downed boxer on one knee. Your own knockdown temporarily switches to a third-person view; the recovery panel sits beside the fighter. Raise and lower either hand to recover: clear vertical travel counts in either direction, including slower movements. Confident pose wrists work without the detailed hand model; switching trackers resets the stroke baseline to avoid false counts. Stationary hands and small jitter still do not count. Recovery targets are 20 / 60 / 100 / 200 from the first through fourth knockdowns, capped at 200 thereafter. The ten-second limit remains unchanged.

The arena remains visible behind the floating setup panel, move library, fighter selection, and round history. The interface uses a green-and-brass palette with pixel headings.

### Stamina

Both fighters start at 250 stamina. Jab / cross / hook / ultimate cost 10 / 15 / 20 / 30. Twenty-five consecutive jabs exhaust the bar; attacks with insufficient stamina are rejected. Costs apply once when the move starts, even if it misses. A queued ultimate pays only when it begins.

Stamina recovers at 4 points per second while resting or evading, after a 45-tick (0.75-second) delay from starting a punch. Blocking recovers 12 per second immediately, while still draining the separate guard bar. Attacking, hit reactions, hitstop, countdowns and knockdown counts do not regenerate stamina. Successful recovery restores both fighters to 250 stamina. The shared combat rules enforce this for keyboard, AI and online play; motion controls bypass stamina costs.

Stamina limits apply only to keyboard mode (and AI). Motion mode hides the player's stamina meter and bypasses all punch stamina costs, including ultimates. Ultimate charge is still required. Switching back to keyboard restores stamina rules using the saved balance. Online players select their modes independently; the server preserves those selections through reconnects and rematches.

Camera right hook: sweep your right fist quickly sideways toward the center of your chest with a bent elbow, then bring it back to guard. Detection uses shoulder-relative horizontal travel over a short time window, so a whole-body lean, slow movement, a vertical hand raise, or a straight forward cross should not trigger a hook. Returning the fist rearms it; holding the ending pose does not repeat hooks.

Motion special moves: the uppercut remains the charged Rising Breaker (raise one hand quickly above your head; the other can stay in guard). Uppercut rise is measured relative to the shoulders to reject head-only movement. Right hooks bypass the ordinary-punch detector cooldown; if recognized just before a regular punch finishes, motion mode buffers the hook for up to 18 simulation ticks. Stale hooks expire and are cleared by knockdown, disconnect, or switching to keyboard.


### Trained-only CPU selection

Easy, Medium and Hard now all use `training/models/boxer-120s-135hp.zip` through `npm run ml:serve`. The tiers retain their existing response speeds and attack spacing, but live hard-mode tactical substitutions and scripted combat fallback are removed. The previous `boxer.zip` is retained; it failed the current engine compatibility check. The new checkpoint was trained for 100,352 decisions against the current engine. Start the model service before selecting LET’S FIGHT. Matches now last 120 seconds, with 135 starting HP per fighter.

### Code style and maintenance

Use four spaces, double quotes, semicolons, LF line endings, and a final newline. Keep a space before named-function and method parentheses (`function start ()`), and retain the existing section comments where they help navigation. Prefer readable multiline expressions over compressed statements; keep blank lines between logical groups rather than around every individual line. `.editorconfig` records whitespace conventions, and ESLint checks quotes, function spacing, unused variables, and trailing spaces.

Keep simulation, input detection, rendering, UI, server, and training code in their existing directories. Run `npm run build`, `npm run lint`, and `npm test` after changes. `shared/combat.ts` and `shared/learning.ts` are fingerprinted by the saved model: even whitespace edits invalidate that compatibility hash, so do not bulk-format them. Trained checkpoints and generated build/dependency files are not dead source code and should not be removed as part of cleanup.

Run `npm run verify` for the complete local release gate: style checks, unused-code checks, production build, and all regression tests. It does not publish or deploy anything. AI setup has its own check, `npm run ml:check`; test the running prediction service with `.venv/bin/python training/check_service.py`.

| Start here | Responsibility |
| --- | --- |
| `src/App.tsx` | Setup, navigation, input routing, party connection, and match flow |
| `shared/combat.ts` | Authoritative combat rules and simulation |
| `shared/learned-ai.ts` | Trained-opponent requests and existing difficulty pacing |
| `src/game/`, `src/components/` | Canvas presentation and React interface |
| `src/motion/`, `public/pose-worker.js` | Gesture detection and local camera inference |
| `server/index.ts`, `server/local-model.ts` | Online matches, production serving, and local AI startup |
| `training/`, `tests/` | Model tooling and regression coverage |

### Vercel frontend and trained CPU opponents

For the prepared Docker service and exact dashboard steps, follow [Deploy the trained AI on Render](docs/deploy-ai-render.md). Use `Dockerfile.ai`; the original `Dockerfile` is the multiplayer/client image. `npm run ml:package` validates and prepares the small release checkpoint for review before committing.

A Vite frontend deployment does not start `npm run ml:serve`, install the local `.venv`, or include the ignored trained weights. A public page must point at an actual hosted model service. Localhost development continues to use `http://127.0.0.1:8766` automatically; public pages no longer try to call the visitor's own computer.

1. Prepare a backend with this repository, Node dependencies, the Python environment from `training/requirements.txt`, and both `training/models/boxer-120s-135hp.zip` and its matching `.json`. Keep the model compatibility check enabled. These weight files are not in Git and must be provisioned separately.
2. Run the model service behind an HTTPS endpoint. Configure its bind address/port for your host and allow the exact frontend origin, for example `npm run ml:serve -- --host 0.0.0.0 --port 8766 --allowed-origin https://your-game.vercel.app`. `MODEL_HOST` and comma-separated `MODEL_ALLOWED_ORIGINS` are equivalent environment settings. Local-only defaults remain unchanged. No public service is created by adding these options to the source.
3. In the Vercel frontend project's environment variables, set `VITE_MODEL_URL=https://your-model-service.example.com`. This is a public endpoint URL; do not put secrets in it. Rebuild/redeploy the frontend after setting it. Health and prediction requests use this same base URL with `/health` and `/predict` appended.
4. Confirm the hosted `/health` endpoint reports the current policy version, then test an actual match. Only exact allowed frontend origins receive CORS access; add Preview deployment origins explicitly if you need them. The existing inference timeout/pacing remains unchanged, so cross-internet latency still needs verification.

Online friend parties also require the existing Node/Socket.IO backend. For a separately hosted backend, set `VITE_SERVER_URL` on the frontend and `CLIENT_ORIGIN` on that server. The existing Dockerfile packages this Node backend and the client; it does not include Python or model weights. Setting a URL alone does not provision either backend.
