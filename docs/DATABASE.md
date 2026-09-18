# SwasthAI Data Architecture & Storage Guide

This document details the data storage architecture, user data isolation, consent logging, and migration path for SwasthAI.

---

## Current Storage Architecture

Currently, SwasthAI utilizes an **In-Memory Data Store with Persistent JSON Seeding** (`server/mock_store.ts`). This design allows instant, zero-dependency local setup without requiring a running PostgreSQL database instance.

### Core Data Models

1. **User Account (`UserAccount`)**
   - `id`: Unique string identifier (`usr_*`).
   - `email`: Normalized email address.
   - `passwordHash`: Plaintext / SHA-256 password hash.
   - `role`: `USER` (Patient), `OPERATOR`, `ADMIN`, `SUPER_ADMIN`.
   - `profile`: Demographics (Name, Age, Sex, Height, Weight, Emergency Contacts, Conditions).
   - `ppgHistory`: Array of `PPGMeasurementResult`.
   - `heartSoundHistory`: Array of `HeartSoundResult`.
   - `coughHistory`: Array of `CoughResult`.
   - `gaitMotionHistory`: Array of `GaitResult`.
   - `gaitCameraHistory`: Array of `CameraGaitResult`.
   - `bmiHistory`: Array of `BMIResult`.
   - `checkups`: Array of `CheckupSession`.
   - `reports`: Array of `HealthReport`.
   - `appointments`: Array of `Appointment`.
   - `labBookings`: Array of `LabBooking`.
   - `consentLogs`: Array of privacy and clinical disclaimer consent timestamps.

2. **Checkup Session (`CheckupSession`)**
   - `id`: Session ID (`chk_*`).
   - `userId`: Owner user ID.
   - `cadenceType`: `daily` | `weekly` | `comprehensive`.
   - `modules`: State of each screening module (`not_started` | `in_progress` | `completed` | `skipped`).
   - `overallStatus`: Combined risk status.

3. **Audit Log (`AdminAuditLog`)**
   - Track administrative portal actions, patient summary inspections, and scenario adjustments with IP address and timestamp.

---

## User Data Isolation & Security

- **User Isolation**: All API routes (`/api/profile`, `/api/measurements/*`, `/api/checkups`, `/api/reports`) enforce token-based user isolation. Users can only read and write their own recordings.
- **RBAC Boundaries**: Non-admin users cannot access administrative list endpoints (`/api/admin/*`).
- **PHI Protection**: Exported personal health records (`/api/profile/export`) comply with data portability standards.

---

## Production Database Migration Path

To transition SwasthAI to a persistent PostgreSQL database:

```
[SwasthAI Server] ---> [Prisma ORM / TypeORM] ---> [PostgreSQL / Supabase]
```

### Proposed PostgreSQL Schema DDL

```sql
CREATE TYPE user_role AS ENUM ('USER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE health_status AS ENUM ('normal', 'monitor', 'follow_up', 'insufficient');

CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'USER',
    name VARCHAR(255) NOT NULL,
    age INT,
    sex VARCHAR(32),
    height_cm NUMERIC(5,2),
    weight_kg NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE heart_sound_screenings (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    prediction VARCHAR(64) NOT NULL,
    abnormal_probability NUMERIC(5,4) NOT NULL,
    confidence_score NUMERIC(5,4) NOT NULL,
    signal_quality INT NOT NULL,
    status health_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
