# SwasthAI Development & Local Setup Guide

This guide provides complete instructions for cloning, setting up, building, running, and testing SwasthAI locally.

---

## Prerequisites

Before starting, ensure your system has the following software installed:

- **Node.js**: `v18.0.0` or higher (Recommended: `v20.x` or `v22.x`)
- **npm**: `v9.0.0` or higher (bundled with Node.js)
- **Python**: `3.9+` (Optional, only needed if training/evaluating PyTorch models in `heart_model/` or landmark extraction in `gait_video/`)
- **Git**: `2.30+`

---

## Quick Start (3 Steps)

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/your-username/swasthai.git
cd swasthai
npm install
```

### 2. Configure Environment Variables

Copy the example environment template:

```bash
# On Linux/macOS
cp .env.example .env

# On Windows PowerShell
Copy-Item .env.example .env
```

Review `.env` parameters:
- `PORT=3000`
- `NODE_ENV=development`
- `ML_MODE=real`
- `HEART_SOUND_MODEL_PATH=heart_model/heart_sound_model.pt`

### 3. Run Development Server

```bash
npm run dev
```

Open your browser at `http://localhost:3000` to access the SwasthAI application.

---

## Seed Accounts & RBAC

When running in development mode, default accounts are pre-seeded in the in-memory store:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Patient (User)** | `user@swasthai.com` | `Password123!` | Routine screening, checkup sessions, personal health reports |
| **Operator** | `operator@swasthai.com` | `Operator@Swasth2026!` | Patient list view, clinical summary inspection |
| **Admin** | `admin@swasthai.com` | `Admin@Swasth2026!` | Full admin dashboard, audit log reading, demo scenario controller |

To re-seed or generate new admin credentials, run:

```bash
python scripts/create_admin.py
```

---

## Running Verification Tests

SwasthAI includes automated end-to-end and module unit verification test suites:

```bash
# Run all 3 verification test suites
npm test

# Run individual test suites
npm run test:e2e     # End-to-End System Verification Test
npm run test:heart   # HeartSoundCNN ML Model Test Suite
npm run test:ppg     # Camera PPG Optical Signal Processing Test Suite
```

---

## Building for Production

To create an optimized production build:

```bash
# 1. Check TypeScript compilation
npm run lint

# 2. Build Vite SPA and bundle Express server to dist/server.cjs
npm run build

# 3. Start production server
npm start
```

---

## Troubleshooting

### Port Conflicts (`EADDRINUSE: port 3000`)
Change `PORT` in your `.env` file:
```bash
PORT=3001 npm run dev
```

### Microphone / Camera Access Denied
Browsers require secure context (`https://` or `http://localhost`) for `navigator.mediaDevices.getUserMedia`. Ensure you are accessing the app via `http://localhost:3000` or `http://127.0.0.1:3000`.
