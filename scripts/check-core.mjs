// ============================================================
// COMPILE AND RUN THE CORE REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
rmSync(".test-build", { recursive: true, force: true });
execFileSync(
    process.execPath,
    [
        "node_modules/typescript/bin/tsc",
        "shared/combat.ts",
        "shared/ai.ts",
        "src/motion/gestures.ts",
        "src/motion/recovery.ts",
        "src/game/arena-world.ts",
        "src/game/punch-motion.ts",
        "src/game/renderer.ts",
        "src/game/reference-sprites.ts",
        "src/game/music.ts",
        "--outDir",
        ".test-build",
        "--target",
        "ES2022",
        "--module",
        "ESNext",
        "--moduleResolution",
        "Bundler",
        "--skipLibCheck",
        "--strict"
    ],
    { stdio: "inherit" }
);
execFileSync(
    process.execPath,
    [
        "--test",
        "tests/combat.test.mjs",
        "tests/gestures.test.mjs",
        "tests/arena-world.test.mjs",
        "tests/recovery.test.mjs",
        "tests/punch-motion.test.mjs",
        "tests/renderer.test.mjs",
        "tests/reference-sprites.test.mjs",
        "tests/music.test.mjs",
        "tests/presentation.test.mjs"
    ],
    { stdio: "inherit" }
);
