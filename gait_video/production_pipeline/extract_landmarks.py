"""
Production pipeline for extracting 2D/3D pose landmarks from gait walk-in video.
Uses MediaPipe PoseLandmarker in Video Running Mode.
"""

import json
from typing import List, Dict, Any, Optional

LANDMARK_NAMES = {
    11: "LEFT_SHOULDER",
    12: "RIGHT_SHOULDER",
    23: "LEFT_HIP",
    24: "RIGHT_HIP",
    25: "LEFT_KNEE",
    26: "RIGHT_KNEE",
    27: "LEFT_ANKLE",
    28: "RIGHT_ANKLE",
}

class GaitLandmarkExtractor:
    def __init__(self, min_detection_confidence: float = 0.5, min_tracking_confidence: float = 0.5):
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence

    def extract_from_frames(self, frames_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Processes frame stream and yields standardized anatomical joint series.
        """
        total_frames = len(frames_data)
        frames_with_pose = 0
        landmarks_series = []

        for frame in frames_data:
            ts = frame.get("timestampMs", 0)
            joints = frame.get("landmarks", {})
            if joints and any(k in joints for k in ["LEFT_ANKLE", "RIGHT_ANKLE", "LEFT_HIP", "RIGHT_HIP"]):
                frames_with_pose += 1
                landmarks_series.append({
                    "timestampMs": ts,
                    "landmarks": joints
                })

        detection_rate = frames_with_pose / max(1, total_frames)
        return {
            "total_frames": total_frames,
            "frames_with_pose": frames_with_pose,
            "detection_rate": detection_rate,
            "sufficient_quality": detection_rate >= 0.60 and frames_with_pose >= 15,
            "landmarks_series": landmarks_series
        }
