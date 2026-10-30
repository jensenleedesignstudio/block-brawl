# ============================================================
# BOXING SIMULATION ENVIRONMENT FOR TRAINING
# ============================================================

"""Gymnasium adapter around the actual TypeScript game; no duplicate combat rules."""
import json
import selectors
import subprocess
from pathlib import Path
import gymnasium as gym
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


# ------------------------------------------------------------
# CONNECT THE TRAINING ENVIRONMENT TO THE REAL GAME
# ------------------------------------------------------------

class BoxingEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__ (self, opponent="mixed", opponent_mode="mixed"):

        super().__init__()
        self.opponent = opponent
        self.opponent_mode = opponent_mode
        self.process = subprocess.Popen(
            ["node", "--import", "tsx", str(ROOT / "training/bridge.ts")],
            cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1,
        )
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ)
        description = self.request({"command": "describe"})
        self.version = description["version"]
        self.actions = description["actions"]
        self.action_space = gym.spaces.Discrete(len(self.actions))
        self.observation_space = gym.spaces.Box(0.0, 1.0, (description["observation_size"],), dtype=np.float32)
        self._mask = np.ones(len(self.actions), dtype=bool)
        self._done = True

    def request (self, payload):

        if self.process.poll() is not None:
            raise RuntimeError("Combat simulator stopped. Check the terminal above for errors.")
        self.process.stdin.write(json.dumps(payload) + "\n")
        self.process.stdin.flush()
        if not self.selector.select(timeout=30):
            self.close()
            raise TimeoutError("Combat simulator did not respond within 30 seconds.")
        line = self.process.stdout.readline()
        if not line:
            raise RuntimeError("Combat simulator closed its output unexpectedly.")
        response = json.loads(line)
        if not response.get("ok"):
            raise RuntimeError(response.get("error", "Combat bridge error"))
        return response

    def unpack (self, response):

        observation = np.asarray(response["observation"], dtype=np.float32)
        if not self.observation_space.contains(observation):
            raise ValueError("Combat observation does not match the training schema.")
        self._mask = np.asarray(response["action_mask"], dtype=bool)
        if self._mask.shape != (self.action_space.n,) or not self._mask.any():
            raise ValueError("Combat action mask is invalid.")
        return observation, response["info"]

    def reset (self, *, seed=None, options=None):

        super().reset(seed=seed)
        response = self.request({"command": "reset", "seed": int(self.np_random.integers(0, 2**32)),
                                 "opponent": self.opponent, "opponent_mode": self.opponent_mode})
        self._done = False
        return self.unpack(response)

    def step (self, action):

        if self._done:
            raise RuntimeError("Call reset() before starting the next match.")
        if not self.action_space.contains(action):
            raise ValueError("Action must be a valid integer action index.")
        response = self.request({"command": "step", "action": int(action)})
        observation, info = self.unpack(response)
        info["accepted"] = response["accepted"]
        self._done = response["terminated"] or response["truncated"]
        return observation, float(response["reward"]), response["terminated"], response["truncated"], info

    def action_masks (self):

        return self._mask.copy()

    def close (self):

        if getattr(self, "process", None) is not None:
            if self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait()
            if self.process.stdin:
                self.process.stdin.close()
            if self.process.stdout:
                self.process.stdout.close()
            if getattr(self, "selector", None):
                self.selector.close()
