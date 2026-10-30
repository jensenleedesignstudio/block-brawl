import { test } from "node:test";
import assert from "node:assert/strict";
import { modelServiceUrl } from "../src/model-service";
import { LearnedBot } from "../shared/learned-ai";
import { createMatch } from "../shared/combat";
import { POLICY_VERSION } from "../shared/learning";

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
        for (const difficulty of ["easy", "medium", "hard"] as const) {
            const match = createMatch();
            match.phase = "fight";
            const bot = new LearnedBot(difficulty, 1, "https://models.example/boxing");
            bot.update(match);
            await new Promise((resolve) => setTimeout(resolve, 10));
            assert.equal(bot.status, "ready");
        }
        assert.deepEqual(requests, Array(3).fill("https://models.example/boxing/predict"));
    } finally {
        globalThis.fetch = original;
    }
});
