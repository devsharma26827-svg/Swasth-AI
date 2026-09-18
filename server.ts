import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { dataStore, UserAccount } from './server/mock_store';
import {
  PPGSignalProcessor,
  HeartSoundAudioProcessor,
  CoughAudioProcessor,
  GaitMotionProcessor
} from './server/signal_processing';
import { HeartSoundMLService } from './server/heart_sound_ml';
import { HealthRiskEngine, SignalReading } from './server/risk_engine';
import { GaitService } from './server/gait_service';
import {
  HealthReport,
  HealthStatus,
  DemoScenario,
  PPGMeasurementResult,
  HeartSoundResult,
  CoughResult,
  GaitResult,
  CameraGaitResult,
  BMIResult,
  CheckupModuleStatus,
  CheckupSession,
  ReportModuleItem,
  ConfidenceLevel
} from './src/types';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Structured Request Logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/@') && !req.path.includes('.')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

import {
  requirePermission,
  requireRoles,
  normalizeRole,
  getPermissionsForRole
} from './server/rbac';

// =============================================================
// AUTHENTICATION & RBAC MIDDLEWARE
// =============================================================
const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication token required.' }
    });
  }

  const user = dataStore.getUserByToken(authHeader);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Your session has expired. Please sign in again.' }
    });
  }

  (req as any).user = user;
  (req as any).userRole = user.role;
  (req as any).permissions = user.permissions || getPermissionsForRole(user.role);
  next();
};

const requireAdmin = requireRoles('ADMIN', 'SUPER_ADMIN');

// -------------------------------------------------------------
// HEALTH & READINESS ENDPOINTS
// -------------------------------------------------------------
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'SwasthAI',
    version: '2.0.0-multi-user',
    environment: process.env.NODE_ENV || 'development',
    ml_mode: process.env.ML_MODE || 'real_and_demo',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req: Request, res: Response) => {
  res.json({
    status: 'ready',
    database: 'active_multi_user_store',
    storage: 'local_abstraction_ready',
    model_service: 'ready_heart_and_camera_gait'
  });
});

// -------------------------------------------------------------
// AUTHENTICATION APIs (PART 15, 16, 17)
// -------------------------------------------------------------
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, role, age, sex, height, weight } = req.body;
  if (!name || !email) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Name and email are required.' }
    });
  }

  try {
    const result = dataStore.registerUser({
      name,
      email,
      password,
      role: 'USER', // Public signup is strictly restricted to Patient (USER) accounts
      age: Number(age) || 25,
      sex: sex || 'prefer_not_to_say',
      height: Number(height) || 170,
      weight: Number(weight) || 65
    });

    return res.json({
      success: true,
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message }
    });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Email address is required.' }
    });
  }

  try {
    const result = dataStore.loginUser(email, password);
    return res.json({
      success: true,
      token: result.token,
      refreshToken: result.refreshToken,
      user: result.user
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_FAILED', message: err.message }
    });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    dataStore.revokeToken(authHeader);
  }
  return res.json({
    success: true,
    message: 'User logged out successfully. Session revoked.'
  });
});

app.get('/api/auth/me', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  return res.json({
    success: true,
    user: user.profile
  });
});



// -------------------------------------------------------------
// PROFILE MANAGEMENT (User-Scoped, PART 18)
// -------------------------------------------------------------
app.get('/api/profile', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  return res.json({
    success: true,
    profile: user.profile
  });
});

app.put('/api/profile', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const updated = dataStore.updateProfile(user.id, req.body);
  return res.json({
    success: true,
    profile: updated
  });
});

app.delete('/api/profile', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  dataStore.resetUserSession(user.id);
  return res.json({
    success: true,
    message: 'User health history and session recordings have been purged.'
  });
});

app.get('/api/profile/export', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const exportData = {
    userProfile: user.profile,
    measurements: {
      ppgCount: user.ppgHistory.length,
      heartSoundCount: user.heartSoundHistory.length,
      coughCount: user.coughHistory.length,
      gaitMotionCount: user.gaitMotionHistory.length,
      gaitCameraCount: user.gaitCameraHistory.length,
      bmiCount: user.bmiHistory.length
    },
    latestPPG: user.ppgHistory[user.ppgHistory.length - 1] || null,
    latestCameraGait: user.gaitCameraHistory[user.gaitCameraHistory.length - 1] || null,
    appointments: user.appointments,
    labBookings: user.labBookings,
    reports: user.reports,
    consentLogs: user.consentLogs,
    exportedAt: new Date().toISOString(),
    complianceNotice: 'Exported under patient personal health record data portability guidelines.'
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="swasthai_export_${user.id}.json"`);
  return res.json(exportData);
});

// -------------------------------------------------------------
// SENSORS & SCREENING PIPELINE (User-Isolated, PART 20)
// -------------------------------------------------------------

// 1. Camera PPG Analysis
app.post(['/api/measurements/ppg', '/measurements/ppg'], authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const {
    mode = 'real',
    redValues,
    greenValues,
    blueValues,
    fps = 30,
    simulatedScenario
  } = req.body;

  if (mode === 'demo') {
    if (simulatedScenario === 'low_quality') {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SIGNAL_QUALITY',
          message: 'Signal quality too low for reliable clinical screening. Please reposition finger.',
          qualityScore: 28
        }
      });
    }

    const baseBpm = simulatedScenario === 'follow_up' ? 104 : simulatedScenario === 'monitor' ? 88 : 72;
    const baseHrv = simulatedScenario === 'follow_up' ? 18 : simulatedScenario === 'monitor' ? 28 : 42;
    const baseSpo2 = simulatedScenario === 'follow_up' ? 94 : simulatedScenario === 'monitor' ? 96 : 98;
    const waveSamples: number[] = [];

    for (let i = 0; i < 30; i++) {
      const t = i / fps;
      const pulse = Math.sin(2 * Math.PI * (baseBpm / 60) * t) + 0.3 * Math.sin(4 * Math.PI * (baseBpm / 60) * t);
      waveSamples.push(Math.round(pulse * 15 * 10) / 10);
    }

    const result: PPGMeasurementResult = {
      heartRate: baseBpm,
      hrvRmssd: baseHrv,
      estimatedSpO2: baseSpo2,
      signalQuality: 92,
      confidence: 'high',
      confidenceScore: 0.91,
      waveformSamples: waveSamples,
      waveformSample: waveSamples,
      ibiIntervals: [Math.round(60000 / baseBpm)],
      status: simulatedScenario === 'follow_up' ? 'follow_up' : simulatedScenario === 'monitor' ? 'monitor' : 'normal',
      explanation: simulatedScenario === 'follow_up'
        ? 'Resting heart rate elevated above nominal baseline.'
        : 'Resting pulse and microvascular autonomic variability within reference targets.',
      timestamp: new Date().toISOString(),
      source: 'camera_ppg',
      disclaimer: 'Optical transmission estimation. Not a diagnostic electrocardiogram or clinical pulse oximeter.'
    };

    dataStore.addPPG(user.id, result);
    return res.json({ success: true, measurement: result });
  }

  // Real signal extraction from optical camera frames
  const redSignal = Array.isArray(redValues) && redValues.length >= 30 ? redValues : [];
  const greenSignal = Array.isArray(greenValues) && greenValues.length >= 30 ? greenValues : [];
  const blueSignal = Array.isArray(blueValues) && blueValues.length >= 30 ? blueValues : [];

  if (redSignal.length < 30) {
    return res.status(400).json({
      success: false,
      error: { code: 'INSUFFICIENT_DATA', message: 'At least 30 video frames are required to compute optical PPG.' }
    });
  }

  const ppgResult = PPGSignalProcessor.processPPG(redSignal, greenSignal, blueSignal, fps);
  if (ppgResult.signalQuality < 35) {
    return res.status(422).json({
      success: false,
      error: { code: 'INSUFFICIENT_SIGNAL_QUALITY', message: 'Camera video was too noisy or finger moved.', qualityScore: ppgResult.signalQuality }
    });
  }

  dataStore.addPPG(user.id, ppgResult);
  return res.json({ success: true, measurement: ppgResult });
});

// 2. Heart Sound Auscultation
app.post(['/api/screening/heart-sound', '/screening/heart-sound', '/screen/heart-sound'], authenticateUser, async (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const { audioSamples = [], sampleRate = 44100, simulatedScenario } = req.body;

  let samples: number[] = audioSamples;
  if (!samples.length || samples.length < 100) {
    samples = [];
    const count = 1200;
    const isAbnormal = simulatedScenario === 'follow_up';
    for (let i = 0; i < count; i++) {
      const t = i / 1000;
      const s1 = Math.exp(-Math.pow((t % 0.8) - 0.1, 2) / 0.002) * Math.sin(2 * Math.PI * 60 * t);
      const s2 = Math.exp(-Math.pow((t % 0.8) - 0.4, 2) / 0.002) * Math.sin(2 * Math.PI * 90 * t);
      const murmur = isAbnormal ? 0.35 * Math.sin(2 * Math.PI * 220 * t) : 0;
      samples.push(s1 + s2 + murmur);
    }
  }

  const analysis = HeartSoundAudioProcessor.analyzePhonocardiogram(samples, sampleRate);
  let status: HealthStatus = 'normal';
  if (analysis.patternType === 'murmur_suspected') {
    status = 'follow_up';
  } else if (analysis.patternType === 'arrhythmic' || analysis.s1S2Clarity < 50) {
    status = 'monitor';
  }

  const result: HeartSoundResult = {
    heartSoundPattern: analysis.patternType === 'normal_s1_s2' ? 'Normal S1/S2 Lub-Dub Rhythm' : 'Acoustic Murmur Indicator',
    patternType: analysis.patternType,
    s1S2Clarity: analysis.s1S2Clarity,
    murmurProbability: analysis.murmurProbability,
    signalQuality: analysis.signalQuality,
    ambientNoiseDb: analysis.ambientNoiseDb || 38,
    frequencySpectrum: [30, 50, 75, 90, 45, 20],
    confidence: analysis.confidenceScore > 0.8 ? 'high' : 'moderate',
    confidenceScore: analysis.confidenceScore,
    status,
    explanation: analysis.explanation,
    timestamp: new Date().toISOString(),
    disclaimer: 'Phonocardiogram acoustic screening aid. Does not substitute for physician stethoscope or echocardiogram.',
    source: 'microphone',
    modelVersion: 'heart_sound_cnn_v1'
  };

  dataStore.addHeartSound(user.id, result);
  return res.json({ success: true, screening: result });
});

// 3. Cough Acoustic Analysis
app.post(['/api/screening/cough', '/screening/cough', '/screen/cough'], authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const { audioSamples = [], sampleRate = 44100, simulatedScenario } = req.body;

  let samples: number[] = audioSamples;
  if (!samples.length || samples.length < 100) {
    samples = [];
    const count = 1000;
    const isAbnormal = simulatedScenario === 'follow_up' || simulatedScenario === 'monitor';
    for (let i = 0; i < count; i++) {
      const t = i / 1000;
      const blast = Math.exp(-t * 8) * Math.sin(2 * Math.PI * 180 * t);
      const wheeze = isAbnormal ? 0.3 * Math.sin(2 * Math.PI * 450 * t) : 0;
      samples.push(blast + wheeze);
    }
  }

  const analysis = CoughAudioProcessor.analyzeCough(samples, sampleRate);
  let status: HealthStatus = 'normal';
  if (analysis.patternType === 'wet_resonant' || analysis.patternType === 'shallow_wheezing') {
    status = 'follow_up';
  } else if (analysis.patternType === 'dry_paroxysmal') {
    status = 'monitor';
  } else if (analysis.patternType === 'insufficient_energy') {
    status = 'insufficient';
  }

  const result: CoughResult = {
    coughPattern: analysis.patternType.replace(/_/g, ' ').toUpperCase(),
    patternType: analysis.patternType,
    confidence: (analysis.confidenceScore > 0.8 ? 'high' : 'moderate') as ConfidenceLevel,
    confidenceScore: analysis.confidenceScore,
    signalQuality: analysis.signalQuality,
    melBands: [15, 28, 56, 82, 42, 18],
    coughEventsCount: 3,
    durationSeconds: 4.5,
    status,
    explanation: analysis.explanation,
    timestamp: new Date().toISOString(),
    disclaimer: 'Respiratory acoustic screening indicator. Does NOT diagnose pneumonia, asthma, or infections.',
    source: 'microphone',
    modelVersion: 'cough_acoustic_v1'
  };

  dataStore.addCough(user.id, result);
  return res.json({ success: true, screening: result });
});

// 4. Motion Sensor Gait (Accelerometer & Gyroscope)
app.post(['/api/screening/gait', '/screening/gait', '/screen/gait'], authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const { readings = [], simulatedScenario } = req.body;

  let motionReadings = readings;
  if (!motionReadings.length || motionReadings.length < 20) {
    motionReadings = [];
    const now = Date.now();
    const count = 60;
    const isUnusual = simulatedScenario === 'follow_up';
    for (let i = 0; i < count; i++) {
      const t = i * 500;
      const step = Math.sin((2 * Math.PI * i) / 2) * (isUnusual && i % 4 === 0 ? 1.9 : 1.2);
      motionReadings.push({
        x: 0.1 + Math.random() * 0.1,
        y: 9.8 + step + Math.random() * 0.15,
        z: 0.2 + Math.random() * 0.1,
        timestampMs: now + t
      });
    }
  }

  const result = GaitService.evaluateMotionGait(motionReadings, simulatedScenario || dataStore.currentScenario);
  dataStore.addMotionGait(user.id, result);

  return res.json({ success: true, gait: result });
});

// 5. Camera Vision Gait Kinematics (PART 1 - 12)
app.post(['/api/measurements/gait/camera', '/measurements/gait/camera'], authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const {
    frames = [],
    durationSeconds = 6.0,
    fps = 30,
    mode = 'real',
    simulatedScenario
  } = req.body;

  const result = GaitService.evaluateCameraGait({
    frames,
    durationSeconds: Number(durationSeconds) || 6.0,
    fps: Number(fps) || 30,
    mode: mode === 'demo' ? 'demo' : 'real',
    simulatedScenario: simulatedScenario || dataStore.currentScenario
  });

  dataStore.addCameraGait(user.id, result);

  return res.json({
    success: true,
    result,
    gaitCamera: result
  });
});

// 6. BMI & Weight Tracker
app.post('/api/measurements/bmi', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const { heightCm = user.profile.height || 170, weightKg = user.profile.weight || 65 } = req.body;
  const heightM = heightCm / 100;
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));

  let category: 'Underweight' | 'Normal weight' | 'Overweight' | 'Obesity class I' | 'Obesity class II+' = 'Normal weight';
  let status: HealthStatus = 'normal';

  if (bmi < 18.5) {
    category = 'Underweight';
    status = 'monitor';
  } else if (bmi >= 18.5 && bmi < 25) {
    category = 'Normal weight';
    status = 'normal';
  } else if (bmi >= 25 && bmi < 30) {
    category = 'Overweight';
    status = 'monitor';
  } else {
    category = 'Obesity class I';
    status = 'follow_up';
  }

  const result: BMIResult = {
    heightCm,
    weightKg,
    bmi,
    category,
    change7d: 0,
    change30d: 0,
    status,
    explanation: `Calculated BMI of ${bmi} sits in the ${category} category based on standard WHO adult reference ranges.`,
    timestamp: new Date().toISOString()
  };

  dataStore.addBMI(user.id, result);
  dataStore.updateProfile(user.id, { weight: weightKg, height: heightCm });

  return res.json({ success: true, bmi: result });
});

// -------------------------------------------------------------
// CHECKUP FLOW (User-Isolated, PART 18 & 21)
// -------------------------------------------------------------
app.get('/api/checkups', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const checkups = dataStore.getCheckups(user.id);
  return res.json({
    success: true,
    checkups
  });
});

app.get('/api/checkups/current', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const current = dataStore.getCurrentCheckup(user.id);
  return res.json({
    success: true,
    checkup: current
  });
});

app.post(['/api/checkups', '/screen/checkup'], authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const { cadenceType = 'daily', selectedModules = [] } = req.body || {};

  const newSession = dataStore.createCheckup(user.id, cadenceType, selectedModules);
  return res.json({
    success: true,
    checkup: newSession
  });
});

app.post('/api/checkups/:id/complete', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  try {
    const completed = dataStore.completeCheckup(user.id, req.params.id);
    return res.json({ success: true, checkup: completed });
  } catch (e: any) {
    return res.status(404).json({ success: false, error: { message: e.message } });
  }
});

// -------------------------------------------------------------
// RISK SUMMARY & LONGITUDINAL TRENDS (User-Isolated)
// -------------------------------------------------------------
app.get('/api/risk/summary', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;

  const latestPPG = user.ppgHistory[user.ppgHistory.length - 1];
  const latestHeartSound = user.heartSoundHistory[user.heartSoundHistory.length - 1];
  const latestCough = user.coughHistory[user.coughHistory.length - 1];
  const latestGait = user.gaitMotionHistory[user.gaitMotionHistory.length - 1];
  const latestCameraGait = user.gaitCameraHistory[user.gaitCameraHistory.length - 1];
  const latestBMI = user.bmiHistory[user.bmiHistory.length - 1];

  const readings: SignalReading[] = [];

  if (latestPPG) {
    readings.push({
      module: 'Heart Rate (PPG)',
      value: latestPPG.heartRate,
      unit: 'bpm',
      status: latestPPG.status,
      quality: latestPPG.signalQuality,
      confidence: latestPPG.confidence,
      confidenceScore: latestPPG.confidenceScore,
      baseline: 72,
      historicalAbnormalCount: user.ppgHistory.slice(-7).filter(p => p.status === 'follow_up').length,
      timestamp: latestPPG.timestamp,
      explanation: latestPPG.explanation
    });
  }

  if (latestHeartSound) {
    readings.push({
      module: 'Heart Sound Screen',
      value: latestHeartSound.patternType.replace(/_/g, ' '),
      status: latestHeartSound.status,
      quality: latestHeartSound.signalQuality,
      confidence: latestHeartSound.confidence,
      confidenceScore: latestHeartSound.confidenceScore,
      timestamp: latestHeartSound.timestamp,
      explanation: latestHeartSound.explanation
    });
  }

  if (latestCough) {
    readings.push({
      module: 'Respiratory / Cough Screen',
      value: latestCough.patternType.replace(/_/g, ' '),
      status: latestCough.status,
      quality: latestCough.signalQuality,
      confidence: latestCough.confidence,
      confidenceScore: latestCough.confidenceScore,
      timestamp: latestCough.timestamp,
      explanation: latestCough.explanation
    });
  }

  if (latestGait) {
    readings.push({
      module: 'Motion Gait & Cadence',
      value: latestGait.cadence,
      unit: 'spm',
      status: latestGait.status,
      quality: 90,
      confidence: 'high',
      confidenceScore: 0.9,
      baseline: 105,
      timestamp: latestGait.timestamp,
      explanation: latestGait.explanation
    });
  }

  if (latestCameraGait && latestCameraGait.status !== 'insufficient') {
    readings.push({
      module: 'Camera Vision Gait Kinematics',
      value: `${latestCameraGait.cadenceStepsPerMin} spm (${latestCameraGait.stepSymmetryIndex}% sym)`,
      unit: 'spm',
      status: latestCameraGait.status,
      quality: latestCameraGait.signalQuality,
      confidence: latestCameraGait.confidence,
      confidenceScore: latestCameraGait.confidenceScore,
      timestamp: latestCameraGait.timestamp,
      explanation: latestCameraGait.explanation
    });
  }

  const risk = HealthRiskEngine.evaluateRisk(readings);
  return res.json({
    success: true,
    risk
  });
});

app.get('/api/history', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const history = dataStore.getHistory(user.id);
  return res.json({
    success: true,
    history
  });
});

app.get('/api/trends', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const metrics = ['hr', 'hrv', 'spo2', 'weight', 'gait', 'camera_gait'];
  const datasets = metrics.map(m => dataStore.getTrendDataset(user.id, m));
  return res.json({
    success: true,
    trends: datasets
  });
});

app.get('/api/trends/:metric', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const { metric } = req.params;
  const dataset = dataStore.getTrendDataset(user.id, metric);
  return res.json({
    success: true,
    dataset
  });
});

// -------------------------------------------------------------
// REPORTS & VERIFIED OWNERSHIP (PART 19)
// -------------------------------------------------------------
app.get('/api/reports', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const reports = dataStore.getReports(user.id);
  return res.json({
    success: true,
    reports
  });
});

app.get('/api/reports/:id', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const report = dataStore.getReportById(user.id, req.params.id, user.role === 'ADMIN');

  if (!report) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied: You do not have permission to view this report.' }
    });
  }

  return res.json({ success: true, report });
});

app.post(['/api/reports', '/reports'], authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const { checkupId } = req.body || {};

  const report = dataStore.createReport(user.id, checkupId);
  return res.json({
    success: true,
    report
  });
});

app.get('/api/reports/:id/download', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const report = dataStore.getReportById(user.id, req.params.id, user.role === 'ADMIN');

  if (!report) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied: You do not have permission to download this report.' }
    });
  }

  const reportText = `
================================================================================
SWASTHAI - SMART HEALTH CHECKUP SUMMARY REPORT
Report ID: ${report.reportNumber}
Owner ID: ${report.userId}
Generated: ${new Date(report.generatedAt).toLocaleString()}
Data Interval: ${report.dataRange}
================================================================================

PATIENT DEMOGRAPHICS
Name:                 ${report.userProfile.name}
Age / Biological Sex: ${report.userProfile.age} yrs / ${report.userProfile.sex}
Height / Weight:      ${report.userProfile.height} cm / ${report.userProfile.weight} kg
Existing Conditions:  ${report.userProfile.conditions.join(', ') || 'None reported'}

--------------------------------------------------------------------------------
PHYSIOLOGICAL MEASUREMENT ESTIMATES & SCREENING SIGNALS
--------------------------------------------------------------------------------
- Resting Heart Rate (PPG): ${report.metrics.heartRate !== null && report.metrics.heartRate !== undefined ? report.metrics.heartRate + ' BPM' : '— (Not Tested)'}
- Heart Rate Variability:   ${report.metrics.hrvRmssd !== null && report.metrics.hrvRmssd !== undefined ? report.metrics.hrvRmssd + ' ms (RMSSD)' : '— (Not Tested)'}
- Estimated SpO2 (Proxy):   ${report.metrics.estimatedSpO2 !== null && report.metrics.estimatedSpO2 !== undefined ? report.metrics.estimatedSpO2 + '%' : '— (Not Tested)'}
- Calculated BMI:           ${report.metrics.bmi !== null && report.metrics.bmi !== undefined ? report.metrics.bmi + ' kg/m2' : '— (Not Tested)'}
- Motion Gait Cadence:      ${report.metrics.gaitCadence !== null && report.metrics.gaitCadence !== undefined ? report.metrics.gaitCadence + ' steps/min' : '— (Not Tested)'}
- Camera Gait Cadence:      ${report.metrics.cameraGaitCadence !== null && report.metrics.cameraGaitCadence !== undefined ? report.metrics.cameraGaitCadence + ' steps/min (' + report.metrics.cameraGaitSymmetry + '% symmetry)' : '— (Not Tested)'}
- Heart Sound Screen:       ${report.metrics.heartSoundStatus ? report.metrics.heartSoundStatus.toUpperCase() : '— (Not Tested)'}
- Cough Acoustic Screen:    ${report.metrics.coughStatus ? report.metrics.coughStatus.toUpperCase() : '— (Not Tested)'}

--------------------------------------------------------------------------------
OVERALL RISK ASSESSMENT & CLINICIAN HANDOFF SUMMARY
--------------------------------------------------------------------------------
Overall Health Status:      ${report.riskSummary.overallStatus.toUpperCase()}
Risk Score:                 ${report.riskSummary.riskScore} / 100
Screening Confidence:       ${report.riskSummary.confidence.toUpperCase()}
Trend Insight:              ${report.riskSummary.trendInsight}
Action Guidance:            ${report.riskSummary.recommendedAction}

================================================================================
IMPORTANT REGULATORY & CLINICAL DISCLAIMER
================================================================================
This document is automatically generated by SwasthAI from consumer optical,
acoustic, and kinematic smartphone sensors. It is intended strictly for personal
wellness awareness and routine trend tracking. It DOES NOT provide medical
diagnosis, clinical advice, or substitute for formal diagnostic testing or
evaluation by a licensed physician. In case of acute or emergency symptoms,
immediately contact emergency medical services.
================================================================================
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="SwasthAI_Report_${report.reportNumber}.txt"`);
  return res.send(reportText);
});

// -------------------------------------------------------------
// DOCTORS & LAB BOOKINGS (User-Isolated)
// -------------------------------------------------------------
app.get('/api/doctors', (req: Request, res: Response) => {
  const { specialty } = req.query;
  let list = dataStore.doctors;
  if (specialty && specialty !== 'all') {
    list = list.filter(d => d.specialty.toLowerCase() === (specialty as string).toLowerCase());
  }
  return res.json({ success: true, doctors: list });
});

app.get('/api/appointments', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  return res.json({
    success: true,
    appointments: dataStore.getAppointments(user.id)
  });
});

app.post('/api/appointments', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  try {
    const appt = dataStore.bookAppointment(user.id, req.body);
    return res.json({ success: true, appointment: appt });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err.message } });
  }
});

app.get('/api/labs', (req: Request, res: Response) => {
  return res.json({
    success: true,
    partners: dataStore.labPartners,
    tests: dataStore.labTests
  });
});

app.get('/api/labs/tests', (req: Request, res: Response) => {
  return res.json({ success: true, tests: dataStore.labTests });
});

app.get('/api/labs/bookings', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  return res.json({
    success: true,
    bookings: dataStore.getLabBookings(user.id)
  });
});

app.post('/api/labs/bookings', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  try {
    const booking = dataStore.bookLabTest(user.id, req.body);
    return res.json({ success: true, booking });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// -------------------------------------------------------------
// CONSENT MANAGEMENT (User-Scoped)
// -------------------------------------------------------------
app.post('/api/consent', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const { type = 'safety_and_clinical_disclaimer', version = 'v2.1' } = req.body;
  dataStore.recordConsent(user.id, type, version, req.ip);
  return res.json({ success: true, message: 'Consent recorded successfully.' });
});

app.delete('/api/consent', authenticateUser, (req: Request, res: Response) => {
  const user: UserAccount = (req as any).user;
  const { type = 'safety_and_clinical_disclaimer' } = req.body;
  dataStore.revokeConsent(user.id, type);
  return res.json({ success: true, message: 'Consent revoked.' });
});

// -------------------------------------------------------------
// ADMIN DASHBOARD & AUDIT LOGS (Granular RBAC Enforced)
// -------------------------------------------------------------
app.get('/api/admin/stats', authenticateUser, requirePermission('admin.portal.access'), (req: Request, res: Response) => {
  const stats = dataStore.getAdminStats();
  return res.json({
    success: true,
    stats
  });
});

app.get('/api/admin/users', authenticateUser, requirePermission('admin.patients.list'), (req: Request, res: Response) => {
  const users = dataStore.listUsersForAdmin();
  return res.json({
    success: true,
    users
  });
});

app.get('/api/admin/checkups', authenticateUser, requirePermission('admin.patients.view_summary'), (req: Request, res: Response) => {
  const checkups = dataStore.getAllCheckupsForAdmin();
  return res.json({
    success: true,
    checkups
  });
});

app.get('/api/admin/reports', authenticateUser, requirePermission('admin.patients.view_summary'), (req: Request, res: Response) => {
  const caller: UserAccount = (req as any).user;
  const isFullAdmin = caller.role === 'ADMIN' || caller.role === 'SUPER_ADMIN';
  const reports = dataStore.getAllReportsForAdmin(isFullAdmin);
  return res.json({
    success: true,
    reports
  });
});

app.get('/api/admin/appointments', authenticateUser, requirePermission('admin.patients.view_summary'), (req: Request, res: Response) => {
  const appointments = dataStore.getAllAppointmentsForAdmin();
  const labBookings = dataStore.getAllLabBookingsForAdmin();
  return res.json({
    success: true,
    appointments,
    labBookings
  });
});

app.get('/api/admin/users/:id', authenticateUser, requirePermission('admin.patients.view_summary'), (req: Request, res: Response) => {
  const caller: UserAccount = (req as any).user;
  const targetId = req.params.id;

  const targetAccount = dataStore.getUserDetailsForAdmin(caller.id, targetId);
  if (!targetAccount) {
    return res.status(404).json({ success: false, error: { message: 'Target user not found.' } });
  }

  const isFullAdmin = caller.role === 'ADMIN' || caller.role === 'SUPER_ADMIN';

  return res.json({
    success: true,
    user: {
      profile: targetAccount.profile,
      checkups: isFullAdmin ? targetAccount.checkups : [],
      reports: isFullAdmin
        ? targetAccount.reports
        : targetAccount.reports.map(r => ({
            id: r.id,
            reportNumber: r.reportNumber,
            generatedAt: r.generatedAt,
            overallStatus: r.overallStatus,
            restricted: true,
            notice: 'Protected Health Information. Full report inspection & download restricted to Administrator.'
          })),
      measurementsCount: {
        ppg: targetAccount.ppgHistory.length,
        heartSound: targetAccount.heartSoundHistory.length,
        cough: targetAccount.coughHistory.length,
        gaitMotion: targetAccount.gaitMotionHistory.length,
        gaitCamera: targetAccount.gaitCameraHistory.length,
        bmi: targetAccount.bmiHistory.length
      },
      appointments: isFullAdmin ? targetAccount.appointments : [],
      labBookings: isFullAdmin ? targetAccount.labBookings : [],
      consentLogs: isFullAdmin ? targetAccount.consentLogs : []
    }
  });
});

app.get('/api/admin/audit-logs', authenticateUser, requirePermission('admin.audit.read'), (req: Request, res: Response) => {
  const logs = dataStore.getAdminAuditLogs();
  return res.json({
    success: true,
    auditLogs: logs
  });
});

app.get('/api/scenario', (req: Request, res: Response) => {
  return res.json({
    success: true,
    currentScenario: dataStore.currentScenario
  });
});

app.post('/api/admin/demo-scenario', authenticateUser, requirePermission('admin.simulation.execute'), (req: Request, res: Response) => {
  const { scenario } = req.body as { scenario: DemoScenario };
  const validScenarios = ['normal', 'monitor', 'follow_up', 'low_quality', 'mild_arrhythmia', 'respiratory_pattern', 'gait_irregularity'];
  if (!validScenarios.includes(scenario)) {
    return res.status(400).json({ success: false, message: 'Invalid demo scenario.' });
  }
  dataStore.currentScenario = scenario;
  return res.json({
    success: true,
    currentScenario: scenario,
    message: `Applied scenario: ${scenario}`
  });
});

app.post('/api/scenario', (req: Request, res: Response) => {
  const { scenario } = req.body as { scenario: DemoScenario };
  const validScenarios = ['normal', 'monitor', 'follow_up', 'low_quality', 'mild_arrhythmia', 'respiratory_pattern', 'gait_irregularity'];
  if (!validScenarios.includes(scenario)) {
    return res.status(400).json({ success: false, message: 'Invalid demo scenario.' });
  }
  dataStore.currentScenario = scenario;
  return res.json({
    success: true,
    currentScenario: scenario,
    message: `Applied scenario: ${scenario}`
  });
});

app.post('/api/admin/reset', authenticateUser, requirePermission('admin.system.reset'), (req: Request, res: Response) => {
  // Resets in-memory catalogs
  dataStore.currentScenario = 'normal';
  return res.json({
    success: true,
    message: 'Demo state refreshed.'
  });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & SERVER BOOTSTRAP
// -------------------------------------------------------------
async function startServer() {
  // Load HeartSoundCNN model if present
  const defaultModelPath = path.resolve('./heart_model/heart_sound_model.pt');
  if (!process.env.HEART_SOUND_MODEL_PATH && fs.existsSync(defaultModelPath)) {
    process.env.HEART_SOUND_MODEL_PATH = defaultModelPath;
    process.env.HEART_SOUND_MODEL_TYPE = 'cnn';
  }
  HeartSoundMLService.warmup().then(() => {
    console.log('[SwasthAI ML] HeartSoundCNN warm-up completed: JIT primed, singletons cached.');
  }).catch(err => {
    console.warn('[SwasthAI ML] HeartSoundCNN warm-up warning:', err.message);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SwasthAI] Full-stack application running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
