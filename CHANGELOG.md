# Changelog

All notable changes to **SwasthAI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-18

### Added
- **Multi-User Session & RBAC Engine**: Integrated patient session isolation, role-based authorization (`USER`, `OPERATOR`, `ADMIN`, `SUPER_ADMIN`), and admin audit trail logging.
- **In-Process HeartSoundCNN Inference Service**: Added Cooley-Tukey FFT + 64-band Mel filterbank preprocessor and PyTorch model adapter directly in TypeScript.
- **Optical Camera PPG Engine**: Added fingertip camera photoplethysmography processing with SQI quality checks, bandpass filtering, BPM, HRV (RMSSD), and SpO2 proxy estimation.
- **Camera Vision & Motion Gait Screening**: Integrated MediaPipe 2D/3D landmark kinematics and accelerometer/gyroscope cadence analysis.
- **Respiratory Acoustic Screening**: Added cough audio explosion blast and wheeze pattern classification.
- **Multi-Sensor Health Risk Engine**: Added weighted vitals risk scoring algorithm and clinical handoff summary generation.
- **Documentation Suite**: Added complete documentation in `/docs` (Architecture, API, Setup, Deployment, Database, ML, Security, Contributing).
- **GitHub Automation**: Added GitHub Actions CI workflow, PR template, and issue templates.

### Changed
- Standardized package configuration, cross-platform build scripts, and deduplicated Vite dependencies.
- Updated `.gitignore` to prevent secret and build artifact leakage.
