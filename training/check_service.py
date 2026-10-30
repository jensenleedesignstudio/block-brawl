# ============================================================
# CHECK THE LOCAL MODEL SERVICE
# ============================================================

"""Verify a running local model service, including malformed input rejection."""
import argparse
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from boxing_env import BoxingEnv

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8766)
parser.add_argument("--origin", default="http://localhost:5177")
args = parser.parse_args()
base = f'http://127.0.0.1:{args.port}'
with urlopen(base + "/health", timeout=5) as response:
    assert json.load(response)["ok"]
env = BoxingEnv()
try:
    obs, _ = env.reset(seed=10)
    payload = dict(version=env.version, observation=obs.tolist(), action_mask=env.action_masks().tolist())

    def request (data, origin=args.origin):

        return urlopen(Request(base + "/predict", data=json.dumps(data).encode(),
                              headers={"Content-Type": "application/json", "Origin": origin}), timeout=5)

    with request(payload) as response:
        answer = json.load(response)
        assert env.action_masks()[answer["action"]]
        assert response.headers["Access-Control-Allow-Origin"] == args.origin
        print("Valid masked prediction:", answer)
    for data, origin, expected in [({**payload, "version": -1}, args.origin, 400),
                                   ({**payload, "action_mask": [False]*env.action_space.n}, args.origin, 400),
                                   (payload, "https://untrusted.example", 403)]:
        try:
            request(data, origin)
            raise AssertionError("Invalid request was accepted")
        except HTTPError as error:
            assert error.code == expected
    print("SERVICE CHECKS PASSED: prediction, schema validation, action masks and origin restrictions.")
finally:
    env.close()
