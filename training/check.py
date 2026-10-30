# ============================================================
# CHECK TRAINING DEPENDENCIES AND ENVIRONMENT
# ============================================================

"""Fast installation, environment, reproducibility and full-match checks."""
import numpy as np
from stable_baselines3.common.env_checker import check_env
from boxing_env import BoxingEnv


# ------------------------------------------------------------
# RUN THE COMMAND LINE WORKFLOW
# ------------------------------------------------------------

def main ():

    env = BoxingEnv()
    try:
        check_env(env, warn=True)
        first, _ = env.reset(seed=123)
        sequence = [env.step(0)[0].copy() for _ in range(5)]
        again, _ = env.reset(seed=123)
        assert np.array_equal(first, again), "Seeded reset must be reproducible"
        for expected in sequence:
            assert np.array_equal(expected, env.step(0)[0])
        rng = np.random.default_rng(50)
        env.reset(seed=99)
        for _ in range(8000):
            valid = np.flatnonzero(env.action_masks())
            _, reward, terminated, truncated, info = env.step(int(rng.choice(valid)))
            assert info["accepted"], "A masked legal action was rejected"
            assert np.isfinite(reward)
            if terminated or truncated:
                assert terminated, "Match exceeded the safety time limit"
                print("Full match completed:", info["result"], "/", info["reason"])
                break
        else:
            raise AssertionError("Match never ended")
        print("ALL CHECKS PASSED: packages, bridge, Gymnasium, action masks, seeded matches and cleanup.")
    finally:
        env.close()


if __name__ == "__main__":
    main()
