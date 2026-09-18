# SwasthAI Camera Gait Extension

## Overview
This module introduces video-based computer vision gait analysis to SwasthAI using fixed-camera pose estimation and objective biomechanical kinematic feature extraction.

### Architecture
1. **Pose Landmark Extraction** (`production_pipeline/extract_landmarks.py`):
   - Uses MediaPipe PoseLandmarker in `RunningMode.VIDEO`
   - Key anatomical joints tracked:
     - Left / Right Shoulder (indices 11, 12)
     - Left / Right Hip (indices 23, 24)
     - Left / Right Knee (indices 25, 26)
     - Left / Right Ankle (indices 27, 28)
   - Quality metrics: Frame count, detected pose ratio, missed frame tracking.

2. **Feature Extraction** (`synthetic_poc/features.py`):
   - `cadence_steps_per_min`: Frequency of heel-strikes and stance transitions normalized to steps/min.
   - `step_symmetry_index`: Percent symmetry comparing left vs. right step intervals.
   - `pelvic_drop_asymmetry`: Coronal plane difference in vertical hip elevation during contralateral stance.
   - `pelvic_drop_max`: Peak pelvic tilt angle (degrees).
   - `trunk_sway_amplitude`: Coronal lateral excursion of shoulder midpoint relative to hip midpoint.
   - `knee_rom_asymmetry`: Sagittal plane angular range of motion difference between left and right knee flexion/extension.
   - `stance_asymmetry`: Left vs. right foot contact duration ratio.

3. **Inference & Model Protocol** (`synthetic_poc/predict.py`):
   - Model outputs: Screening categories (`NORMAL`, `MONITOR`, `FOLLOW_UP`, `INSUFFICIENT_QUALITY`).
   - Clinical disclaimer: Screening aid only. Explicitly does NOT diagnose clinical syndromes (e.g. Trendelenburg, Parkinsonian gait, Ataxia, Antalgic gait) without clinician oversight.
   - Mode support: `REAL` (live camera frames) and `DEMO/SYNTHETIC` for testing and evaluation.
