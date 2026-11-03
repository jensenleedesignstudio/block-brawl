# Party camera production audit — 2 November 2026

The existing approach is appropriate for a two-player game: native browser WebRTC, the existing Socket.IO party server for signaling, and a managed TURN service for restrictive networks. This avoids streaming video through the authoritative game server or adding a separate video application server. It is an architectural assessment, not a measured claim that this is the fastest or cheapest possible implementation.

## Verified issues and corrections

| Finding | Impact | Correction |
| --- | --- | --- |
| A lost offer left the caller in `have-local-offer`; later retries were ignored | Camera handshake could remain stuck | Retransmit the outstanding offer instead of skipping it or repeatedly restarting ICE |
| A returning page was treated as the old connected peer | A refreshed/rejoined camera could stay blank | Connection-session identifiers and targeted messages distinguish the new negotiation from stale packets |
| Signaling validation checked only the message's type | Malformed descriptions/candidates reached the other browser | Validate matching SDP types, candidate sizes and session identifiers on server and client |
| Transport allowed 8 KB while the handler accepted 24 KB | Larger SDP could disconnect the whole socket | Bounded 32 KB transport with 16 KB SDP/24 KB metadata limits |
| Camera ICE packets shared the existing combat-input budget | Camera startup could suppress valid controls | Separate bounded camera-event allowance; retain the combat allowance |
| A one-second retry timer kept waking while connected | Unnecessary work throughout a match | Cancel retries on connection; schedule backoff only while disconnected |
| Static credentials required a frontend rebuild to update returned data | Expired relay configuration could remain embedded | Optional HTTPS runtime ICE endpoint, no-cache fetch, deadline/cancellation and reconnect refresh; static JSON retained as an alternative |
| Camera failure required stop/resume rather than a direct retry | Confusing recovery | Single Retry camera action and device-ended feedback |
| A duplicate motion preview appeared beside the party preview | Two copies of the local camera | Keep motion tracking mounted while collapsing its redundant preview; tools can reveal it deliberately |

## Efficiency and preservation

- One video peer connection per party client, one remote feed, no microphone/audio stream.
- Motion mode reuses the existing capture; keyboard capture requests 640×480 up to 30 fps. Browser adaptation remains enabled, with a 1.2 Mbps outgoing encoding ceiling where supported.
- No new runtime dependencies, video server or gameplay mode. Camera timers, tracks, listeners and provider requests are cleaned up on departure; borrowed motion tracks are not stopped by the sharing control.
- No changes to combat simulation, physics, AI, recovery targets, player balancing or authoritative match timers. Camera message handling is independent of simulation ticks.
- This pass contains no FPS, latency, bandwidth-cost or load benchmark; adequate real-world quality must be measured on the intended devices/networks.

## Verification boundaries and release gates

Build, lint, unused-code checks and all **144 automated tests** passed. Automated coverage checks configuration validation, runtime credential fetching/cancellation, corner assignment, late track attachment, lost-offer retransmission, returning-peer offers, signaling isolation, malformed metadata, SDP larger than the former transport cap and combat-control availability during camera signaling. These tests use local sockets and simulated RTC objects.

A separate native Chrome browser check also passed using the actual React camera components, the actual Node party server and real browser WebRTC. Two independent Socket.IO clients sent distinct moving synthetic canvas video; decoded remote frame colors were checked in both directions. The guest camera component was then unmounted and remounted with a different colored feed, and both directions recovered. No physical camera or microphone was used. This establishes actual local video delivery and guest-camera reconnection, not TURN delivery or cross-device/cross-network/browser compatibility. The temporary tab and loopback server were closed after verification. The harness files remain in `/tmp/boxing-camera-browser-check.tsx` and `/tmp/boxing-camera-harness.mts`, outside the shipped application.

Before calling cameras production-ready:

1. Configure a real TURN provider with UDP/TCP/TLS entries and appropriate quota/expiry/budget alerts. Neither provider signup nor deployment was performed here.
2. Prove video in both directions between two devices on different networks with `VITE_RTC_RELAY_ONLY=true`; then verify direct/fallback behavior with it false.
3. Check Chrome, Firefox, Safari and supported mobile devices for permission denial, background/foreground, unplug, reload/rejoin, stop/resume, repeated matches and resource cleanup. Only list browsers that actually pass as supported.
4. For a public service, supply current expiring credentials through a controlled runtime endpoint and operate credential rotation/revocation. Runtime fetching alone is not a credential issuer or rotation system.
5. Retain one Node multiplayer instance with the current in-memory room design. Test deployment/restart behavior and do not promise high availability or multi-instance scaling.

The code has stronger automated coverage; production camera delivery remains unverified until these external checks pass. No change is published by this audit.

## Files

`shared/camera.ts` defines/validates signaling metadata; `server/index.ts` handles seated-player routing and independent limits; `src/camera-signaling.ts` handles offer recovery; `src/camera-config.ts` resolves static/runtime ICE; `src/components/PartyCameras.tsx` handles video lifecycle and UI; `src/App.tsx` and `src/game-shell.css` handle the duplicate preview, sharing notice and short-screen containment. Tests are in `tests/camera-config.test.ts`, `tests/camera-signaling.test.ts`, `tests/network.test.ts` and existing `tests/party-cameras.test.ts`. `.env.example` and `docs/deploy-party-cameras.md` describe deployment.

References: [WebRTC TURN guidance](https://webrtc.org/getting-started/turn-server), [Metered runtime credential option](https://www.metered.ca/docs/turn-server-service/quickstart/), [Metered production rotation](https://www.metered.ca/docs/turnserver-guides/rotating-turn-credentials/).
