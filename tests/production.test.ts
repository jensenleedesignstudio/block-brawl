import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createArenaServer } from "../server/index.js";

test(
    "production serves real assets, revalidates HTML and keeps private project files inaccessible",
    {
        skip: !existsSync("dist/index.html") && "Run npm run build before production checks"
    },
    async () => {
        const arena = createArenaServer();
        await new Promise<void>((resolve) => arena.http.listen(0, "127.0.0.1", resolve));
        try {
            const address = arena.http.address();
            assert.ok(address && typeof address !== "string");
            const base = `http://127.0.0.1:${address.port}`;
            const page = await fetch(base);
            assert.equal(page.status, 200);
            assert.equal(page.headers.get("x-powered-by"), null);
            assert.equal(page.headers.get("x-content-type-options"), "nosniff");
            assert.ok(!page.headers.get("cache-control")?.includes("immutable"));
            const html = await page.text();
            assert.match(html, /Block Brawl/);
            const assets = [
                ...new Set([
                    ...[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
                        (match) => match[1]
                    ),
                    ...readdirSync("dist/assets")
                        .filter((file) => /\.(js|css)$/.test(file))
                        .map((file) => `/assets/${file}`)
                ])
            ];
            assert.ok(assets.length >= 2);
            for (const asset of assets) {
                const response = await fetch(base + asset, { method: "HEAD" });
                assert.equal(response.status, 200, asset);
                assert.match(response.headers.get("cache-control") || "", /immutable/);
            }
            const art = new Set<string>([
                "/favicon.svg",
                "/pose-worker.js",
                "/mediapipe/vision_bundle.js",
                "/mediapipe/wasm/vision_wasm_internal.wasm",
                "/mediapipe/wasm/vision_wasm_internal.js",
                "/mediapipe/wasm/vision_wasm_nosimd_internal.wasm",
                "/mediapipe/wasm/vision_wasm_nosimd_internal.js"
            ]);
            for (const asset of assets) {
                const content = readFileSync(`dist${asset}`, "utf8");
                for (const match of content.matchAll(/["'(](\/art\/[^"')\s]+)["')]/g))
                    art.add(match[1]);
            }
            for (const asset of art) {
                const response = await fetch(base + asset, { method: "HEAD" });
                assert.equal(response.status, 200, `Missing production asset: ${asset}`);
            }
            for (const path of [
                "/.env",
                "/.git/config",
                "/server/index.ts",
                "/training/common.py",
                "/src/App.tsx"
            ]) {
                assert.equal((await fetch(base + path)).status, 404, path);
            }
            assert.equal(
                ((await (await fetch(base + "/api/health")).json()) as { ok: boolean }).ok,
                true
            );
        } finally {
            await arena.close();
        }
    }
);
