# ============================================================
# OFFLINE BOXING MODEL TRAINING
# ============================================================

"""Train offline. Ctrl+C saves progress safely; --resume continues a saved model."""
import argparse
import torch
from sb3_contrib import MaskablePPO
from stable_baselines3.common.callbacks import CheckpointCallback
from stable_baselines3.common.monitor import Monitor
from boxing_env import BoxingEnv, ROOT
from common import MODEL, model_path, save_model, validate_model, run_cli


# ------------------------------------------------------------
# RUN THE COMMAND LINE WORKFLOW
# ------------------------------------------------------------

def main ():

    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=int, default=100_000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--opponent", choices=["easy", "medium", "hard", "mixed"], default="mixed")
    parser.add_argument("--output", default=str(MODEL))
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    if args.steps < 1:
        parser.error("--steps must be positive")
    torch.set_num_threads(1)
    base = BoxingEnv(opponent=args.opponent)
    log_dir = ROOT / "training/runs"
    log_dir.mkdir(parents=True, exist_ok=True)
    env = Monitor(base, str(log_dir / "training"))
    try:
        if args.resume:
            model = MaskablePPO.load(validate_model(args.output, base), env=env, device="cpu")
        else:
            if model_path(args.output).exists():
                raise FileExistsError("Model already exists. Use --resume or a different --output.")
            model = MaskablePPO("MlpPolicy", env, n_steps=1024, batch_size=64,
                                policy_kwargs={"net_arch": [64, 64]}, device="cpu", seed=args.seed, verbose=1)
        print("Training against the real combat engine. Ctrl+C saves progress.", flush=True)
        try:
            model.learn(total_timesteps=args.steps, reset_num_timesteps=not args.resume,
                        callback=CheckpointCallback(save_freq=25_000, save_path=str(log_dir / "checkpoints")))
        except KeyboardInterrupt:
            print("\nStopping and saving current progress...", flush=True)
        save_model(model, args.output, base)
    finally:
        env.close()


if __name__ == "__main__":
    run_cli(main)
