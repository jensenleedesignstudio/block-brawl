// ============================================================
// START PYTHON TRAINING AND MODEL TOOLS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const root = fileURLToPath(new URL("../", import.meta.url));
const python = path.join(
    root,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
);
const scripts = {
    check: "check.py",
    train: "train.py",
    evaluate: "evaluate.py",
    serve: "serve.py"
};
const task = process.argv[2];
if (!scripts[task]) {
    console.error("Choose check, train, evaluate or serve.");

    process.exit(1);
}
if (!existsSync(python)) {
    console.error(
        "Project Python environment not found. Create .venv and install training/requirements.txt first."
    );

    process.exit(1);
}
const child = spawn(
    python,
    ["-u", path.join(root, "training", scripts[task]), ...process.argv.slice(3)],
    { cwd: root, stdio: "inherit" }
);
// Terminal Ctrl+C also reaches Python, which saves training before it exits.
process.on("SIGINT", () => {});
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("error", (error) => {
    console.error(error.message);

    process.exitCode = 1;
});
child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
});
