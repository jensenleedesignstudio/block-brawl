// ============================================================
// COPY LOCAL CAMERA TRACKING DEPENDENCIES
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("@mediapipe/tasks-vision"));
const destination = "public/mediapipe";
const bundleCandidates = ["vision_bundle.cjs", "vision_bundle.js"];
const bundle = bundleCandidates.map((name) => join(source, name)).find(existsSync);
const wasm = join(source, "wasm");

if (!bundle) {
    throw new Error(
        `MediaPipe bundle was not found in ${source}. Looked for ${bundleCandidates.join(", ")}. ` +
            "Reinstall @mediapipe/tasks-vision and try again."
    );
}
if (!existsSync(wasm)) {
    throw new Error(
        `MediaPipe WASM directory was not found at ${wasm}. Reinstall @mediapipe/tasks-vision and try again.`
    );
}

mkdirSync(destination, { recursive: true });
rmSync(join(destination, "wasm"), { recursive: true, force: true });
cpSync(bundle, join(destination, "vision_bundle.js"));
cpSync(wasm, join(destination, "wasm"), { recursive: true });
console.log(
    `Copied MediaPipe ${relative(source, bundle)} and WASM assets for the classic pose worker.`
);
