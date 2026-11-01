# Deploy the trained AI on Render

This deploys the Python inference service. Keep the Vite frontend on Vercel. The existing `Dockerfile` is for the Node multiplayer backend; select **`Dockerfile.ai`** for this service.

## Prepare the repository

Run `npm run ml:package` from the project root. It validates and loads the current saved model, then copies only its `.zip` and matching metadata to `deployment/model/boxer.zip` and `boxer.json`. A release copy has already been prepared for the current 100,352-step checkpoint.

These two release files are deliberately commit-able. If the repository is public, committing them makes these trained weights public too. Original training checkpoints, environments and logs remain ignored. Review the release files before committing; do not add `.venv`, `node_modules` or `.env`.

Commit and push the prepared code and release files to the GitHub repository connected to Render. No deployment or upload is performed by `ml:package`.

## Create the AI web service

1. In [Render](https://dashboard.render.com/), choose **New → Web Service**, then connect the repository and branch containing these changes.
2. Set **Language** to **Docker**.
3. Keep the repository root as the build context; set **Dockerfile Path** to `Dockerfile.ai`. Do not select the original `Dockerfile`.
4. Leave **Docker Command** empty so Render uses the image's command. It listens on `0.0.0.0` and Render's `PORT` (default 10000).
5. Set **Health Check Path** to `/health`.
6. Add `MODEL_ALLOWED_ORIGINS` with your exact Vercel origin, such as `https://your-game.vercel.app`. Use a comma-separated list for multiple approved origins, including a custom domain if applicable. Do not add a page path or wildcard.
7. Choose compute with enough memory for CPU PyTorch and check the first build/runtime logs. A GPU is not required. Free services can sleep after inactivity; they have a cold-start delay. No plan or paid service has been selected for you.
8. Review the settings and costs, then create/deploy the service yourself.

The image installs Node and Python, the locked Node dependencies, CPU-only PyTorch and the existing AI requirements. It includes only the bridge, shared rules, inference modules and release model. `Dockerfile.ai.dockerignore` excludes unrelated source, credentials, local environments and training artifacts. During the build, `serve.py --check` loads and validates the bundled checkpoint without opening a port. A mismatch stops the build.

Render instructions: [Docker services](https://render.com/docs/docker), [web service ports](https://render.com/docs/web-services), [free instance limitations](https://render.com/docs/free).

## Connect Vercel

1. Wait for Render to report the service as live and note its HTTPS URL, for example `https://block-brawl-ai.onrender.com`.
2. Open its `/health` URL. Expect JSON with `ok: true`, `version: 1`, and the checkpoint's training steps.
3. In the Vercel project's environment variables, set `VITE_MODEL_URL` to the base HTTPS URL, **without `/health` or `/predict`**.
4. Apply the variable to Production, then trigger a new Vercel deployment. Add Preview only if those exact preview origins are also allowed on the model service.
5. Open the new game deployment and test a CPU match. If it stays unavailable, check Render startup logs, `/health`, the exact origin allowlist, and that you rebuilt Vercel with the correct endpoint.

Online parties need the separate Node/Socket.IO backend and its `VITE_SERVER_URL` / `CLIENT_ORIGIN` settings; this AI container does not implement multiplayer.

### Current project's browser-origin settings

For `https://block-brawl-ecru.vercel.app`, set these **on Render**, then redeploy both services:

| Render service | Environment variable | Value |
| --- | --- | --- |
| `block-brawl` (Python AI) | `MODEL_ALLOWED_ORIGINS` | `https://block-brawl-ecru.vercel.app` |
| `block-brawl-multiplayer` (Node) | `CLIENT_ORIGIN` | `https://block-brawl-ecru.vercel.app` |

The deployed Vercel bundle was verified to contain `VITE_MODEL_URL=https://block-brawl.onrender.com` and `VITE_SERVER_URL=https://block-brawl-multiplayer.onrender.com`. Both backend health endpoints respond successfully, but the exact frontend-origin probe returned AI HTTP 403 and a multiplayer handshake without `Access-Control-Allow-Origin`. Those are server-side allowlist failures, so changing Vercel's already-correct URLs will not resolve them. Origin variables placed only in Vercel do not configure the Render processes.

The multiplayer client now loads lazily from the frontend's own assets rather than requiring `/socket.io/socket.io.js` to download from the backend within 12 seconds. Socket.IO still uses `VITE_SERVER_URL` and handles reconnection; this does not replace the required server-side origin setting. Commit/push the client update to rebuild Vercel. The production asset test includes lazy chunks as well as the main bundle.

Follow-up live verification: multiplayer now returns the correct frontend CORS header. Two temporary clients connected over WebSocket, created/joined their own party, and reached countdown with 135 HP each; both clients then disconnected. AI still returns HTTP 403 for the frontend origin. Vercel still serves the older `index-BzuOG_Vi.js` bundle, so the client-loading fix has not reached production. Fix the AI service's `MODEL_ALLOWED_ORIGINS` and deploy the frontend patch; multiplayer's origin setting no longer needs correction. This server test does not verify browser controls or a completed remote match.

## Local container check and future model updates

With Docker Desktop running:

```sh
docker build -f Dockerfile.ai -t block-brawl-ai .
docker run --rm -p 127.0.0.1:10000:10000 -e MODEL_ALLOWED_ORIGINS=http://localhost:5173 block-brawl-ai
```

Open `http://localhost:10000/health`. The port is bound to loopback for this local test. Stop the container with Ctrl+C.

After training a replacement compatible checkpoint, rerun `npm run ml:package`, review and commit the two release model files, then rebuild the AI service. You can pass an alternate archive with `npm run ml:package -- training/models/another-model.zip`. Never edit metadata hashes to bypass compatibility checks.

## Validation performed here

The packaged model loads and validates locally, its files match the source checkpoint, and the Linux CPython 3.11 CPU wheel for the pinned PyTorch version is available. Frontend/configuration and model-origin tests are covered by the normal regression suite. The complete image build was attempted but could not run because the Docker daemon was stopped. No successful Linux container execution, Render deployment, Vercel configuration change or cross-internet match is claimed.

## If installation fails on typing-extensions or flit_core

The first image version used Debian's older pip and resolved all torch dependencies through the PyTorch-only index. That produced an inconsistent typing-extensions metadata error, followed by a missing `flit_core` build dependency. The corrected `Dockerfile.ai` upgrades pip, downloads only the CPU torch wheel from PyTorch with `--no-deps --only-binary=:all:`, then installs torch's dependencies and the AI requirements from PyPI. `pip check` verifies the installed dependency graph before model validation. A Linux/Python 3.11 resolution check passes for the CPU wheel and AI requirements, without NVIDIA packages. Push the corrected Dockerfile and manually deploy the latest commit; game settings and the model checkpoint do not need changing for this error. Full container execution still needs validation on Docker or Render.
