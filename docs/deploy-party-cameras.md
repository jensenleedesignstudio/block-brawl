# Party camera TURN setup

The game uses native WebRTC for its two video feeds. No separate video server runs on Vercel or Render. TURN must be supplied by a provider. The existing Node server relays only party signaling; video goes directly between browsers when possible and through TURN when necessary. No new dependency is required.

## Recommended deployment: runtime ICE credentials

Use `VITE_RTC_ICE_SERVERS_URL` for an HTTPS endpoint returning a **JSON ICE-server array**. This takes precedence over the static `VITE_RTC_ICE_SERVERS` setting. Remove the static setting when using runtime credentials so unused credentials are not embedded in the build.

For Metered's simplest hosted option:

1. Create/review your own TURN credential and plan in the Metered dashboard.
2. On that credential, choose **Get credential → Show API Key**. This is the **credential-scoped** API key, not the account Secret Key in Developers.
3. Find your Metered app domain and set this Vercel Production environment variable:

   ```text
   VITE_RTC_ICE_SERVERS_URL=https://YOUR_APP.metered.live/api/v1/turn/credentials?apiKey=YOUR_CREDENTIAL_SCOPED_KEY
   ```

4. Deploy these source changes to both the Node backend and Vercel frontend. Both players must reload. Changing the endpoint URL/key later still requires a Vite rebuild; updates to the credential data returned by the same endpoint do not.

The application fetches credentials at party-camera startup with an eight-second deadline, retries temporary provider failures, and refreshes configuration during a later reconnect. Responses bypass browser caches and must include TURN credentials; an invalid provider response is not silently treated as working TURN. Successful connections do not poll the provider continuously.

For a larger public release, point the same variable at an endpoint you operate that returns current, expiring credentials. Credential creation/rotation must happen on your backend; this client loader does not mint, rotate or revoke provider credentials. Never expose an account/admin secret. Metered advises preparing replacement credentials before calls, allowing propagation time and overlapping expiry. Follow its rotation guide rather than generating a fresh Metered credential at each party join.

The scoped-provider URL above is a low-setup option, not proof of automated credential rotation or authenticated per-player issuance. Configure provider expiry, quota/budget alerts and revocation before opening public traffic.

## Alternative: static Metered ICE array

1. Open https://dashboard.metered.ca and review/select a TURN plan yourself. No account, subscription or relay was created by the assistant.
2. Open **TURN Server & SFU → Credentials → Create Credential**. Set appropriate usage limits/expiry for your deployment. A new credential can take up to two minutes to propagate.
3. Open the credential's **Get credential → Show ICE Servers Array**. Copy the array, retaining the supplied UDP, TCP and TLS entries. Use the exact hostnames supplied for your plan/region.
4. In **Vercel → your game project → Settings → Environment Variables**, set `VITE_RTC_ICE_SERVERS` to that array as valid JSON. Property names and strings need double quotes; remove JavaScript variable declarations, comments and trailing commas. Paste only the array, with no surrounding shell quotes. Apply it to Production; apply Preview only if you intend to test preview deployments.
5. Deploy the source changes and rebuild Vercel. Vite embeds these values at build time; changing the variable alone does not update the existing deployment. Both players must reload the new deployment. Render/Python settings do not change for this configuration.

Shape only — these placeholder credentials will NOT connect:

```json
[
    { "urls": "stun:YOUR_PROVIDER_HOST:PORT" },
    {
        "urls": [
            "turn:YOUR_PROVIDER_HOST:PORT",
            "turn:YOUR_PROVIDER_HOST:PORT?transport=tcp",
            "turns:YOUR_PROVIDER_HOST:TLS_PORT?transport=tcp"
        ],
        "username": "YOUR_TURN_USERNAME",
        "credential": "YOUR_TURN_PASSWORD"
    }
]
```

Use the dashboard's actual array, not this template. TURN client credentials necessarily reach browsers, and Vite variables are public. Never put the provider's account secret/admin API key in a `VITE_` variable or Git. Rotate exposed/expired credentials and rebuild when using this static configuration. For a larger public release, use backend-issued short-lived credentials rather than a shared static credential.

## Verify video actually uses TURN

Temporarily set `VITE_RTC_RELAY_ONLY=true` in Vercel and rebuild. This prevents direct connections, so two players must receive each other's moving video for TURN to pass. Test on two devices on different networks. A connected party or successful signaling alone is not a video test. Keep both pages open and verify each remote feed responds to the other person's movements.

After that test succeeds, set `VITE_RTC_RELAY_ONLY=false` and rebuild to allow direct video where possible and TURN as fallback. If relay-only video fails, check the provider's credential test tool, expiry, quota and exact copied URLs. Do not repeatedly change camera permissions to troubleshoot a relay allocation failure. Also test camera denial, unplug/retry, stop/resume, page reload/rejoin and party departure on the browsers you intend to support.

## Hosting limits

Keep the current Node multiplayer service on **one instance**: rooms and match state are held in memory. An instance restart drops those rooms. Multi-instance scaling/high availability would require shared state and coordinated Socket.IO routing; it is not implemented by this camera update. Do not add autoscaling or claim uninterrupted matches through backend redeploys without addressing that separate architecture requirement.

Vercel remains the frontend host, Render remains the multiplayer host, and the Python opponent service stays separate. WebRTC video never travels through the combat event loop. Camera signaling has its own bounded event budget and cannot consume the existing combat-input allowance. Video is muted, with no microphone capture, and is sent only to the other seated party member.

Configuration, signaling and track handling are covered by automated checks. Actual native Chrome WebRTC delivered two-way synthetic video through the real party components/server on loopback and recovered after a guest camera remount. No actual provider credential, TURN allocation, physical webcam pair or two-device video has been verified by the assistant. See `docs/camera-production-audit.md` for evidence and release gates.

Provider references: [Metered quickstart](https://www.metered.ca/docs/turn-server-service/quickstart/), [credential/API-key distinctions](https://www.metered.ca/docs/turn-rest-api/), [production credential rotation](https://www.metered.ca/docs/turnserver-guides/rotating-turn-credentials/), and [WebRTC TURN guidance](https://webrtc.org/getting-started/turn-server).
