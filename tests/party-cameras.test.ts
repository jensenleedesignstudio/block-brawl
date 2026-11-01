import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Socket } from "socket.io-client";
import { PartyCameras } from "../src/components/PartyCameras";
import { attachPartyCamera } from "../src/camera-media";

test("each player's local and opponent videos match the fixed fighter corners", () => {
    for (const index of [0, 1]) {
        const html = renderToStaticMarkup(
            createElement(PartyCameras, {
                socket: {} as Socket,
                index,
                motionStream: null,
                usesMotion: false,
                opponent: "FRIEND"
            })
        );
        assert.ok(
            html.includes(`party-camera-local party-camera-${index === 0 ? "left" : "right"}`)
        );
        assert.ok(
            html.includes(`party-camera-remote party-camera-${index === 0 ? "right" : "left"}`)
        );
        assert.equal((html.match(/<video /g) || []).length, 2);
        assert.equal((html.match(/muted=""/g) || []).length, 2);
    }
});

test("a joining camera attaches after its offered video channel arrives, with adaptive quality", async () => {
    const tracks: (MediaStreamTrack | null)[] = [];
    const parameters = { encodings: [{}] } as RTCRtpSendParameters;
    const channel = {
        receiver: { track: { kind: "video" } },
        direction: "recvonly",
        sender: {
            replaceTrack: async (track: MediaStreamTrack | null) => {
                tracks.push(track);
            },
            getParameters: () => parameters,
            setParameters: async () => {
                throw new Error("Browser cannot tune encoder");
            }
        }
    };
    let available = false;
    const connection = {
        signalingState: "stable",
        getTransceivers: () => (available ? [channel] : [])
    } as unknown as RTCPeerConnection;
    const track = { kind: "video" } as MediaStreamTrack;
    await attachPartyCamera(connection, track);
    assert.deepEqual(tracks, [], "capture before the offer is safe");
    available = true;
    await attachPartyCamera(connection, track);
    assert.equal(channel.direction, "sendrecv");
    assert.deepEqual(tracks, [track], "encoder tuning failure does not discard the video");
    assert.equal(parameters.encodings[0].maxFramerate, 30);
    assert.equal(parameters.encodings[0].maxBitrate, 1_200_000);
    await attachPartyCamera(connection, null);
    assert.deepEqual(tracks, [track, null], "stopping detaches without stopping borrowed tracks");
});
