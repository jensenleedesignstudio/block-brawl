import { test } from "node:test";
import assert from "node:assert/strict";
import { artworkStatus, loadArtwork, retryArtwork } from "../src/game/artwork-loading";

test("artwork waits for every download and material pass, and failed images can retry", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "Image");
    const images: FakeImage[] = [];
    class FakeImage {
        onload = () => {};
        onerror = () => {};
        requests = 0;
        set src (_path: string) {
            this.requests++;
        }
        constructor () {
            images.push(this);
        }
    }
    Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: FakeImage
    });
    try {
        let prepared = 0;
        loadArtwork("/art/fighter.png", () => {
            prepared++;
        });
        loadArtwork("/art/gym.png", () => {
            prepared++;
        });
        assert.equal(artworkStatus(), "loading");
        images[0].onload();
        assert.equal(artworkStatus(), "loading", "one image must not reveal partial graphics");
        images[1].onerror();
        assert.equal(artworkStatus(), "error");
        retryArtwork();
        assert.equal(images[0].requests, 1, "loaded images are retained");
        assert.equal(images[1].requests, 2);
        assert.equal(artworkStatus(), "loading");
        images[1].onload();
        assert.equal(artworkStatus(), "ready");
        assert.equal(prepared, 2);

        let fail = true;
        loadArtwork("/art/material.png", () => {
            if (fail) throw new Error("Material processing failed");
        });
        images[2].onload();
        assert.equal(artworkStatus(), "error");
        fail = false;
        retryArtwork();
        images[2].onload();
        assert.equal(artworkStatus(), "ready");
    } finally {
        if (original) Object.defineProperty(globalThis, "Image", original);
        else Reflect.deleteProperty(globalThis, "Image");
    }
});
