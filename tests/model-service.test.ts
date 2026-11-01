import { test } from "node:test";
import assert from "node:assert/strict";
import { modelServiceUrl } from "../src/model-service";
import { LearnedBot } from "../shared/learned-ai";
import { createMatch } from "../shared/combat";
import { POLICY_VERSION } from "../shared/learning";
import { readFileSync } from "node:fs";

test("Vercel routes this project's model calls through its own origin", () => {
    for (const origin of ["https://block-brawl-ecru.vercel.app", "https://block-brawl-preview.vercel.app"])
        assert.equal(modelServiceUrl(`${origin}/`, "https://block-brawl.onrender.com/"), `${origin}/api/opponent`);
    assert.equal(modelServiceUrl("https://boxing.example/", "/api/opponent"), "https://boxing.example/api/opponent");
    assert.equal(modelServiceUrl("http://localhost:5173/", "https://block-brawl.onrender.com"), "https://block-brawl.onrender.com");
    assert.equal(modelServiceUrl("https://boxing.vercel.app/", "https://other-model.example"), "https://other-model.example");
    assert.equal(modelServiceUrl("https://boxing.example/", "//other-model.example"), null);
});

test("model proxy forwards only health and prediction endpoints without caching", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    assert.deepEqual(config.rewrites, [
        { source: "/api/opponent/health", destination: "https://block-brawl.onrender.com/health" },
        { source: "/api/opponent/predict", destination: "https://block-brawl.onrender.com/predict" }
    ]);
    const headers = config.headers.find((rule: { source: string }) => rule.source === "/api/opponent/:path*");
    for (const key of ["Cache-Control", "CDN-Cache-Control", "Vercel-CDN-Cache-Control"])
        assert.ok(headers.headers.some((header: { key: string; value: string }) => header.key === key && header.value === "no-store"));
});

test("public sites require an explicitly configured trained-model endpoint", () => {
    assert.equal(modelServiceUrl("https://boxing.vercel.app/"), null);
    assert.equal(modelServiceUrl("https://boxing.example/", "   "), null);
    assert.equal(modelServiceUrl("http://localhost:5173/"), "http://127.0.0.1:8766");
    assert.equal(modelServiceUrl("http://127.0.0.1:3001/"), "http://127.0.0.1:8766");
    assert.equal(modelServiceUrl("http://[::1]:5173/"), "http://127.0.0.1:8766");
});

test("hosted model URLs are normalized and invalid or mixed-content endpoints are rejected", () => {
    const page = "https://boxing.vercel.app/";
    assert.equal(
        modelServiceUrl(page, " https://models.example/boxing/ "),
        "https://models.example/boxing"
    );
    for (const endpoint of [
        "invalid",
        "http://models.example",
        "file:///model",
        "https://user:password@models.example",
        "https://models.example?key=secret",
        "https://models.example#predict"
    ]) {
        assert.equal(modelServiceUrl(page, endpoint), null, endpoint);
    }
});

test("all trained difficulty tiers send predictions to the configured service", async () => {
    const original = globalThis.fetch;
    const requests: string[] = [];
    try {
        globalThis.fetch = async (url) => {
            requests.push(String(url));
            return new Response(JSON.stringify({ version: POLICY_VERSION, action: 0 }));
        };
        const endpoints = [
            "https://models.example/boxing",
            modelServiceUrl("https://block-brawl-ecru.vercel.app/", "https://block-brawl.onrender.com")!
        ];
        for (const endpoint of endpoints) {
            for (const difficulty of ["easy", "medium", "hard"] as const) {
                const match = createMatch();
                match.phase = "fight";
                const bot = new LearnedBot(difficulty, 1, endpoint);
                bot.update(match);
                await new Promise((resolve) => setTimeout(resolve, 10));
                assert.equal(bot.status, "ready");
            }
        }
        assert.deepEqual(requests, endpoints.flatMap((endpoint) => Array(3).fill(`${endpoint}/predict`)));
    } finally {
        globalThis.fetch = original;
    }
});
