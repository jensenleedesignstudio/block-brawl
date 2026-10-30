// ============================================================
// BACKGROUND CAMERA POSE PROCESSING
// ============================================================

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

/* A classic worker is intentional: MediaPipe 0.10.32 loads WASM with importScripts. */
let pose = null;
let hands = null;
let handError = "Loading palm tracking… J / K also work.";
self.onmessage = async ({ data }) => {
    const { type, bitmap, timestamp } = data;

    try {
        if (type === "init") {
            // MediaPipe 0.10.32 ships its classic-compatible browser bundle as CJS.
            // Providing `exports` lets importScripts expose the API in this worker.
            self.exports = {};

            importScripts("/mediapipe/vision_bundle.js");

            const mediaPipe = self.exports;

            const fileset = await mediaPipe.FilesetResolver.forVisionTasks("/mediapipe/wasm");

            pose = await mediaPipe.PoseLandmarker.createFromOptions(fileset, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                    delegate: "CPU"
                },
                runningMode: "VIDEO",
                numPoses: 1,
                minPoseDetectionConfidence: 0.5,
                minPosePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            // Palm tracking loads independently; keyboard recovery remains available
            // if its model cannot load, without disabling ordinary pose controls.
            void mediaPipe.HandLandmarker.createFromOptions(fileset, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: "CPU"
                },
                runningMode: "VIDEO",
                numHands: 2,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5
            })
                .then((model) => {
                    hands = model;

                    handError = "";
                })
                .catch(() => {
                    handError = "Palm tracking unavailable. Alternate J / K to get up.";
                });

            self.postMessage({ type: "ready" });
        } else if (type === "frame" && pose) {
            const result = pose.detectForVideo(bitmap, timestamp);

            let recoveryHands = [];

            if (data.recovery && hands) {
                try {
                    const detected = hands.detectForVideo(bitmap, timestamp);

                    handError = "";

                    recoveryHands = detected.landmarks.map((landmarks, i) => ({
                        landmarks,
                        worldLandmarks: detected.worldLandmarks[i],
                        handedness: detected.handedness[i][0].categoryName,
                        score: detected.handedness[i][0].score
                    }));
                } catch {
                    handError = "Palm tracking interrupted. Alternate J / K to get up.";
                }
            }

            self.postMessage({
                type: "pose",
                recoveryHands,
                handError,
                landmarks: result.landmarks[0] || [],
                worldLandmarks: result.worldLandmarks[0] || [],
                timestamp
            });
        }
    } catch (error) {
        self.postMessage({
            type: "error",
            message: error instanceof Error ? error.message : "Pose tracking failed"
        });
    } finally {
        bitmap?.close();
    }
};
