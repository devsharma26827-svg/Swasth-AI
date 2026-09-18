# SwasthAI REST API Reference

The SwasthAI backend exposes a RESTful JSON HTTP API for authentication, physiological screening, checkup orchestration, longitudinal metrics, clinical reports, and administrative management.

All API endpoints are prefixed with `/api`.

---

## Authentication & Headers

Protected endpoints require a Bearer token in the `Authorization` header:

```http
Authorization: Bearer <JWT_OR_MOCK_TOKEN>
Content-Type: application/json
```

---

## System & Health Endpoints

### 1. System Health Check
- **GET** `/health`
- **Auth**: Public
- **Response**:
```json
{
  "status": "ok",
  "app": "SwasthAI",
  "version": "2.0.0-multi-user",
  "environment": "development",
  "ml_mode": "real",
  "uptimeSeconds": 342,
  "timestamp": "2026-09-18T12:00:00.000Z"
}
```

### 2. Service Readiness
- **GET** `/ready`
- **Auth**: Public
- **Response**:
```json
{
  "status": "ready",
  "database": "active_multi_user_store",
  "storage": "local_abstraction_ready",
  "model_service": "ready_heart_and_camera_gait"
}
```

---

## Authentication Endpoints

### 1. User Login
- **POST** `/api/auth/login`
- **Auth**: Public
- **Request**:
```json
{
  "email": "user@swasthai.com",
  "password": "Password123!"
}
```
- **Response**:
```json
{
  "success": true,
  "token": "jwt_mock_token_dev_2026_valid",
  "refreshToken": "jwt_mock_refresh_dev_2026_valid",
  "user": {
    "id": "usr_patient_1",
    "name": "Alex Mercer",
    "email": "user@swasthai.com",
    "role": "USER",
    "age": 28,
    "sex": "male",
    "height": 175,
    "weight": 70
  }
}
```

### 2. User Registration
- **POST** `/api/auth/register`
- **Auth**: Public
- **Request**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePassword123!",
  "age": 30,
  "sex": "female",
  "height": 165,
  "weight": 58
}
```

### 3. User Logout
- **POST** `/api/auth/logout`
- **Auth**: Authenticated

### 4. Current User Session
- **GET** `/api/auth/me`
- **Auth**: Authenticated

---

## Physiological Screening APIs

### 1. Camera Optical PPG Screening
- **POST** `/api/measurements/ppg`
- **Auth**: Authenticated
- **Request**:
```json
{
  "mode": "real",
  "redValues": [180.2, 181.5, 182.1, 181.8],
  "greenValues": [72.1, 72.8, 73.1, 72.9],
  "blueValues": [54.0, 54.3, 54.5, 54.2],
  "fps": 30
}
```
- **Response**:
```json
{
  "success": true,
  "measurement": {
    "heartRate": 72,
    "hrvRmssd": 38,
    "estimatedSpO2": 98,
    "signalQuality": 94,
    "confidence": "high",
    "confidenceScore": 0.92,
    "waveformSamples": [1.2, 2.4, 0.8, -1.1],
    "status": "normal",
    "explanation": "Resting pulse and microvascular autonomic variability within reference targets.",
    "timestamp": "2026-09-18T12:05:00.000Z",
    "source": "camera_ppg",
    "disclaimer": "Optical transmission estimation. Not a diagnostic electrocardiogram or clinical pulse oximeter."
  }
}
```

### 2. Heart Sound Auscultation (`HeartSoundCNN`)
- **POST** `/api/screening/heart-sound`
- **Auth**: Authenticated
- **Request**:
```json
{
  "mode": "real",
  "audioSamples": [0.01, 0.04, -0.02, 0.15],
  "sampleRate": 2000
}
```
- **Response**:
```json
{
  "success": true,
  "screening": {
    "heartSoundPattern": "Normal S1/S2 Lub-Dub Rhythm",
    "patternType": "normal_s1_s2",
    "s1S2Clarity": 88,
    "murmurProbability": 0.12,
    "signalQuality": 90,
    "confidence": "high",
    "confidenceScore": 0.91,
    "status": "normal",
    "explanation": "Normal periodic S1 and S2 acoustic clicks detected without systolic/diastolic murmur plateau.",
    "timestamp": "2026-09-18T12:06:00.000Z",
    "disclaimer": "Phonocardiogram acoustic screening aid. Does not substitute for physician stethoscope or echocardiogram.",
    "modelVersion": "heart_sound_cnn_v1"
  }
}
```

### 3. Respiratory Cough Acoustic Screening
- **POST** `/api/screening/cough`
- **Auth**: Authenticated
- **Request**:
```json
{
  "mode": "real",
  "audioSamples": [0.05, 0.82, 0.45, 0.12],
  "sampleRate": 44100
}
```

### 4. Motion Sensor Gait Screening
- **POST** `/api/screening/gait`
- **Auth**: Authenticated
- **Request**:
```json
{
  "readings": [
    { "x": 0.12, "y": 9.81, "z": 0.15, "timestampMs": 1726660000000 },
    { "x": 0.15, "y": 10.42, "z": 0.18, "timestampMs": 1726660000500 }
  ]
}
```

### 5. Camera Vision Gait Kinematics
- **POST** `/api/measurements/gait/camera`
- **Auth**: Authenticated
- **Request**:
```json
{
  "durationSeconds": 6.0,
  "fps": 30,
  "frames": []
}
```

### 6. Weight & BMI Tracker
- **POST** `/api/measurements/bmi`
- **Auth**: Authenticated
- **Request**:
```json
{
  "heightCm": 175,
  "weightKg": 70
}
```

---

## Checkups & Risk Assessment

### 1. Active Checkup Session
- **GET** `/api/checkups/current`
- **POST** `/api/checkups`
- **POST** `/api/checkups/:id/complete`

### 2. Risk Assessment Summary
- **GET** `/api/risk/summary`
- **Auth**: Authenticated
- **Response**:
```json
{
  "success": true,
  "risk": {
    "overallStatus": "normal",
    "riskScore": 12,
    "confidence": "high",
    "confidenceScore": 0.91,
    "recommendedAction": "Maintain routine wellness checkups and daily physical activity.",
    "trendInsight": "Vitals remain stable across recent measurements.",
    "modulesTestedCount": 4
  }
}
```

---

## Administrative & Governance APIs

- **GET** `/api/admin/stats` (`admin.portal.access`)
- **GET** `/api/admin/users` (`admin.patients.list`)
- **GET** `/api/admin/audit-logs` (`admin.audit.read`)
- **POST** `/api/admin/demo-scenario` (`admin.simulation.execute`)
