import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

/** Start the installed local policy alongside the game, without requiring it for online play. */
export function startLocalModel (): () => void {
    let stopped = false;
    let child: ChildProcess | undefined;
    if (process.env.AUTO_START_MODEL !== "0") {
        void (async () => {
            try {
                const response = await fetch("http://127.0.0.1:8766/health", {
                    signal: AbortSignal.timeout(1500)
                });
                if (response.ok && ((await response.json()) as { ok?: boolean }).ok) return;
            } catch {
                /* No model service yet; launch the installed environment below. */
            }
            if (stopped) return;
            const root = process.cwd();
            const python = path.join(
                root,
                ".venv",
                process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
            );
            const script = path.join(root, "training/serve.py");
            if (!existsSync(python) || !existsSync(script)) {
                console.log(
                    "CPU model environment not installed. Online parties remain available; see training/README.md for CPU setup."
                );
                return;
            }
            console.log("Starting the trained CPU opponent…");
            child = spawn(python, ["-u", script], { cwd: root, stdio: "inherit" });
            child.on("error", (error) =>
                console.error(`CPU model startup failed: ${error.message}`)
            );
            child.on("exit", (code, signal) => {
                if (!stopped && (code || signal))
                    console.error("CPU model stopped. Run npm run ml:serve to restart it.");
            });
        })();
    }
    return () => {
        stopped = true;
        child?.kill("SIGTERM");
    };
}
