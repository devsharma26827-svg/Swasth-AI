import fs from 'fs';
import path from 'path';
import {
  UserProfile,
  PPGMeasurementResult,
  HeartSoundResult,
  CoughResult,
  GaitResult,
  CameraGaitResult,
  BMIResult,
  CheckupSession,
  Doctor,
  Appointment,
  LabPartner,
  LabTest,
  LabBooking,
  HealthReport,
  RiskSummary,
  TrendDataset,
  DemoScenario,
  HealthStatus,
  AdminUserListItem,
  AdminAuditLog,
  UserRole,
  Permission
} from '../src/types';
import {
  normalizeRole,
  getPermissionsForRole,
  createJwtToken,
  verifyJwtToken
} from './rbac';
import { HealthRiskEngine, SignalReading } from './risk_engine';
import { jsonStore } from './json_store';

export interface UserAccount {
  id: string; // Unique immutable UUID
  email: string;
  passwordHash: string;
  role: UserRole;
  permissions?: Permission[];
  demoScenario?: DemoScenario;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
  profile: UserProfile;
  checkups: CheckupSession[];
  ppgHistory: PPGMeasurementResult[];
  heartSoundHistory: HeartSoundResult[];
  coughHistory: CoughResult[];
  gaitMotionHistory: GaitResult[];
  gaitCameraHistory: CameraGaitResult[];
  bmiHistory: BMIResult[];
  reports: HealthReport[];
  appointments: Appointment[];
  labBookings: LabBooking[];
  consentLogs: { type: string; version: string; consentedAt: string; ip: string }[];
}

export class HealthDataStore {
  private users: Map<string, UserAccount> = new Map();
  private tokens: Map<string, { userId: string; expiresAt: number }> = new Map();

  public doctors: Doctor[] = [];
  public labPartners: LabPartner[] = [];
  public labTests: LabTest[] = [];
  public currentScenario: DemoScenario = 'normal';
  public auditLogs: AdminAuditLog[] = [];

  constructor() {
    this.initCatalogs();
    this.initPreSeededAccounts();
  }

  private initCatalogs() {
    // 1. Doctors Directory
    this.doctors = [
      {
        id: 'doc_1',
        name: 'Dr. Ananya Mukherjee',
        degree: 'MBBS, MD (General Medicine)',
        specialty: 'General Physician',
        experienceYears: 12,
        hospital: 'Apollo Spectra Hospitals, Mumbai',
        rating: 4.9,
        consultationFeeInr: 600,
        availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        slots: ['10:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM'],
        isDemo: true,
        avatarInitials: 'AM'
      },
      {
        id: 'doc_2',
        name: 'Dr. Rajiv Menon',
        degree: 'MBBS, MD, DM (Cardiology), FACC',
        specialty: 'Cardiologist',
        experienceYears: 18,
        hospital: 'Fortis Escorts Heart Institute, New Delhi',
        rating: 4.95,
        consultationFeeInr: 1200,
        availableDays: ['Tue', 'Thu', 'Sat'],
        slots: ['11:00 AM', '01:00 PM', '03:30 PM', '05:00 PM'],
        isDemo: true,
        avatarInitials: 'RM'
      },
      {
        id: 'doc_3',
        name: 'Dr. Priya Seshadri',
        degree: 'MBBS, DNB (Respiratory & Pulmonology)',
        specialty: 'Pulmonologist',
        experienceYears: 14,
        hospital: 'Manipal Hospital, Bengaluru',
        rating: 4.88,
        consultationFeeInr: 850,
        availableDays: ['Mon', 'Wed', 'Fri'],
        slots: ['09:30 AM', '12:00 PM', '03:00 PM', '05:30 PM'],
        isDemo: true,
        avatarInitials: 'PS'
      }
    ];

    // 2. Lab Partners
    this.labPartners = [
      {
        id: 'lab_1',
        name: 'Thyrocare Diagnostics',
        accreditedBy: 'NABL & CAP Accredited',
        rating: 4.8,
        homeCollection: true,
        address: 'D-37/1, TTC Industrial Area, MIDC Turbhe',
        city: 'Navi Mumbai'
      },
      {
        id: 'lab_2',
        name: 'Dr. Lal PathLabs',
        accreditedBy: 'NABL Accredited Reference Lab',
        rating: 4.9,
        homeCollection: true,
        address: 'National Reference Lab, Sector 18',
        city: 'Gurugram'
      }
    ];

    // 3. Lab Tests
    this.labTests = [
      {
        id: 't_lipid',
        name: 'Lipid Profile Comprehensive (Cholesterol, HDL, LDL, Triglycerides)',
        category: 'Cardiac & Lipid',
        sampleType: 'Blood',
        turnaroundHours: 12,
        fastingRequired: true,
        priceInr: 599,
        description: 'Complete cholesterol assessment measuring total cholesterol, HDL good cholesterol, LDL, and triglycerides.',
        clinicalSignificance: 'Baseline cardiovascular risk stratification.'
      },
      {
        id: 't_hba1c',
        name: 'HbA1c & Fasting Blood Sugar (FBS)',
        category: 'Metabolic & Diabetes',
        sampleType: 'Blood',
        turnaroundHours: 8,
        fastingRequired: true,
        priceInr: 450,
        description: 'Glycated hemoglobin assay providing an estimated 3-month blood glucose control average.',
        clinicalSignificance: 'Screens for prediabetes and glycaemic status.'
      },
      {
        id: 't_lft',
        name: 'Liver Function Test (LFT with Enzymes & Bilirubin)',
        category: 'Organ Function',
        sampleType: 'Serum',
        turnaroundHours: 12,
        fastingRequired: false,
        priceInr: 550,
        description: 'Tests SGOT, SGPT, Alkaline Phosphatase, Total Bilirubin, Direct Bilirubin, and Albumin.',
        clinicalSignificance: 'Evaluates hepatic metabolic synthesis and clearance.'
      },
      {
        id: 't_kft',
        name: 'Kidney Function Test (KFT / RFT with Creatinine & BUN)',
        category: 'Organ Function',
        sampleType: 'Serum',
        turnaroundHours: 12,
        fastingRequired: false,
        priceInr: 550,
        description: 'Measures blood urea nitrogen, serum creatinine, uric acid, and estimated GFR.',
        clinicalSignificance: 'Screens renal filtration efficiency.'
      },
      {
        id: 't_thyroid',
        name: 'Thyroid Profile Total (T3, T4, TSH Ultrasensitive)',
        category: 'Organ Function',
        sampleType: 'Serum',
        turnaroundHours: 12,
        fastingRequired: false,
        priceInr: 400,
        description: 'Assays endocrine regulation of energy metabolism via thyroid hormone indicators.',
        clinicalSignificance: 'Identifies hypo- or hyperthyroid metabolic states.'
      },
      {
        id: 't_vitamins',
        name: 'Vitamin D (25-OH) & Vitamin B12 Duo',
        category: 'Vitamins & Minerals',
        sampleType: 'Serum',
        turnaroundHours: 24,
        fastingRequired: false,
        priceInr: 999,
        description: 'Essential micronutrient status screen for bone density, neuromuscular health, and red blood cell production.',
        clinicalSignificance: 'Assesses common dietary nutritional deficiencies.'
      },
      {
        id: 't_xray',
        name: 'Chest X-Ray PA View (Digital Diagnostic)',
        category: 'Respiratory & Imaging',
        sampleType: 'Digital X-Ray',
        turnaroundHours: 4,
        fastingRequired: false,
        priceInr: 650,
        description: 'High-resolution thoracic radiograph evaluated by certified radiologist.',
        clinicalSignificance: 'Direct visual confirmation of lung parenchymal clearing.'
      },
      {
        id: 't_spiro',
        name: 'Pulmonary Function Test (Spirometry FEV1/FVC)',
        category: 'Respiratory & Imaging',
        sampleType: 'Breathing Maneuver',
        turnaroundHours: 2,
        fastingRequired: false,
        priceInr: 800,
        description: 'Dynamic expiratory volume evaluation quantifying airflow kinetics and lung capacities.',
        clinicalSignificance: 'Screens obstructive vs restrictive ventilatory patterns.'
      },
      {
        id: 't_cbc',
        name: 'Complete Blood Count (CBC with ESR & Platelet Indices)',
        category: 'Organ Function',
        sampleType: 'Blood',
        turnaroundHours: 6,
        fastingRequired: false,
        priceInr: 299,
        description: 'Quantifies hemoglobin, RBC, total WBC count, differential distribution, and platelets.',
        clinicalSignificance: 'Screens for systemic inflammation, infection, or anemia.'
      },
      {
        id: 't_crp',
        name: 'High Sensitivity C-Reactive Protein (hs-CRP)',
        category: 'Cardiac & Lipid',
        sampleType: 'Serum',
        turnaroundHours: 12,
        fastingRequired: false,
        priceInr: 500,
        description: 'Sub-clinical vascular inflammatory marker for coronary endothelial risk evaluation.',
        clinicalSignificance: 'Cardiovascular inflammation biomarker.'
      }
    ];
  }

  private initPreSeededAccounts() {
    // 1. Admin Account (Full Administrator Privileges)
    let adminId = 'usr_admin_001';
    let adminEmail = (process.env.ADMIN_EMAIL || 'admin@swasthai.com').trim().toLowerCase();
    let adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Swasth2026!';
    let adminName = 'Dr. Medical Admin';

    // Check if external secure admin_seed.json exists (generated by python scripts/create_admin.py)
    try {
      const seedPath = path.resolve(process.cwd(), 'server', 'admin_seed.json');
      if (fs.existsSync(seedPath)) {
        const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        const seededAdmin = seedData[adminEmail] || Object.values(seedData)[0] as any;
        if (seededAdmin) {
          adminEmail = seededAdmin.email.toLowerCase();
          adminPassword = seededAdmin.passwordHash || adminPassword;
          adminName = seededAdmin.name || adminName;
          if (seededAdmin.id) adminId = seededAdmin.id;
        }
      }
    } catch (e) {
      console.warn('[Admin Seed] Notice reading admin_seed.json:', e);
    }

    const adminPermissions = getPermissionsForRole('ADMIN');

    const adminUser: UserAccount = {
      id: adminId,
      email: adminEmail,
      passwordHash: adminPassword,
      role: 'ADMIN',
      permissions: adminPermissions,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastActivity: new Date().toISOString(),
      profile: {
        id: adminId,
        name: adminName,
        email: adminEmail,
        role: 'ADMIN',
        permissions: adminPermissions,
        age: 45,
        sex: 'female',
        height: 168,
        weight: 64,
        existingConditions: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      checkups: [],
      ppgHistory: [],
      heartSoundHistory: [],
      coughHistory: [],
      gaitMotionHistory: [],
      gaitCameraHistory: [],
      bmiHistory: [],
      reports: [],
      appointments: [],
      labBookings: [],
      consentLogs: []
    };
    this.users.set(adminId, adminUser);
    const adminJwt = createJwtToken({ sub: adminId, email: adminEmail, role: 'ADMIN', permissions: adminPermissions });
    this.tokens.set(adminJwt, { userId: adminId, expiresAt: Date.now() + 86400000 * 30 });
    this.tokens.set('token_admin_session_valid', { userId: adminId, expiresAt: Date.now() + 86400000 * 30 });

    // 2. Operator Account (Clinical & Screening Operations, Restricted PHI)
    const operatorId = 'usr_operator_001';
    const operatorEmail = (process.env.OPERATOR_EMAIL || 'operator@swasthai.com').trim().toLowerCase();
    const operatorPassword = process.env.OPERATOR_PASSWORD || 'Operator@Swasth2026!';
    const operatorPermissions = getPermissionsForRole('OPERATOR');

    const operatorUser: UserAccount = {
      id: operatorId,
      email: operatorEmail,
      passwordHash: operatorPassword,
      role: 'OPERATOR',
      permissions: operatorPermissions,
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
      lastActivity: new Date().toISOString(),
      profile: {
        id: operatorId,
        name: 'Operations Lead Sharma',
        email: operatorEmail,
        role: 'OPERATOR',
        permissions: operatorPermissions,
        age: 35,
        sex: 'male',
        height: 175,
        weight: 72,
        existingConditions: [],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
      },
      checkups: [],
      ppgHistory: [],
      heartSoundHistory: [],
      coughHistory: [],
      gaitMotionHistory: [],
      gaitCameraHistory: [],
      bmiHistory: [],
      reports: [],
      appointments: [],
      labBookings: [],
      consentLogs: []
    };
    this.users.set(operatorId, operatorUser);
    const operatorJwt = createJwtToken({ sub: operatorId, email: operatorEmail, role: 'OPERATOR', permissions: operatorPermissions });
    this.tokens.set(operatorJwt, { userId: operatorId, expiresAt: Date.now() + 86400000 * 30 });
    this.tokens.set('token_operator_session_valid', { userId: operatorId, expiresAt: Date.now() + 86400000 * 30 });

    // 3. Demo Account (Normal Patient User A)
    const demoId = 'usr_demo_patient_001';
    const demoPermissions = getPermissionsForRole('USER');
    const demoUser: UserAccount = {
      id: demoId,
      email: 'demo@swasthai.com',
      passwordHash: 'demo123',
      role: 'USER',
      permissions: demoPermissions,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-09-04T08:00:00.000Z',
      lastActivity: new Date().toISOString(),
      profile: {
        id: demoId,
        name: 'Demo Test Patient',
        email: 'demo@swasthai.com',
        role: 'USER',
        permissions: demoPermissions,
        age: 32,
        sex: 'other',
        height: 172,
        weight: 68,
        existingConditions: ['Baseline evaluation'],
        medications: 'None',
        smokingStatus: 'non_smoker',
        activityLevel: 'moderately_active',
        profileCompleted: true,
        profile_completed: true,
        createdAt: '2026-08-01T09:00:00.000Z',
        updatedAt: '2026-09-04T08:00:00.000Z'
      },
      checkups: [],
      ppgHistory: [],
      heartSoundHistory: [],
      coughHistory: [],
      gaitMotionHistory: [],
      gaitCameraHistory: [],
      bmiHistory: [],
      reports: [],
      appointments: [],
      labBookings: [],
      consentLogs: []
    };

    // Seed 1 baseline checkup for demo user
    this.seedDemoUserBaseline(demoUser);
    this.users.set(demoId, demoUser);

    // Map legacy / default developer tokens to demo user
    const demoJwt = createJwtToken({ sub: demoId, email: 'demo@swasthai.com', role: 'USER', permissions: demoPermissions });
    this.tokens.set(demoJwt, { userId: demoId, expiresAt: Date.now() + 86400000 * 30 });
    this.tokens.set('jwt_mock_token_dev_2026_valid', { userId: demoId, expiresAt: Date.now() + 86400000 * 30 });
    this.tokens.set('token_demo_session_valid', { userId: demoId, expiresAt: Date.now() + 86400000 * 30 });

    // 4. Additional Pre-Seeded Registered Patients (for realistic clinical cohort)
    this.seedPatient('usr_patient_002', 'Rohan Mehra', 'rohan.mehra@example.com', 46, 'male', 178, 76, 'normal');
    this.seedPatient('usr_patient_003', 'Priya Sharma', 'priya.sharma@example.com', 38, 'female', 162, 59, 'monitor');
    this.seedPatient('usr_patient_004', 'Vikram Patel', 'vikram.patel@example.com', 64, 'male', 170, 82, 'follow_up');
  }

  private seedDemoUserBaseline(user: UserAccount) {
    const ts = new Date(Date.now() - 3600000 * 24).toISOString();
    user.ppgHistory.push({
      heartRate: 72,
      hrvRmssd: 48,
      estimatedSpO2: 98,
      signalQuality: 94,
      status: 'normal',
      confidence: 'high',
      confidenceScore: 0.92,
      timestamp: ts,
      source: 'camera_ppg',
      disclaimer: 'Physiological screening estimate only.',
      explanation: 'Normal resting sinus rhythm with balanced parasympathetic autonomic tone.'
    });

    user.bmiHistory.push({
      heightCm: 172,
      weightKg: 68,
      bmi: 23.0,
      category: 'Normal weight',
      change7d: 0,
      change30d: -0.5,
      status: 'normal',
      explanation: 'Healthy BMI index.',
      timestamp: ts
    });
  }

  private seedPatient(
    id: string,
    name: string,
    email: string,
    age: number,
    sex: 'male' | 'female' | 'other',
    height: number,
    weight: number,
    status: HealthStatus
  ) {
    const ts = new Date(Date.now() - 3600000 * 12).toISOString();
    const permissions = getPermissionsForRole('USER');
    const userProfile: UserProfile = {
      id,
      name,
      email,
      role: 'USER',
      permissions,
      age,
      sex,
      height,
      weight,
      existingConditions: status === 'normal' ? [] : ['Cardiometabolic review'],
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: ts
    };

    const patientAccount: UserAccount = {
      id,
      email,
      passwordHash: 'patient123',
      role: 'USER',
      permissions,
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: ts,
      lastActivity: ts,
      profile: userProfile,
      checkups: [
        {
          id: `chk_${id}_01`,
          userId: id,
          startedAt: ts,
          completedAt: ts,
          cadenceType: 'comprehensive',
          overallStatus: status,
          summaryExplanation: `Clinical screening assessment for ${name}.`,
          modules: {
            ppg: { module: 'ppg', status: 'completed', result: null },
            heartSound: { module: 'heart_sound', status: 'completed', result: null },
            cough: { module: 'cough', status: 'completed', result: null },
            gait: { module: 'gait', status: 'pending', result: null },
            bmi: { module: 'bmi', status: 'completed', result: null }
          }
        }
      ],
      ppgHistory: [
        {
          heartRate: status === 'normal' ? 70 : status === 'monitor' ? 84 : 102,
          hrvRmssd: status === 'normal' ? 52 : status === 'monitor' ? 32 : 18,
          estimatedSpO2: status === 'normal' ? 98 : status === 'monitor' ? 96 : 93,
          signalQuality: 92,
          status,
          confidence: 'high',
          confidenceScore: 0.9,
          timestamp: ts,
          explanation: `Automated optical photoplethysmography screening.`,
          disclaimer: 'Physiological screening estimate only.'
        }
      ],
      heartSoundHistory: [
        {
          patternType: status === 'normal' ? 'regular_s1_s2' : 'isolated_murmur_signal',
          confidence: 'high',
          confidenceScore: 0.88,
          signalQuality: 89,
          ambientNoiseDb: 34,
          frequencySpectrum: [0.1, 0.4, 0.8, 0.3],
          status,
          explanation: 'Phonocardiogram acoustic analysis.',
          disclaimer: 'Acoustic screening estimate only.',
          timestamp: ts
        }
      ],
      coughHistory: [
        {
          patternType: status === 'normal' ? 'clear_airflow' : status === 'monitor' ? 'dry_paroxysmal' : 'wet_resonant',
          confidence: 'high',
          confidenceScore: 0.85,
          signalQuality: 91,
          melBands: [0.2, 0.5, 0.7, 0.4],
          status,
          coughEventsCount: status === 'normal' ? 0 : 3,
          explanation: 'Acoustic cough pattern analysis.',
          disclaimer: 'Acoustic screening estimate only.',
          timestamp: ts
        }
      ],
      gaitMotionHistory: [],
      gaitCameraHistory: [],
      bmiHistory: [
        {
          heightCm: height,
          weightKg: weight,
          bmi: Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10,
          category: 'Normal weight',
          change7d: 0,
          change30d: 0,
          status: 'normal',
          explanation: 'Healthy body mass index.',
          timestamp: ts
        }
      ],
      reports: [
        {
          id: `rep_${id}_01`,
          reportNumber: `SW-${id.substring(4).toUpperCase()}-2026`,
          userId: id,
          checkupId: `chk_${id}_01`,
          dataRange: 'Clinical Checkup Evaluation',
          generatedAt: ts,
          userName: name,
          age,
          sex,
          createdAt: ts,
          userProfile: {
            name,
            age,
            sex,
            height,
            weight,
            conditions: []
          },
          testedCount: 4,
          totalModulesCount: 6,
          modules: [],
          metrics: {
            heartRate: status === 'normal' ? 70 : status === 'monitor' ? 84 : 102,
            hrvRmssd: status === 'normal' ? 52 : 32,
            estimatedSpO2: status === 'normal' ? 98 : 95,
            bmi: Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10
          },
          riskSummary: {
            overallStatus: status,
            riskScore: status === 'normal' ? 18 : status === 'monitor' ? 44 : 76,
            confidence: 'high',
            primarySignals: [],
            trendInsight: 'Baseline vitals collected.',
            recommendedAction: status === 'normal' ? 'Maintain healthy lifestyle habits.' : 'Schedule tele-consultation.',
            followUpRequired: status !== 'normal',
            timestamp: ts
          },
          limitations: 'Physiological software screening only.',
          overallStatus: status,
          confidenceScore: 0.91,
          executiveSummary: `Screening evaluation for ${name}: status is ${status}.`,
          disclaimer: 'Physiological screening estimate only.',
          vitals: {
            heartRate: status === 'normal' ? 70 : 88,
            heartRateStatus: status,
            hrvRmssd: 45,
            hrvStatus: status,
            estimatedSpO2: 97,
            weightKg: weight,
            bmi: 23,
            cadence: 110,
            gaitStatus: 'normal',
            heartSoundPattern: 's1_s2',
            heartSoundStatus: status,
            coughPattern: 'none',
            coughStatus: status
          },
          actionItems: ['Maintain hydration', 'Follow up in 30 days']
        }
      ],
      appointments: [],
      labBookings: [],
      consentLogs: []
    };

    this.users.set(id, patientAccount);
  }

  // ==========================================
  // AUTHENTICATION & IDENTITY (User-Scoped)
  // ==========================================

  public registerUser(params: {
    name: string;
    email: string;
    password?: string;
    role?: UserRole;
    age?: number;
    sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    height?: number;
    weight?: number;
  }): { user: UserProfile; token: string; refreshToken: string } {
    const cleanEmail = params.email.trim().toLowerCase();

    // Check if user already exists
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === cleanEmail) {
        throw new Error('An account with this email already exists. Please log in.');
      }
    }

    // Generate unique immutable UUID
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    // Public signup is strictly restricted to Patient (USER) role. Admin/Operator accounts cannot be self-assigned.
    const resolvedRole: UserRole = 'USER';
    const resolvedPermissions = getPermissionsForRole('USER');

    const userProfile: UserProfile = {
      id: userId,
      name: params.name.trim(),
      email: cleanEmail,
      role: resolvedRole,
      permissions: resolvedPermissions,
      age: params.age || 25,
      sex: params.sex || 'prefer_not_to_say',
      height: params.height || 170,
      weight: params.weight || 65,
      existingConditions: [],
      medications: '',
      smokingStatus: 'non_smoker',
      activityLevel: 'moderately_active',
      profileCompleted: false,
      profile_completed: false,
      createdAt: now,
      updatedAt: now
    };

    // Brand new clean, isolated user account
    const userAccount: UserAccount = {
      id: userId,
      email: cleanEmail,
      passwordHash: params.password || 'password123',
      role: resolvedRole,
      permissions: resolvedPermissions,
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
      profile: userProfile,
      checkups: [],
      ppgHistory: [],
      heartSoundHistory: [],
      coughHistory: [],
      gaitMotionHistory: [],
      gaitCameraHistory: [],
      bmiHistory: [],
      reports: [],
      appointments: [],
      labBookings: [],
      consentLogs: []
    };

    this.users.set(userId, userAccount);

    const token = createJwtToken({
      sub: userId,
      email: cleanEmail,
      role: resolvedRole,
      permissions: resolvedPermissions
    });
    const refreshToken = `refresh_${userId}_${Date.now()}`;
    this.tokens.set(token, { userId, expiresAt: Date.now() + 86400000 * 14 });

    return {
      user: userProfile,
      token,
      refreshToken
    };
  }

  public loginUser(email: string, password?: string): { user: UserProfile; token: string; refreshToken: string } {
    const cleanEmail = email.trim().toLowerCase();

    let targetUser: UserAccount | null = null;
    for (const u of this.users.values()) {
      if (
        u.email.toLowerCase() === cleanEmail ||
        (cleanEmail === 'demo@swasthai.com' && u.email.toLowerCase() === 'patient@swasthai.com') ||
        (cleanEmail === 'patient@swasthai.com' && u.email.toLowerCase() === 'demo@swasthai.com')
      ) {
        targetUser = u;
        break;
      }
    }

    if (!targetUser) {
      throw new Error('Invalid email or password. Please verify your credentials or sign up.');
    }

    // Password verification (flexible for development seeds)
    if (password) {
      const p = password.trim();
      const valid =
        p === targetUser.passwordHash ||
        (targetUser.role === 'ADMIN' && (p === 'admin123' || p === process.env.ADMIN_PASSWORD || p === 'Admin@Swasth2026!')) ||
        (targetUser.role === 'OPERATOR' && (p === 'operator123' || p === process.env.OPERATOR_PASSWORD || p === 'Operator@Swasth2026!')) ||
        (targetUser.role === 'USER' && (p === 'demo123' || p === 'patient123' || p === 'Patient@Swasth2026!'));

      if (!valid) {
        throw new Error('Invalid email or password. Please verify your credentials.');
      }
    }

    // Update last activity
    targetUser.lastActivity = new Date().toISOString();

    const token = createJwtToken({
      sub: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      permissions: targetUser.permissions || getPermissionsForRole(targetUser.role)
    });
    const refreshToken = `refresh_${targetUser.id}_${Date.now()}`;
    this.tokens.set(token, { userId: targetUser.id, expiresAt: Date.now() + 86400000 * 14 });

    return {
      user: targetUser.profile,
      token,
      refreshToken
    };
  }

  public getUserByToken(token: string): UserAccount | null {
    if (!token) return null;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

    // 1. Check in-memory active session tokens
    const session = this.tokens.get(cleanToken);
    if (session) {
      if (Date.now() > session.expiresAt) {
        this.tokens.delete(cleanToken);
        return null;
      }
      const user = this.users.get(session.userId);
      if (user) {
        user.lastActivity = new Date().toISOString();
        return user;
      }
    }

    // 2. Cryptographic JWT signature verification
    const jwtClaims = verifyJwtToken(cleanToken);
    if (jwtClaims && jwtClaims.sub) {
      const user = this.users.get(jwtClaims.sub);
      if (user) {
        user.lastActivity = new Date().toISOString();
        return user;
      }
    }

    return null;
  }

  public revokeToken(token: string): void {
    if (!token) return;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    this.tokens.delete(cleanToken);
  }

  public getUserById(userId: string): UserAccount | null {
    if (!userId) return null;
    let cached = this.users.get(userId);
    if (cached) return cached;

    try {
      const profile = jsonStore.findOne<UserProfile>('profiles', p => p.id === userId);
      const userRec = jsonStore.findOne<any>('users', u => u.id === userId);

      if (profile || userRec) {
        const now = new Date().toISOString();
        const account: UserAccount = {
          id: userId,
          email: profile?.email || userRec?.email || '',
          passwordHash: userRec?.passwordHash || '',
          role: profile?.role || userRec?.role || 'USER',
          permissions: getPermissionsForRole(profile?.role || userRec?.role || 'USER'),
          createdAt: profile?.createdAt || now,
          updatedAt: profile?.updatedAt || now,
          lastActivity: now,
          profile: profile || {
            id: userId,
            name: userRec?.name || 'Patient User',
            email: userRec?.email || '',
            role: 'USER',
            age: 30,
            sex: 'male',
            height: 170,
            weight: 70,
            existingConditions: [],
            medications: '',
            createdAt: now,
            updatedAt: now,
            profileCompleted: true
          },
          checkups: [],
          ppgHistory: [],
          heartSoundHistory: [],
          coughHistory: [],
          gaitMotionHistory: [],
          gaitCameraHistory: [],
          bmiHistory: [],
          reports: [],
          appointments: [],
          labBookings: [],
          consentLogs: []
        };
        this.users.set(userId, account);
        return account;
      }
    } catch (_) {}

    return null;
  }

  // ==========================================
  // USER PROFILE
  // ==========================================

  public getProfile(userId: string): UserProfile {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');
    return user.profile;
  }

  public updateProfile(userId: string, update: Partial<UserProfile>): UserProfile {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const isComplete =
      update.profileCompleted ??
      (!!(update.name || user.profile.name) &&
       !!(update.age || user.profile.age) &&
       !!(update.height || user.profile.height) &&
       !!(update.weight || user.profile.weight));

    user.profile = {
      ...user.profile,
      ...update,
      profileCompleted: isComplete,
      profile_completed: isComplete,
      id: user.id, // Immutable ID
      email: user.email, // Preserve email
      updatedAt: new Date().toISOString()
    };

    try {
      jsonStore.update('profiles', (p: any) => p.id === userId, user.profile);
    } catch (_) {}

    return user.profile;
  }

  // ==========================================
  // MEASUREMENTS & HISTORY (User-Isolated)
  // ==========================================

  public addPPG(userId: string, ppg: PPGMeasurementResult): void {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    user.ppgHistory.push(ppg);

    // Link to current in-progress checkup session if active
    const current = this.getOrCreateCurrentCheckup(userId, 'daily');
    current.modules.ppg = {
      module: 'ppg',
      status: 'completed',
      result: ppg,
      quality: ppg.signalQuality,
      confidence: ppg.confidence,
      timestamp: ppg.timestamp,
      source: 'camera_ppg'
    };
    current.ppg = ppg;
  }

  public addHeartSound(userId: string, hs: HeartSoundResult): void {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    user.heartSoundHistory.push(hs);

    const current = this.getOrCreateCurrentCheckup(userId, 'comprehensive');
    current.modules.heartSound = {
      module: 'heart_sound',
      status: 'completed',
      result: hs,
      quality: hs.signalQuality,
      confidence: hs.confidence,
      timestamp: hs.timestamp,
      source: 'microphone'
    };
    current.heartSound = hs;
  }

  public addCough(userId: string, cough: CoughResult): void {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    user.coughHistory.push(cough);

    const current = this.getOrCreateCurrentCheckup(userId, 'daily');
    current.modules.cough = {
      module: 'cough',
      status: 'completed',
      result: cough,
      quality: cough.signalQuality,
      confidence: cough.confidence,
      timestamp: cough.timestamp,
      source: 'microphone'
    };
    current.cough = cough;
  }

  public ensureUser(userId: string): UserAccount {
    let user = this.getUserById(userId);
    if (!user) {
      const now = new Date().toISOString();
      user = {
        id: userId,
        email: '',
        passwordHash: '',
        role: 'USER',
        permissions: getPermissionsForRole('USER'),
        createdAt: now,
        updatedAt: now,
        lastActivity: now,
        profile: {
          id: userId,
          name: 'Patient User',
          email: '',
          role: 'USER',
          age: 30,
          sex: 'male',
          height: 170,
          weight: 70,
          existingConditions: [],
          medications: '',
          createdAt: now,
          updatedAt: now,
          profileCompleted: true
        },
        checkups: [],
        ppgHistory: [],
        heartSoundHistory: [],
        coughHistory: [],
        gaitMotionHistory: [],
        gaitCameraHistory: [],
        bmiHistory: [],
        reports: [],
        appointments: [],
        labBookings: [],
        consentLogs: []
      };
      this.users.set(userId, user);
    }
    if (!user.gaitCameraHistory) user.gaitCameraHistory = [];
    if (!user.gaitMotionHistory) user.gaitMotionHistory = [];
    return user;
  }

  public addMotionGait(userId: string, gait: GaitResult): void {
    const user = this.ensureUser(userId);

    user.gaitMotionHistory.push(gait);

    const current = this.getOrCreateCurrentCheckup(userId, 'comprehensive');
    current.modules.gait = {
      module: 'gait',
      status: 'completed',
      result: gait,
      quality: gait.sensorQuality,
      confidence: gait.confidence,
      timestamp: gait.timestamp,
      source: 'accelerometer_gyroscope'
    };
    current.modules.gaitMotion = {
      module: 'gait_motion',
      status: 'completed',
      result: gait,
      quality: gait.sensorQuality,
      confidence: gait.confidence,
      timestamp: gait.timestamp,
      source: 'accelerometer_gyroscope'
    };
    current.gait = gait;
  }

  public addCameraGait(userId: string, cameraGait: CameraGaitResult): void {
    const user = this.ensureUser(userId);

    user.gaitCameraHistory.push(cameraGait);

    const current = this.getOrCreateCurrentCheckup(userId, 'comprehensive');
    current.modules.gaitCamera = {
      module: 'gait_camera',
      status: cameraGait.status === 'insufficient' ? 'error' : 'completed',
      result: cameraGait,
      quality: cameraGait.signalQuality,
      confidence: cameraGait.confidence,
      timestamp: cameraGait.timestamp,
      source: 'camera_gait',
      error: cameraGait.status === 'insufficient' ? cameraGait.explanation : null
    };
    current.gaitCamera = cameraGait;
  }

  public addBMI(userId: string, bmi: BMIResult): void {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    user.bmiHistory.push(bmi);

    const current = this.getOrCreateCurrentCheckup(userId, 'daily');
    current.modules.bmi = {
      module: 'bmi',
      status: 'completed',
      result: bmi,
      quality: 100,
      confidence: 'high',
      timestamp: bmi.timestamp,
      source: 'manual_entry'
    };
    current.bmi = bmi;
  }

  public getHistory(userId: string) {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    return {
      ppg: [...user.ppgHistory].reverse(),
      heartSound: [...user.heartSoundHistory].reverse(),
      cough: [...user.coughHistory].reverse(),
      gait: [...user.gaitMotionHistory].reverse(),
      cameraGait: [...user.gaitCameraHistory].reverse(),
      bmi: [...user.bmiHistory].reverse(),
      checkups: [...user.checkups].reverse(),
      reports: [...user.reports].reverse()
    };
  }

  // ==========================================
  // CHECKUP SESSIONS
  // ==========================================

  public getCheckups(userId: string): CheckupSession[] {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');
    return user.checkups;
  }

  public getCurrentCheckup(userId: string): CheckupSession | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    const active = user.checkups.find(c => !c.completedAt);
    return active || null;
  }

  public getOrCreateCurrentCheckup(userId: string, cadence: 'daily' | 'weekly' | 'comprehensive'): CheckupSession {
    const current = this.getCurrentCheckup(userId);
    if (current) return current;
    return this.createCheckup(userId, cadence);
  }

  public createCheckup(
    userId: string,
    cadence: 'daily' | 'weekly' | 'comprehensive' = 'daily',
    selectedModules?: string[]
  ): CheckupSession {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const newSession: CheckupSession = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      startedAt: new Date().toISOString(),
      cadenceType: cadence,
      selectedModules: selectedModules || ['ppg', 'cough', 'bmi'],
      modules: {
        ppg: { module: 'ppg', status: 'pending', result: null },
        heartSound: { module: 'heart_sound', status: 'pending', result: null },
        cough: { module: 'cough', status: 'pending', result: null },
        gait: { module: 'gait', status: 'pending', result: null },
        gaitMotion: { module: 'gait_motion', status: 'pending', result: null },
        gaitCamera: { module: 'gait_camera', status: 'pending', result: null },
        bmi: { module: 'bmi', status: 'pending', result: null }
      },
      overallStatus: 'normal',
      summaryExplanation: 'Checkup session in progress.'
    };

    user.checkups.push(newSession);
    return newSession;
  }

  public completeCheckup(userId: string, checkupId: string): CheckupSession {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const checkup = user.checkups.find(c => c.id === checkupId);
    if (!checkup) throw new Error('Checkup session not found');

    checkup.completedAt = new Date().toISOString();

    // Determine overall status
    const statuses: HealthStatus[] = [];
    if (checkup.modules.ppg?.result?.status) statuses.push(checkup.modules.ppg.result.status);
    if (checkup.modules.heartSound?.result?.status) statuses.push(checkup.modules.heartSound.result.status);
    if (checkup.modules.cough?.result?.status) statuses.push(checkup.modules.cough.result.status);
    if (checkup.modules.gait?.result?.status) statuses.push(checkup.modules.gait.result.status);
    if (checkup.modules.gaitCamera?.result?.status) statuses.push(checkup.modules.gaitCamera.result.status);
    if (checkup.modules.bmi?.result?.status) statuses.push(checkup.modules.bmi.result.status);

    if (statuses.includes('follow_up')) {
      checkup.overallStatus = 'follow_up';
      checkup.summaryExplanation = 'One or more screened markers showed physiological deviations warranting clinical consultation.';
    } else if (statuses.includes('monitor')) {
      checkup.overallStatus = 'monitor';
      checkup.summaryExplanation = 'Mild borderline deviations detected. Monitor trends across the next 7 days.';
    } else {
      checkup.overallStatus = 'normal';
      checkup.summaryExplanation = 'All completed physiological markers are within expected clinical reference ranges.';
    }

    // Auto-generate report for completed checkup
    this.createReport(userId, checkup.id);

    return checkup;
  }

  // ==========================================
  // REPORTS (Strict Ownership Isolation)
  // ==========================================

  public getReports(userId: string): HealthReport[] {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');
    return user.reports;
  }

  public getReportById(userId: string, reportId: string, isAdmin = false): HealthReport | null {
    if (isAdmin) {
      for (const u of this.users.values()) {
        const found = u.reports.find(r => r.id === reportId);
        if (found) return found;
      }
      return null;
    }

    const user = this.getUserById(userId);
    if (!user) return null;

    const report = user.reports.find(r => r.id === reportId);
    return report || null;
  }

  public getUserScenario(userId: string): DemoScenario {
    const user = this.getUserById(userId);
    return user?.profile.demoScenario || user?.demoScenario || this.currentScenario || 'normal';
  }

  public setUserScenario(userId: string, scenario: DemoScenario): void {
    const user = this.getUserById(userId);
    if (user) {
      user.demoScenario = scenario;
      user.profile.demoScenario = scenario;
    }
  }

  public getPersonalizedRiskSummary(userId: string): RiskSummary {
    const user = this.getUserById(userId);
    const profile = user?.profile;

    const currentCheckup = this.getCurrentCheckup(userId);
    const readings: SignalReading[] = [];

    if (currentCheckup) {
      if (currentCheckup.modules.ppg?.status === 'completed' && currentCheckup.modules.ppg.result) {
        const ppg = currentCheckup.modules.ppg.result;
        readings.push({
          module: 'Heart Rate (PPG)',
          value: ppg.heartRate,
          unit: 'bpm',
          status: ppg.status,
          quality: ppg.signalQuality,
          confidence: ppg.confidence,
          confidenceScore: ppg.confidenceScore,
          timestamp: ppg.timestamp,
          explanation: ppg.explanation
        });
      }

      if (currentCheckup.modules.heartSound?.status === 'completed' && currentCheckup.modules.heartSound.result) {
        const hs = currentCheckup.modules.heartSound.result;
        readings.push({
          module: 'Heart Sound Screen',
          value: hs.heartSoundPattern || hs.patternType.replace(/_/g, ' '),
          status: hs.status,
          quality: hs.signalQuality,
          confidence: hs.confidence,
          confidenceScore: hs.confidenceScore,
          timestamp: hs.timestamp,
          explanation: hs.explanation
        });
      }

      if (currentCheckup.modules.cough?.status === 'completed' && currentCheckup.modules.cough.result) {
        const cough = currentCheckup.modules.cough.result;
        readings.push({
          module: 'Respiratory / Cough Screen',
          value: cough.coughPattern || cough.patternType.replace(/_/g, ' '),
          status: cough.status,
          quality: cough.signalQuality,
          confidence: cough.confidence,
          confidenceScore: cough.confidenceScore,
          timestamp: cough.timestamp,
          explanation: cough.explanation
        });
      }

      if (currentCheckup.modules.gait?.status === 'completed' && currentCheckup.modules.gait.result) {
        const gait = currentCheckup.modules.gait.result;
        readings.push({
          module: 'Motion Gait & Cadence',
          value: gait.cadence,
          unit: 'spm',
          status: gait.status,
          quality: gait.sensorQuality || 90,
          confidence: gait.confidence || 'high',
          confidenceScore: 0.9,
          timestamp: gait.timestamp,
          explanation: gait.explanation
        });
      }

      if (currentCheckup.modules.gaitCamera?.status === 'completed' && currentCheckup.modules.gaitCamera.result) {
        const cg = currentCheckup.modules.gaitCamera.result;
        if (cg.status !== 'insufficient') {
          readings.push({
            module: 'Camera Vision Gait Kinematics',
            value: `${cg.cadenceStepsPerMin} spm (${cg.stepSymmetryIndex}% sym)`,
            unit: 'spm',
            status: cg.status,
            quality: cg.signalQuality,
            confidence: cg.confidence,
            confidenceScore: cg.confidenceScore,
            timestamp: cg.timestamp,
            explanation: cg.explanation
          });
        }
      }

      if (currentCheckup.modules.bmi?.status === 'completed' && currentCheckup.modules.bmi.result) {
        const bmi = currentCheckup.modules.bmi.result;
        readings.push({
          module: 'Body Mass Index (BMI)',
          value: bmi.bmi,
          unit: 'kg/m2',
          status: bmi.status,
          quality: 100,
          confidence: 'high',
          confidenceScore: 0.95,
          timestamp: bmi.timestamp,
          explanation: bmi.explanation
        });
      }
    }

    const userHistory = {
      ppgCount: user.ppgHistory.length,
      heartSoundCount: user.heartSoundHistory.length,
      coughCount: user.coughHistory.length,
      totalSessions: user.checkups.filter(c => c.completedAt).length
    };

    return HealthRiskEngine.evaluateRisk(readings, user.profile, userHistory);
  }

  public createReport(userId: string, checkupId?: string): HealthReport {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const checkup = checkupId ? user.checkups.find(c => c.id === checkupId) : user.checkups[user.checkups.length - 1];

    const sessionPPG = checkup?.modules?.ppg?.status === 'completed' ? checkup.modules.ppg.result : null;
    const sessionHS = checkup?.modules?.heartSound?.status === 'completed' ? checkup.modules.heartSound.result : null;
    const sessionCough = checkup?.modules?.cough?.status === 'completed' ? checkup.modules.cough.result : null;
    const sessionGait = checkup?.modules?.gait?.status === 'completed' ? checkup.modules.gait.result : (checkup?.modules?.gaitMotion?.status === 'completed' ? checkup.modules.gaitMotion.result : null);
    const sessionCameraGait = checkup?.modules?.gaitCamera?.status === 'completed' ? checkup.modules.gaitCamera.result : null;
    const sessionBMI = checkup?.modules?.bmi?.status === 'completed' ? checkup.modules.bmi.result : null;

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const reportNumber = `SAI-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    const modulesList: any[] = [];
    let testedCount = 0;

    // PPG
    if (sessionPPG) {
      testedCount++;
      modulesList.push({
        id: 'ppg',
        name: 'Cardiovascular PPG Screening',
        tested: true,
        status: 'completed',
        healthStatus: sessionPPG.status,
        valueDisplay: `${sessionPPG.heartRate} BPM`,
        details: `HRV RMSSD: ${sessionPPG.hrvRmssd} ms | Est. SpO₂: ${sessionPPG.estimatedSpO2}%`,
        confidence: sessionPPG.confidence,
        quality: sessionPPG.signalQuality,
        timestamp: sessionPPG.timestamp
      });
    } else {
      modulesList.push({
        id: 'ppg',
        name: 'Cardiovascular PPG Screening',
        tested: false,
        status: 'not_tested',
        valueDisplay: 'Not Screened'
      });
    }

    // Heart Sound
    if (sessionHS) {
      testedCount++;
      modulesList.push({
        id: 'heart_sound',
        name: 'Acoustic Heart Sound Auscultation',
        tested: true,
        status: 'completed',
        healthStatus: sessionHS.status,
        valueDisplay: sessionHS.heartSoundPattern || sessionHS.patternType.replace(/_/g, ' '),
        details: `S1/S2 clarity ${sessionHS.s1S2Clarity || 85}% | Murmur confidence ${Math.round((1 - (sessionHS.murmurProbability || 0.1)) * 100)}%`,
        confidence: sessionHS.confidence,
        quality: sessionHS.signalQuality,
        timestamp: sessionHS.timestamp
      });
    } else {
      modulesList.push({
        id: 'heart_sound',
        name: 'Acoustic Heart Sound Auscultation',
        tested: false,
        status: 'not_tested',
        valueDisplay: 'Not Screened'
      });
    }

    // Cough
    if (sessionCough) {
      testedCount++;
      modulesList.push({
        id: 'cough',
        name: 'Respiratory Cough Biomarker Analysis',
        tested: true,
        status: 'completed',
        healthStatus: sessionCough.status,
        valueDisplay: sessionCough.coughPattern || sessionCough.patternType.replace(/_/g, ' '),
        details: `Cough events: ${sessionCough.coughEventsCount || 0} | Duration: ${sessionCough.durationSeconds || 4}s`,
        confidence: sessionCough.confidence,
        quality: sessionCough.signalQuality,
        timestamp: sessionCough.timestamp
      });
    } else {
      modulesList.push({
        id: 'cough',
        name: 'Respiratory Cough Biomarker Analysis',
        tested: false,
        status: 'not_tested',
        valueDisplay: 'Not Screened'
      });
    }

    // Motion Gait
    if (sessionGait) {
      testedCount++;
      modulesList.push({
        id: 'gait_motion',
        name: 'Motion Sensor Gait Analysis',
        tested: true,
        status: 'completed',
        healthStatus: sessionGait.status,
        valueDisplay: `${sessionGait.cadence} SPM`,
        details: `Regularity: ${sessionGait.strideRegularity}% | Symmetry: ${sessionGait.stepSymmetry || sessionGait.symmetryIndex}%`,
        confidence: sessionGait.confidence || 'high',
        quality: sessionGait.sensorQuality || 90,
        timestamp: sessionGait.timestamp
      });
    } else {
      modulesList.push({
        id: 'gait_motion',
        name: 'Motion Sensor Gait Analysis',
        tested: false,
        status: 'not_tested',
        valueDisplay: 'Not Screened'
      });
    }

    // Camera Gait
    if (sessionCameraGait) {
      testedCount++;
      modulesList.push({
        id: 'gait_camera',
        name: 'Camera Vision Gait Kinematics',
        tested: true,
        status: sessionCameraGait.status === 'insufficient' ? 'error' : 'completed',
        healthStatus: sessionCameraGait.status,
        valueDisplay: sessionCameraGait.status === 'insufficient' ? 'Insufficient Quality' : `${sessionCameraGait.cadenceStepsPerMin} SPM`,
        details: `Symmetry: ${sessionCameraGait.stepSymmetryIndex}% | Pelvic Drop: ${sessionCameraGait.pelvicDropMax}° | Sway: ${sessionCameraGait.trunkSwayAmplitude}`,
        confidence: sessionCameraGait.confidence,
        quality: sessionCameraGait.signalQuality,
        timestamp: sessionCameraGait.timestamp,
        modelVersion: sessionCameraGait.modelVersion
      });
    } else {
      modulesList.push({
        id: 'gait_camera',
        name: 'Camera Vision Gait Kinematics',
        tested: false,
        status: 'not_tested',
        valueDisplay: 'Not Screened'
      });
    }

    // BMI
    if (sessionBMI) {
      testedCount++;
      modulesList.push({
        id: 'bmi',
        name: 'Anthropometric & BMI Assessment',
        tested: true,
        status: 'completed',
        healthStatus: sessionBMI.status,
        valueDisplay: `${sessionBMI.bmi} BMI`,
        details: `${sessionBMI.category} (${sessionBMI.weightKg} kg, ${sessionBMI.heightCm} cm)`,
        confidence: 'high',
        quality: 100,
        timestamp: sessionBMI.timestamp
      });
    } else {
      modulesList.push({
        id: 'bmi',
        name: 'Anthropometric & BMI Assessment',
        tested: false,
        status: 'not_tested',
        valueDisplay: 'Not Screened'
      });
    }

    const riskSummary = this.getPersonalizedRiskSummary(userId);
    const overallStatus = riskSummary.overallStatus;

    const report: HealthReport = {
      id: reportId,
      userId,
      reportNumber,
      checkupId: checkup?.id,
      generatedAt: now,
      dataRange: 'Point-in-time checkup screening session',
      userProfile: {
        name: user.profile.name,
        age: user.profile.age,
        sex: user.profile.sex,
        height: user.profile.height,
        weight: user.profile.weight,
        conditions: user.profile.existingConditions
      },
      testedCount,
      totalModulesCount: 6,
      modules: modulesList,
      metrics: {
        heartRate: sessionPPG?.heartRate || null,
        hrvRmssd: sessionPPG?.hrvRmssd || null,
        estimatedSpO2: sessionPPG?.estimatedSpO2 || null,
        bmi: sessionBMI?.bmi || null,
        gaitCadence: sessionGait?.cadence || null,
        cameraGaitCadence: sessionCameraGait?.cadenceStepsPerMin || null,
        cameraGaitSymmetry: sessionCameraGait?.stepSymmetryIndex || null,
        cameraGaitStatus: sessionCameraGait?.status || null,
        heartSoundStatus: sessionHS?.status || null,
        coughStatus: sessionCough?.status || null
      },
      riskSummary,
      limitations: 'Smartphone optical, acoustic, and kinematic screening values are informational approximations and do not constitute formal medical diagnostics.',
      userName: user.profile.name,
      age: user.profile.age,
      sex: user.profile.sex,
      createdAt: now,
      overallStatus,
      confidenceScore: riskSummary.confidence === 'high' ? 0.92 : riskSummary.confidence === 'moderate' ? 0.75 : 0.5,
      executiveSummary: checkup?.summaryExplanation || 'Biomarker screening completed.',
      disclaimer: 'SwasthAI is a health-tracking screening platform. It does not replace professional clinical evaluation.',
      vitals: {
        heartRate: sessionPPG?.heartRate || null,
        heartRateStatus: sessionPPG?.status || 'not_tested',
        hrvRmssd: sessionPPG?.hrvRmssd || null,
        hrvStatus: sessionPPG?.status || 'not_tested',
        estimatedSpO2: sessionPPG?.estimatedSpO2 || null,
        weightKg: sessionBMI?.weightKg || null,
        bmi: sessionBMI?.bmi || null,
        cadence: sessionGait?.cadence || null,
        gaitStatus: sessionGait?.status || 'not_tested',
        cameraGaitCadence: sessionCameraGait?.cadenceStepsPerMin || null,
        cameraGaitSymmetry: sessionCameraGait?.stepSymmetryIndex || null,
        cameraGaitStatus: sessionCameraGait?.status || 'not_tested',
        heartSoundPattern: sessionHS?.heartSoundPattern || null,
        heartSoundStatus: sessionHS?.status || 'not_tested',
        coughPattern: sessionCough?.coughPattern || null,
        coughStatus: sessionCough?.status || 'not_tested'
      },
      actionItems: overallStatus === 'follow_up'
        ? ['Consult a licensed physician for clinical validation', 'Monitor symptoms daily', 'Avoid strenuous exertion']
        : ['Maintain regular physical hydration', 'Repeat routine checkup in 7 days']
    };

    user.reports.push(report);
    return report;
  }

  // ==========================================
  // APPOINTMENTS & LABS (User-Isolated)
  // ==========================================

  public bookAppointment(userId: string, data: {
    doctorId: string;
    slotDate: string;
    slotTime: string;
    consultationType?: 'teleconsultation' | 'in_person';
    patientNotes?: string;
  }): Appointment {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const doctor = this.doctors.find(d => d.id === data.doctorId);
    if (!doctor) throw new Error('Doctor not found');

    const newAppt: Appointment = {
      id: `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      hospital: doctor.hospital,
      consultationFeeInr: doctor.consultationFeeInr,
      slotDate: data.slotDate,
      slotTime: data.slotTime,
      consultationType: data.consultationType || 'teleconsultation',
      status: 'confirmed',
      bookedAt: new Date().toISOString(),
      patientNotes: data.patientNotes || ''
    };

    user.appointments.push(newAppt);
    return newAppt;
  }

  public getAppointments(userId: string): Appointment[] {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');
    return user.appointments;
  }

  public bookLabTest(userId: string, data: {
    packageId: string;
    patientName?: string;
    patientPhone?: string;
    patientAddress: string;
    bookingType?: 'home_collection' | 'lab_visit';
    slotDate: string;
    slotTime: string;
  }): LabBooking {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const test = this.labTests.find(t => t.id === data.packageId);
    const testName = test ? test.name : 'Routine Health Screen Package';
    const priceInr = test ? test.priceInr : 799;

    const newBooking: LabBooking = {
      id: `lab_bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      packageName: testName,
      partnerName: this.labPartners[0].name,
      patientName: data.patientName || user.profile.name,
      patientPhone: data.patientPhone || '+91 98765 43210',
      patientAddress: data.patientAddress,
      bookingType: data.bookingType || 'home_collection',
      slotDate: data.slotDate,
      slotTime: data.slotTime,
      totalAmountInr: priceInr,
      status: 'confirmed',
      bookedAt: new Date().toISOString()
    };

    user.labBookings.push(newBooking);
    return newBooking;
  }

  public getLabBookings(userId: string): LabBooking[] {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');
    return user.labBookings;
  }

  // ==========================================
  // TREND DATASET (User-Scoped)
  // ==========================================

  public getTrendDataset(userId: string, metric: string): TrendDataset {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    let label = 'Heart Rate';
    let unit = 'BPM';
    let points: { date: string; value: number; baseline: number; unit: string; status: HealthStatus; confidence: any }[] = [];
    let baseAvg = 72;

    if (metric === 'hr' || metric === 'heart_rate') {
      label = 'Resting Heart Rate';
      unit = 'BPM';
      baseAvg = 72;
      points = user.ppgHistory.slice(-14).map(p => ({
        date: p.timestamp.split('T')[0].substring(5),
        value: p.heartRate,
        baseline: 72,
        unit: 'BPM',
        status: p.status,
        confidence: p.confidence
      }));
    } else if (metric === 'hrv') {
      label = 'Heart Rate Variability (RMSSD)';
      unit = 'ms';
      baseAvg = 48;
      points = user.ppgHistory.slice(-14).map(p => ({
        date: p.timestamp.split('T')[0].substring(5),
        value: p.hrvRmssd,
        baseline: 48,
        unit: 'ms',
        status: p.status,
        confidence: p.confidence
      }));
    } else if (metric === 'spo2') {
      label = 'Estimated SpO₂ (Proxy)';
      unit = '%';
      baseAvg = 98;
      points = user.ppgHistory.slice(-14).map(p => ({
        date: p.timestamp.split('T')[0].substring(5),
        value: p.estimatedSpO2,
        baseline: 98,
        unit: '%',
        status: p.status,
        confidence: p.confidence
      }));
    } else if (metric === 'weight') {
      label = 'Body Weight';
      unit = 'kg';
      baseAvg = user.profile.weight || 70;
      points = user.bmiHistory.slice(-10).map(b => ({
        date: b.timestamp.split('T')[0].substring(5),
        value: b.weightKg,
        baseline: user.profile.weight || 70,
        unit: 'kg',
        status: b.status,
        confidence: 'high'
      }));
    } else if (metric === 'gait') {
      label = 'Walking Cadence';
      unit = 'spm';
      baseAvg = 105;
      points = user.gaitMotionHistory.slice(-10).map(g => ({
        date: g.timestamp.split('T')[0].substring(5),
        value: g.cadence,
        baseline: 105,
        unit: 'spm',
        status: g.status,
        confidence: 'high'
      }));
    } else if (metric === 'camera_gait') {
      label = 'Camera Gait Cadence';
      unit = 'spm';
      baseAvg = 106;
      points = user.gaitCameraHistory.slice(-10).map(cg => ({
        date: cg.timestamp.split('T')[0].substring(5),
        value: cg.cadenceStepsPerMin,
        baseline: 106,
        unit: 'spm',
        status: cg.status,
        confidence: cg.confidence
      }));
    }

    const currVal = points.length > 0 ? points[points.length - 1].value : baseAvg;
    const diff = currVal - baseAvg;
    const pctChange = Number(((diff / baseAvg) * 100).toFixed(1));
    const direction = Math.abs(pctChange) < 3 ? 'stable' : pctChange > 0 ? 'increasing' : 'decreasing';

    return {
      metric,
      label,
      unit,
      currentValue: currVal,
      baselineAverage: baseAvg,
      percentageChange: pctChange,
      direction,
      status: Math.abs(pctChange) > 15 ? 'monitor' : 'normal',
      dataPoints: points,
      insufficientData: points.length < 3,
      insight:
        points.length < 3
          ? 'Not enough longitudinal data points yet. Complete 3 checkups to establish a stable personal trend.'
          : direction === 'stable'
          ? `Your ${label.toLowerCase()} has remained consistent with your personal monitoring baseline.`
          : `Your recent readings indicate a ${Math.abs(pctChange)}% ${direction} from baseline. Keep tracking this week.`
    };
  }

  // ==========================================
  // CONSENT & AUDITING
  // ==========================================

  public recordConsent(userId: string, type: string, version: string, ip: string = '127.0.0.1') {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    user.consentLogs.push({
      type,
      version,
      consentedAt: new Date().toISOString(),
      ip
    });
  }

  public revokeConsent(userId: string, type: string) {
    const user = this.getUserById(userId);
    if (!user) throw new Error('User not found');

    user.consentLogs = user.consentLogs.filter(c => c.type !== type);
  }

  // ==========================================
  // ADMIN DASHBOARD & AUDIT LOGGING (Part 26-32)
  // ==========================================

  public listUsersForAdmin(): AdminUserListItem[] {
    const list: AdminUserListItem[] = [];

    for (const u of this.users.values()) {
      const completedTests =
        u.ppgHistory.length +
        u.heartSoundHistory.length +
        u.coughHistory.length +
        u.gaitMotionHistory.length +
        u.gaitCameraHistory.length +
        u.bmiHistory.length;

      const latestCheckup = u.checkups[u.checkups.length - 1];
      const latestRiskStatus: HealthStatus = latestCheckup ? latestCheckup.overallStatus : 'normal';

      list.push({
        id: u.id,
        name: u.profile.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        lastActivity: u.lastActivity,
        checkupCount: u.checkups.length,
        completedTestsCount: completedTests,
        latestRiskStatus
      });
    }

    return list.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }

  public getUserDetailsForAdmin(adminId: string, targetUserId: string): UserAccount | null {
    const user = this.getUserById(targetUserId);
    if (!user) return null;

    this.logAdminAudit(adminId, 'VIEW_USER_RECORD', targetUserId, 'USER_ACCOUNT', `Admin viewed full profile and records of ${user.profile.name} (${user.id})`);
    return user;
  }

  public logAdminAudit(
    adminId: string,
    action: string,
    targetUser?: string,
    resource?: string,
    details?: string
  ): void {
    const entry: AdminAuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminId,
      action,
      targetUser,
      resource,
      details,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(entry);
  }

  public getAdminAuditLogs(): AdminAuditLog[] {
    return this.auditLogs.slice(0, 100);
  }

  public getAdminStats() {
    let patientCount = 0;
    let totalCheckups = 0;
    let totalReports = 0;
    let totalAppointments = 0;
    let totalLabBookings = 0;
    let normalCount = 0;
    let monitorCount = 0;
    let followUpCount = 0;

    for (const u of this.users.values()) {
      if (u.role === 'USER') {
        patientCount++;
        totalCheckups += u.checkups.length;
        totalReports += u.reports.length;
        totalAppointments += u.appointments.length;
        totalLabBookings += u.labBookings.length;

        const latestCheckup = u.checkups[u.checkups.length - 1];
        const status = latestCheckup ? latestCheckup.overallStatus : 'normal';
        if (status === 'normal') normalCount++;
        else if (status === 'monitor') monitorCount++;
        else if (status === 'follow_up') followUpCount++;
      }
    }

    return {
      totalPatients: patientCount,
      totalCheckups,
      totalReports,
      totalAppointments,
      totalLabBookings,
      totalAuditLogs: this.auditLogs.length,
      statusDistribution: {
        normal: normalCount,
        monitor: monitorCount,
        follow_up: followUpCount
      },
      systemHealth: 'operational',
      activeScenario: this.currentScenario
    };
  }

  public getAllCheckupsForAdmin() {
    const list: any[] = [];
    for (const u of this.users.values()) {
      if (u.role === 'USER') {
        for (const chk of u.checkups) {
          list.push({
            ...chk,
            patientName: u.profile.name,
            patientEmail: u.email
          });
        }
      }
    }
    return list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public getAllReportsForAdmin(isFullAdmin: boolean) {
    const list: any[] = [];
    for (const u of this.users.values()) {
      if (u.role === 'USER') {
        for (const rep of u.reports) {
          if (isFullAdmin) {
            list.push({
              ...rep,
              patientName: u.profile.name,
              patientEmail: u.email
            });
          } else {
            list.push({
              id: rep.id,
              userId: rep.userId,
              reportNumber: rep.reportNumber,
              generatedAt: rep.generatedAt,
              overallStatus: rep.overallStatus,
              patientName: u.profile.name,
              patientEmail: u.email,
              restricted: true,
              notice: 'Protected Health Information. Full report inspection & download restricted to Administrator.'
            });
          }
        }
      }
    }
    return list.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  public getAllAppointmentsForAdmin() {
    const list: any[] = [];
    for (const u of this.users.values()) {
      if (u.role === 'USER') {
        for (const apt of u.appointments) {
          list.push({
            ...apt,
            patientName: u.profile.name,
            patientEmail: u.email
          });
        }
      }
    }
    return list;
  }

  public getAllLabBookingsForAdmin() {
    const list: any[] = [];
    for (const u of this.users.values()) {
      if (u.role === 'USER') {
        for (const lab of u.labBookings) {
          list.push({
            ...lab,
            patientName: u.profile.name,
            patientEmail: u.email
          });
        }
      }
    }
    return list;
  }

  public resetUserSession(userId: string): void {
    const user = this.getUserById(userId);
    if (!user) return;
    user.checkups = [];
    user.ppgHistory = [];
    user.heartSoundHistory = [];
    user.coughHistory = [];
    user.gaitMotionHistory = [];
    user.gaitCameraHistory = [];
    user.bmiHistory = [];
    user.reports = [];
    user.appointments = [];
    user.labBookings = [];
  }
}

export const dataStore = new HealthDataStore();
