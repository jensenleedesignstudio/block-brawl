# Train your own boxing AI

Run these from the project folder. No source editing is needed.

1. `npm run ml:check` — wait for ALL CHECKS PASSED.
2. `npm run ml:train` — trains for 100,000 decisions. Wait for Saved model and the terminal prompt to return.
3. `npm run ml:evaluate` — tests 10 held-out matches per CPU difficulty and saves training/runs/evaluation.json.
4. `npm run ml:serve` — starts the saved model on loopback port 8766. Keep this terminal open.
5. Open a second terminal and run `npm run dev`. Open the address Vite prints. Choose VS CPU, select Easy, Medium or Hard, choose controls, and press LET’S FIGHT.

All CPU difficulties now use the trained policy, with existing difficulty-specific reaction delays and attack pacing; easy still disables ultimates. Hard requests decisions every two ticks and no longer substitutes scripted tactical actions. There is no scripted combat fallback. The start button waits for a compatible model service; if the service disconnects during play, the arena reports the problem and retries. Existing knockdown recovery handling remains separate because recovery is not a policy action. Combat rules and resources remain identical to the player's.

## More training

Stop the model service. Run `npm run ml:train -- --resume --steps 500000` to add 500,000 decisions, evaluate again, then restart the service. Ctrl+C during training saves progress. Plain training refuses to overwrite an existing model; use --resume or --output with a new name.

The main model is training/models/boxer-120s-135hp.zip, with schema metadata in boxer-120s-135hp.json. Keep both together. Game-rule or observation-schema changes invalidate old models; train a new output instead of resuming them.

## What is implemented

- MaskablePPO with a small 64×64 network, running on CPU.
- Twelve decisions: wait, jab, cross, hook, block, release, left/right slip, duck, advance, retreat, ultimate.
- One persistent Node bridge uses the real shared/combat.ts rules. Each decision advances four ticks. Countdown and get-up attempts are automatic.
- Viewpoint-relative game observations and the same action masks in training and live play. Camera footage is never used or uploaded.
- Seeded mixed CPU difficulties and mixed keyboard/motion opponent stamina rules. This version does not include self-play.
- Reward: damage balance divided by 20, ±2 per knockdown, ±10 for winning/losing.
- Asynchronous browser inference, stale-action rejection, legal-action rechecks, and no scripted combat fallback. Weights do not update during live play.

An initial training run is a baseline, not a guaranteed stronger fighter. Evaluate and watch it fight before judging it. Models, logs, Python caches and .venv are ignored by Git.

## Integration smoke test

`npm run ml:train -- --steps 1024 --output training/models/smoke.zip`

`npm run ml:evaluate -- --model training/models/smoke.zip --episodes 1`

Smoke models verify the wiring, not playing strength. You can choose a different file with --model on ml:serve and ml:evaluate, or --output on ml:train.

To rebuild dependencies, use Python 3.11+ in .venv and install training/requirements.txt. The project Node dependencies must also be installed.

References: [MaskablePPO](https://sb3-contrib.readthedocs.io/en/master/modules/ppo_mask.html), [Gymnasium API](https://gymnasium.farama.org/api/env/).
