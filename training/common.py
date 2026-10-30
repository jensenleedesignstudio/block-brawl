# ============================================================
# MODEL PATHS, COMPATIBILITY, AND SAFE SAVING
# ============================================================

import json
import hashlib
import sys
from pathlib import Path
from boxing_env import ROOT

MODEL = ROOT / "training/models/boxer-120s-135hp.zip"


# ------------------------------------------------------------
# REPORT SETUP ERRORS FROM A COMMAND LINE TOOL
# ------------------------------------------------------------

def run_cli (main):

    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        print(f'\nSetup needed: {error}', file=sys.stderr)
        raise SystemExit(1) from None


# ------------------------------------------------------------
# IDENTIFY THE COMBAT ENGINE USED BY THE MODEL
# ------------------------------------------------------------

def engine_hash ():

    return hashlib.sha256(
        (ROOT / "shared/combat.ts").read_bytes()
        + (ROOT / "shared/learning.ts").read_bytes()
    ).hexdigest()


# ------------------------------------------------------------
# RESOLVE THE MODEL ARCHIVE LOCATION
# ------------------------------------------------------------

def model_path (value):

    path = Path(value).expanduser().resolve()
    return path if path.suffix == ".zip" else path.with_suffix(".zip")


# ------------------------------------------------------------
# CHECK MODEL FILES AND ENGINE COMPATIBILITY
# ------------------------------------------------------------

def validate_model (path, env):

    path = model_path(path)
    if not path.is_file():
        raise FileNotFoundError("No trained model yet. Run npm run ml:train first.")
    metadata = path.with_suffix(".json")
    if not metadata.is_file():
        raise ValueError("Missing model schema file. Train a new model with this project.")
    data = json.loads(metadata.read_text())
    if (
        data.get("engine_hash") != engine_hash()
        or data["version"] != env.version
        or data["actions"] != env.actions
        or data["observation_size"] != env.observation_space.shape[0]
    ):
        raise ValueError("Model schema differs from this game. Train a new model.")
    return path


# ------------------------------------------------------------
# SAVE THE MODEL AND ITS COMPATIBILITY METADATA
# ------------------------------------------------------------

def save_model (model, path, env):

    path = model_path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    model.save(path)
    path.with_suffix(".json").write_text(json.dumps({
        "version": env.version, "actions": env.actions,
        "observation_size": env.observation_space.shape[0],
        "timesteps": model.num_timesteps,
        "engine_hash": engine_hash(),
    }, indent=2) + "\n")
    print(f'\nSaved model: {path}', flush=True)
