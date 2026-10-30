# ============================================================
# EVALUATE A SAVED BOXING MODEL
# ============================================================

"""Evaluate reproducibly with action masks and held-out match seeds."""
import argparse
import json
import torch
from sb3_contrib import MaskablePPO
from boxing_env import BoxingEnv, ROOT
from common import MODEL, validate_model, run_cli


# ------------------------------------------------------------
# RUN THE COMMAND LINE WORKFLOW
# ------------------------------------------------------------

def main ():

    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=str(MODEL))
    parser.add_argument("--episodes", type=int, default=10, help="Matches per difficulty")
    parser.add_argument("--seed", type=int, default=100_000)
    args = parser.parse_args()
    if args.episodes < 1:
        parser.error("--episodes must be positive")
    torch.set_num_threads(1)
    report = {}
    for difficulty in ["easy", "medium", "hard"]:
        env = BoxingEnv(opponent=difficulty)
        try:
            model = MaskablePPO.load(validate_model(args.model, env), device="cpu")
            results = dict(win=0, loss=0, draw=0, truncated=0)
            dealt, received = [], []
            for episode in range(args.episodes):
                obs, info = env.reset(seed=args.seed + episode)
                done = False
                while not done:
                    action, _ = model.predict(obs, action_masks=env.action_masks(), deterministic=True)
                    obs, _, terminated, truncated, info = env.step(int(action))
                    done = terminated or truncated
                results["truncated" if truncated else info["result"]] += 1
                dealt.append(info["damage"]); received.append(info["damage_received"])
            report[difficulty] = {**results, "win_rate": results["win"] / args.episodes,
                "mean_damage": sum(dealt) / args.episodes, "mean_damage_received": sum(received) / args.episodes}
            print(difficulty.upper(), json.dumps(report[difficulty]), flush=True)
        finally:
            env.close()
    output = ROOT / "training/runs/evaluation.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(f'Results saved to {output}')


if __name__ == "__main__":
    run_cli(main)
