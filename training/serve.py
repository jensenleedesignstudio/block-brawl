# ============================================================
# SERVE TRAINED OPPONENT DECISIONS
# ============================================================

"""Prediction service with local defaults and explicit hosted-origin configuration."""
import argparse
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import numpy as np
import torch
from sb3_contrib import MaskablePPO
from boxing_env import BoxingEnv
from common import MODEL, validate_model, run_cli


# ------------------------------------------------------------
# RUN THE COMMAND LINE WORKFLOW
# ------------------------------------------------------------

def main ():

    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=str(MODEL))
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--host", default=os.environ.get("MODEL_HOST", "127.0.0.1"))
    parser.add_argument("--check", action="store_true", help="Validate and load the model, then exit without serving")
    parser.add_argument(
        "--allowed-origin", action="append",
        default=[
            origin.strip().rstrip("/")
            for origin in os.environ.get("MODEL_ALLOWED_ORIGINS", "").split(",")
            if origin.strip()
        ],
        help="Exact frontend origin allowed to call the model; repeat for multiple origins"
    )
    args = parser.parse_args()
    args.allowed_origin = {origin.rstrip("/") for origin in args.allowed_origin}
    torch.set_num_threads(1)
    env = BoxingEnv()
    try:
        model = MaskablePPO.load(validate_model(args.model, env), device="cpu")
        version, size, count = env.version, env.observation_space.shape[0], env.action_space.n
    finally:
        env.close()
    if args.check:
        print(f'Model verified: {model.num_timesteps} training steps, policy version {version}.', flush=True)
        return
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def origin_allowed (self):

            origin = self.headers.get("Origin")
            if not origin:
                return True
            parsed = urlparse(origin)
            return (
                origin in args.allowed_origin
                or (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1", "::1"))
            )

        def reply (self, status, payload=None):

            body = json.dumps(payload).encode() if payload is not None else b''
            self.send_response(status)
            origin = self.headers.get("Origin")
            if origin and self.origin_allowed():
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS (self):

            self.reply(204 if self.origin_allowed() else 403)

        def do_GET (self):

            if not self.origin_allowed():
                return self.reply(403, {"error": "Game origin is not allowed"})
            self.reply(200, {"ok": True, "version": version, "timesteps": model.num_timesteps}) if self.path == "/health" else self.reply(404)

        def do_POST (self):

            if not self.origin_allowed():
                return self.reply(403, {"error": "Game origin is not allowed"})
            if self.path != "/predict":
                return self.reply(404)
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 16384:
                    return self.reply(413, {"error": "Invalid request size"})
                data = json.loads(self.rfile.read(length))
                obs = np.asarray(data["observation"], dtype=np.float32)
                mask = np.asarray(data["action_mask"])
                if (data["version"] != version or obs.shape != (size,) or not np.isfinite(obs).all() or
                        (obs < 0).any() or (obs > 1).any() or mask.shape != (count,) or
                        mask.dtype != np.bool_ or not mask.any()):
                    raise ValueError("Invalid policy input")
                with lock:
                    action, _ = model.predict(obs, action_masks=mask, deterministic=True)
                self.reply(200, {"action": int(action), "version": version})
            except (ValueError, KeyError, TypeError):
                self.reply(400, {"error": "Invalid policy input"})

        def log_message (self, *_args):

            pass

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'Trained boxer ready at http://{args.host}:{server.server_port} ({model.num_timesteps} training steps).', flush=True)
    print("Keep this terminal open. All CPU difficulties now use this trained policy.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nModel service stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    run_cli(main)
