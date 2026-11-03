/** Only player zero offers. Retransmit a lost offer without restarting ICE. */
export async function cameraOffer (
    connection: RTCPeerConnection,
    newPeer = false
): Promise<RTCSessionDescription | null> {
    if (connection.signalingState === "closed") return null;
    if (newPeer && connection.signalingState === "have-local-offer")
        await connection.setLocalDescription({ type: "rollback" });
    if (connection.signalingState === "have-local-offer") return connection.localDescription;
    if (connection.signalingState !== "stable") return null;
    if (!newPeer && ["connecting", "connected"].includes(connection.connectionState)) return null;
    connection.restartIce();
    await connection.setLocalDescription(await connection.createOffer());
    return connection.localDescription;
}
