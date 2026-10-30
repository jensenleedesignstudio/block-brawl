// ============================================================
// PACKAGE THE VALIDATED TRAINED MODEL FOR HOSTING
// ============================================================

import { cpSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = path.join(
    root,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
);
const requestedModel = path.resolve(root, process.argv[2] || "training/models/boxer-120s-135hp.zip");
const model = requestedModel.endsWith(".zip") ? requestedModel : `${requestedModel}.zip`;
const validation = spawnSync(python, ["training/serve.py", "--model", model, "--check"], {
    cwd: root,
    stdio: "inherit"
});

if (validation.error || validation.status !== 0) {
    console.error(
        validation.error?.message || "Model validation failed; no release files were copied."
    );
    process.exit(1);
}

const destination = path.join(root, "deployment/model");
mkdirSync(destination, { recursive: true });
cpSync(model, path.join(destination, "boxer.zip"));
cpSync(model.replace(/\.zip$/, ".json"), path.join(destination, "boxer.json"));
console.log(
    "Prepared deployment/model/boxer.zip and boxer.json. Committing these files includes the trained weights in your repository."
);
