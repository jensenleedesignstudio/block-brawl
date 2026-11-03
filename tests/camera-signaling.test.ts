import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraOffer } from "../src/camera-signaling";
import { isCameraSignal } from "../shared/camera";

test("camera messages validate SDP type, candidate sizes and connection identities", () => {
    for (const value of [
        { type: "hello", session: "peer-1" },
        {
            type: "offer",
            session: "peer-1",
            target: "peer-2",
            description: { type: "offer", sdp: "v=0" }
        },
        { type: "answer", description: { type: "answer", sdp: "v=0" } },
        {
            type: "candidate",
            candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 }
        }
    ])
        assert.equal(isCameraSignal(value), true);
    for (const value of [
        null,
        { type: "unknown" },
        { type: "hello", session: "x".repeat(65) },
        { type: "offer", description: "not an SDP object" },
        { type: "offer", description: { type: "answer", sdp: "v=0" } },
        { type: "offer", description: { type: "offer", sdp: "x".repeat(16001) } },
        { type: "hello", candidate: { candidate: "unexpected" } },
        { type: "candidate", candidate: { candidate: "x".repeat(2049) } },
        { type: "candidate", candidate: { candidate: "candidate:1", sdpMLineIndex: -1 } }
    ])
        assert.equal(isCameraSignal(value), false);
});

test("a lost camera offer is retransmitted without repeatedly restarting ICE", async () => {
    let restarts = 0;
    const state = {
        signalingState: "stable",
        connectionState: "new",
        localDescription: null as RTCSessionDescriptionInit | null,
        restartIce: () => {
            restarts++;
        },
        createOffer: async () => ({ type: "offer", sdp: "v=0" }),
        setLocalDescription: async (description: RTCSessionDescriptionInit) => {
            state.localDescription = description;
            state.signalingState = description.type === "rollback" ? "stable" : "have-local-offer";
        }
    };
    const connection = state as unknown as RTCPeerConnection;
    assert.equal((await cameraOffer(connection))?.sdp, "v=0");
    assert.equal((await cameraOffer(connection))?.sdp, "v=0");
    assert.equal(restarts, 1, "a missing answer must not cause an ICE restart loop");
    await cameraOffer(connection, true);
    assert.equal(restarts, 2, "a newly joined camera replaces the obsolete negotiation");
    state.signalingState = "stable";
    state.connectionState = "connected";
    assert.equal(await cameraOffer(connection), null);
    assert.notEqual(
        await cameraOffer(connection, true),
        null,
        "a returning peer can replace a connected old session"
    );
    state.signalingState = "closed";
    assert.equal(await cameraOffer(connection), null);
});
