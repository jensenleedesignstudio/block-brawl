/** Bind to the negotiated video channel, including when capture precedes an offer. */
export async function attachPartyCamera (
    connection: RTCPeerConnection,
    track: MediaStreamTrack | null
): Promise<void> {
    const channel = connection
        .getTransceivers()
        .find((item) => item.receiver.track.kind === "video");
    if (!channel || connection.signalingState === "closed") return;
    channel.direction = "sendrecv";
    await channel.sender.replaceTrack(track);
    if (!track) return;
    // Limit outgoing bandwidth without changing the motion detector's capture.
    // Parameter tuning is optional: unsupported settings must not disable video.
    try {
        const parameters = channel.sender.getParameters();
        if (!parameters.encodings?.length) return;
        for (const encoding of parameters.encodings) {
            encoding.maxBitrate = 1_200_000;
            encoding.maxFramerate = 30;
        }
        await channel.sender.setParameters(parameters);
    } catch {
        // Retain the browser's adaptive encoding when tuning is unsupported.
    }
}
