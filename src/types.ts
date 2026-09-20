export type HealthStatus = 'normal' | 'monitor' | 'follow_up' | 'insufficient' | 'not_tested' | 'no_valid_results';

export type ModuleState =
  | 'NOT_TESTED'
  | 'IN_PROGRESS'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'LOW_SIGNAL'
  | 'FAILED'
  | 'SKIPPED'
  | 'pending'
  | 'completed'
  | 'error';

export type ConfidenceLevel = 'high' | 'moderate' | 'low';

export type UserRole = 'USER' | 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export type Permission =
  | 'user.profile.read'
  | 'user.profile.write'
  | 'user.checkups.run'
  | 'user.reports.read'
  | 'admin.portal.access'
  | 'admin.patients.list'
  | 'admin.patients.view_summary'
  | 'admin.patients.inspect_full'
  | 'admin.reports.download'
  | 'admin.audit.read'
  | 'admin.simulation.execute'
  | 'admin.system.reset';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: Permission[];
  age: number;
  sex: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  height: number; // cm
  weight: number; // kg
  existingConditions: string[];
  medications?: string;
  smokingStatus?: 'non_smoker' | 'former_smoker' | 'occasional' | 'regular';
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  demoScenario?: DemoScenario;
  profileCompleted?: boolean;
  profile_completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PPGMeasurementResult {
  heartRate: number; // bpm
  hrvRmssd: number; // ms
  estimatedSpO2: number; // % approximate estimate
  signalQuality: number; // 0 - 100
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0 - 1
  waveformSamples?: number[];
  waveformSample?: number[];
  source?: string;
  ibiIntervals?: number[]; // ms
  status: HealthStatus;
  explanation: string;
  timestamp: string;
  disclaimer: string;
}

export interface HeartSoundResult {
  patternType: 'regular_s1_s2' | 'isolated_murmur_signal' | 'irregular_rhythm' | 'noisy_unusable' | 'murmur_suspected' | 'normal_s1_s2' | 'arrhythmic' | string;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  signalQuality: number; // 0 - 100
  ambientNoiseDb: number;
  frequencySpectrum: number[];
  status: HealthStatus;
  abnormalProbability?: number;
  prediction?: 'normal' | 'abnormal_pattern';
  modelVersion?: string;
  riskCategory?: 'NORMAL' | 'MONITOR' | 'FOLLOW_UP';
  screeningOnly?: boolean;
  metrics?: any;
  heartSoundPattern?: string;
  s1S2Clarity?: number;
  murmurProbability?: number;
  source?: string;
  explanation: string;
  timestamp: string;
  disclaimer: string;
}

export interface CoughResult {
  patternType: 'clear_airflow' | 'wet_resonant' | 'dry_paroxysmal' | 'shallow_wheezing' | 'insufficient_energy' | string;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  signalQuality: number;
  melBands: number[];
  status: HealthStatus;
  coughPattern?: string;
  coughEventsCount?: number;
  durationSeconds?: number;
  modelVersion?: string;
  source?: string;
  explanation: string;
  timestamp: string;
  disclaimer: string;
}

export interface GaitResult {
  stepCount: number;
  cadence: number; // steps per minute
  strideRegularity: number; // 0 - 100%
  symmetryIndex: number; // -100 to +100%
  stepSymmetry?: number;
  stepVariabilityMs: number;
  durationSeconds: number;
  accelSignal: { x: number; y: number; z: number; mag: number }[];
  status: HealthStatus;
  sensorQuality?: number;
  confidence?: ConfidenceLevel;
  explanation: string;
  timestamp: string;
}

export interface BMIResult {
  heightCm: number;
  weightKg: number;
  bmi: number;
  category: 'Underweight' | 'Normal weight' | 'Overweight' | 'Obesity class I' | 'Obesity class II+';
  change7d: number; // kg
  change30d: number; // kg
  status: HealthStatus;
  explanation: string;
  timestamp: string;
}

export interface CameraGaitResult {
  cadenceStepsPerMin: number;
  stepSymmetryIndex: number; // 0 - 100%
  pelvicDropAsymmetry: number; // degrees or normalized index
  pelvicDropMax: number; // degrees
  trunkSwayAmplitude: number; // normalized lateral excursion
  kneeRomAsymmetry: number; // degrees
  stanceAsymmetry: number; // %
  speedMps?: number; // approximate walking speed in m/s
  signalQuality: number; // 0 - 100
  framesProcessed: number;
  framesWithPose: number;
  poseDetectionRate: number; // 0 - 1
  durationSeconds: number;
  status: HealthStatus;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  modelVersion: string;
  modelMode: 'real' | 'demo' | 'synthetic';
  source: 'camera_gait';
  explanation: string;
  timestamp: string;
  disclaimer: string;
  screeningOnly: boolean;
}

export interface CheckupModuleStatus<T = any> {
  module: 'ppg' | 'heart_sound' | 'cough' | 'gait' | 'gait_motion' | 'gait_camera' | 'bmi';
  status: ModuleState;
  result: T | null;
  quality?: number | null;
  confidence?: ConfidenceLevel | null;
  timestamp?: string | null;
  modelVersion?: string | null;
  source?: 'camera_ppg' | 'microphone' | 'accelerometer_gyroscope' | 'camera_gait' | 'manual_entry' | 'demo' | null;
  error?: string | null;
}

export interface CheckupSession {
  id: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  cadenceType: 'daily' | 'weekly' | 'comprehensive' | 'custom';
  selectedModules?: string[];
  modules: {
    ppg: CheckupModuleStatus<PPGMeasurementResult>;
    heartSound: CheckupModuleStatus<HeartSoundResult>;
    cough: CheckupModuleStatus<CoughResult>;
    gait: CheckupModuleStatus<GaitResult>;
    gaitMotion?: CheckupModuleStatus<GaitResult>;
    gaitCamera?: CheckupModuleStatus<CameraGaitResult>;
    bmi: CheckupModuleStatus<BMIResult>;
  };
  overallStatus: HealthStatus;
  summaryExplanation: string;
  // Legacy / convenience getters
  ppg?: PPGMeasurementResult | null;
  heartSound?: HeartSoundResult | null;
  cough?: CoughResult | null;
  gait?: GaitResult | null;
  gaitCamera?: CameraGaitResult | null;
  bmi?: BMIResult | null;
}

export interface RiskSummary {
  overallStatus: HealthStatus;
  riskScore: number; // 0 to 100
  confidence: ConfidenceLevel;
  primarySignals: {
    module: string;
    value: string;
    status: HealthStatus;
    note: string;
  }[];
  trendInsight: string;
  recommendedAction: string;
  followUpRequired: boolean;
  timestamp: string;
}

export interface TrendMetricPoint {
  date: string;
  value: number;
  baseline: number;
  unit: string;
  status: HealthStatus;
  confidence: ConfidenceLevel;
}

export interface TrendDataset {
  metric: string;
  label: string;
  unit: string;
  currentValue: number;
  baselineAverage: number;
  percentageChange: number;
  direction: 'stable' | 'increasing' | 'decreasing';
  status: HealthStatus;
  dataPoints: TrendMetricPoint[];
  insufficientData: boolean;
  insight: string;
}

export interface Doctor {
  id: string;
  name: string;
  degree: string;
  specialty: 'General Physician' | 'Cardiologist' | 'Pulmonologist';
  experienceYears: number;
  hospital: string;
  rating: number;
  consultationFeeInr: number;
  availableDays: string[];
  slots: string[];
  isDemo: boolean;
  avatarInitials: string;
}

export interface Appointment {
  id: string;
  userId?: string;
  doctorId: string;
  doctorName: string;
  specialty?: string;
  doctorSpecialty?: string;
  hospital?: string;
  consultationFeeInr?: number;
  date?: string;
  timeSlot?: string;
  slotDate?: string;
  slotTime?: string;
  consultType?: 'video' | 'in_person';
  consultationType?: string;
  status: 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  patientNotes?: string;
  bookedAt?: string;
  createdAt?: string;
}

export interface LabPartner {
  id: string;
  name: string;
  accreditedBy: string;
  rating: number;
  homeCollection: boolean;
  address: string;
  city: string;
}

export interface LabTest {
  id: string;
  name: string;
  category: 'Cardiac & Lipid' | 'Metabolic & Diabetes' | 'Organ Function' | 'Respiratory & Imaging' | 'Vitamins & Minerals';
  sampleType: 'Blood' | 'Serum' | 'Urine' | 'Digital X-Ray' | 'Breathing Maneuver';
  turnaroundHours: number;
  fastingRequired: boolean;
  priceInr: number;
  description: string;
  clinicalSignificance: string;
}

export interface LabBooking {
  id: string;
  userId?: string;
  patientName?: string;
  patientPhone?: string;
  labId?: string;
  labName?: string;
  partnerName?: string;
  packageName?: string;
  testIds?: string[];
  testNames?: string[];
  bookingType: 'home_collection' | 'lab_visit';
  patientAddress?: string;
  date?: string;
  timeSlot?: string;
  slotDate?: string;
  slotTime?: string;
  totalPriceInr?: number;
  totalAmountInr?: number;
  bookedAt?: string;
  status: 'confirmed' | 'sample_collected' | 'results_ready' | 'cancelled';
  createdAt?: string;
}

export interface LabTestPackage {
  id: string;
  name: string;
  priceInr: number;
  description: string;
  parametersIncluded: string[];
  fastingRequired: boolean;
  partnerOptions: string[];
}

export interface ReportModuleItem {
  id: 'ppg' | 'heart_sound' | 'cough' | 'gait' | 'gait_motion' | 'gait_camera' | 'bmi';
  name: string;
  tested: boolean;
  status: ModuleState;
  healthStatus?: HealthStatus | null;
  valueDisplay: string;
  unit?: string;
  details?: string;
  confidence?: ConfidenceLevel | null;
  quality?: number | null;
  timestamp?: string | null;
  modelVersion?: string | null;
}

export interface HealthReport {
  id: string;
  userId: string;
  reportNumber: string;
  checkupId?: string;
  generatedAt: string;
  dataRange: string;
  userProfile: {
    name: string;
    age: number;
    sex: string;
    height: number;
    weight: number;
    conditions: string[];
  };
  testedCount: number;
  totalModulesCount: number;
  modules: ReportModuleItem[];
  metrics: {
    heartRate?: number | null;
    hrvRmssd?: number | null;
    estimatedSpO2?: number | null;
    bmi?: number | null;
    gaitCadence?: number | null;
    cameraGaitCadence?: number | null;
    cameraGaitSymmetry?: number | null;
    cameraGaitStatus?: HealthStatus | null;
    heartSoundStatus?: HealthStatus | null;
    coughStatus?: HealthStatus | null;
  };
  riskSummary: RiskSummary;
  limitations: string;
  pdfUrl?: string;

  // Flattened convenience properties for preview & PDF generation
  userName: string;
  age: number;
  sex: string;
  createdAt: string;
  overallStatus: HealthStatus;
  confidenceScore: number;
  executiveSummary: string;
  disclaimer: string;
  vitals: {
    heartRate: number | null;
    heartRateStatus: string;
    hrvRmssd: number | null;
    hrvStatus: string;
    estimatedSpO2: number | null;
    weightKg: number | null;
    bmi: number | null;
    cadence: number | null;
    gaitStatus: string;
    cameraGaitCadence?: number | null;
    cameraGaitSymmetry?: number | null;
    cameraGaitStatus?: string | null;
    heartSoundPattern: string | null;
    heartSoundStatus: string;
    coughPattern: string | null;
    coughStatus: string;
  };
  actionItems: string[];
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastActivity: string;
  checkupCount: number;
  completedTestsCount: number;
  latestRiskStatus: HealthStatus;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: string;
  targetUser?: string;
  resource?: string;
  timestamp: string;
  details?: string;
}

export interface AdminStats {
  totalPatients: number;
  totalCheckups: number;
  totalReports: number;
  totalAppointments: number;
  totalLabBookings: number;
  totalAuditLogs: number;
  statusDistribution: {
    normal: number;
    monitor: number;
    follow_up: number;
  };
  systemHealth: string;
  activeScenario: DemoScenario;
}

export type DemoScenario =
  | 'normal'
  | 'monitor'
  | 'follow_up'
  | 'low_quality'
  | 'mild_arrhythmia'
  | 'respiratory_pattern'
  | 'gait_irregularity';

