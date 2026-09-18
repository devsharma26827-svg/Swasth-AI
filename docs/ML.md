# SwasthAI Machine Learning & Signal Processing Pipeline

This document details the signal processing algorithms, deep learning architecture (`HeartSoundCNN`), MediaPipe pose kinematics, and optical PPG processing used in SwasthAI.

---

## 1. Phonocardiogram (PCG) Heart Sound Analysis

### Acoustic Preprocessing Pipeline

```
Raw Audio Signal (44.1kHz / 48kHz)
       │
       ▼ Linear Interpolation Resampling
2,000 Hz Standardized Audio Rate
       │
       ▼ 2nd-Order Butterworth Bandpass Filter (25Hz - 400Hz)
Filtered Cardiac Acoustic Frequencies
       │
       ▼ Peak Normalization [-1.0, 1.0]
Normalized Audio Buffer
       │
       ▼ Cooley-Tukey Radix-2 FFT (N=256, Hop=64)
STFT Power Spectrum
       │
       ▼ 64-Band Triangular Mel-Filterbank + Log10 Compression
Raw Mel-Spectrogram
       │
       ▼ Global Z-score Normalization (Zero Mean, Unit Variance)
Normalized Mel-Spectrogram [64 Mels × 128 Frames]
```

### Deep CNN Architecture (`HeartSoundCNN`)

`HeartSoundCNN` is implemented in PyTorch (`heart_model/production_pipeline/model.py`) and converted into an in-process TypeScript decision surface (`server/heart_sound_ml.ts`).

- **Input Tensor**: `[Batch, 1, 64, 128]` (1 channel, 64 Mel frequency bands, 128 time frames ~ 4.1 seconds audio window).
- **Architecture Structure**:
  - **Conv Block 1**: `Conv2D(1 -> 32, 3x3)`, `BatchNorm2D`, `ReLU`, `MaxPool2D(2x2)`, `Dropout(0.21)`. Features low-level S1 / S2 click transients.
  - **Conv Block 2**: `Conv2D(32 -> 64, 3x3)`, `BatchNorm2D`, `ReLU`, `MaxPool2D(2x2)`, `Dropout(0.30)`. Captures murmur modulations across Mel bands.
  - **Conv Block 3**: `Conv2D(64 -> 128, 3x3)`, `BatchNorm2D`, `ReLU`, `MaxPool2D(2x2)`, `Dropout(0.30)`. High-level cardiac cycle rhythm.
  - **Adaptive Pooling**: `AdaptiveAvgPool2d((4, 4))` producing fixed `[Batch, 128, 4, 4]` (2048 dimensions).
  - **Dense Classifier**: `Linear(2048 -> 128)`, `BatchNorm1D`, `ReLU`, `Dropout(0.39)`, `Linear(128 -> 2)`.
- **Output Classes**:
  - Class 0: `normal` (Periodic S1/S2 lub-dub without murmur plateau).
  - Class 1: `abnormal_pattern` (Systolic/diastolic murmur or arrhythmic irregularity).

---

## 2. Optical Fingertip PPG Signal Processing

Camera photoplethysmography measures microvascular blood volume changes using ambient/flash light reflected through the user's fingertip:

1. **Color Channel Extraction**: Averages RGB pixel intensity within a central ROI over video frames at 30 FPS.
2. **Quality Evaluation (SQI)**:
   - Rejects flatline signals (zero AC component).
   - Rejects under-exposed (too dark) or over-exposed (light leak) signals.
   - Computes Green-to-Red channel ratio to confirm human flesh contact.
3. **Bandpass Filtering**: 2nd-order bandpass filter (0.7 Hz - 3.5 Hz) isolating heart rate frequencies (42 BPM - 210 BPM).
4. **Peak Detection**: Detects systolic peak candidates using local maxima search with dynamic thresholding.
5. **Vitals Computation**:
   - **Heart Rate (BPM)**: Derived from mean Inter-Beat Interval (IBI).
   - **HRV (RMSSD)**: Root Mean Square of Successive Differences between IBIs.
   - **Estimated SpO2**: Ratio-of-Ratios proxy computed from AC/DC components of Red and Blue channels.

---

## 3. Video Pose Gait Kinematics

Uses 2D/3D anatomical landmark series (hips, knees, ankles, shoulders):

- **Cadence Calculation**: Step detection based on alternating ankle z-distance and vertical hip oscillations.
- **Symmetry Index**: Percentage similarity in stride time between left and right gait cycles:
  $$\text{Symmetry Index} = \left(1 - \frac{|T_{\text{left}} - T_{\text{right}}|}{\text{Mean}(T_{\text{left}}, T_{\text{right}})}\right) \times 100\%$$
- **Status Bounds**:
  - `normal`: Cadence 90 - 130 spm, step symmetry $\ge 85\%$.
  - `monitor`: Cadence 75 - 89 spm or 131 - 145 spm, step symmetry $70\% - 84\%$.
  - `follow_up`: Cadence $< 75$ spm or $> 145$ spm, step symmetry $< 70\%$.

---

## Model File Structure

- Metadata checkpoint: `heart_model/heart_sound_model.pt` (JSON metadata spec file).
- Production PyTorch code: `heart_model/production_pipeline/`.
- Synthetic POC code: `heart_model/synthetic_poc/`.
- Pose landmark extractor: `gait_video/production_pipeline/extract_landmarks.py`.
