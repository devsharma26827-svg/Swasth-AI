import React, { useState } from 'react';
import {
  Activity,
  Heart,
  Mic,
  Wind,
  Footprints,
  Scale,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  FileText
} from 'lucide-react';
import { PPGScreen } from './PPGScreen';
import { HeartSoundScreen } from './HeartSoundScreen';
import { CoughScreen } from './CoughScreen';
import { GaitScreen } from './GaitScreen';
import { BMIScreen } from './BMIScreen';
import { checkupApi, riskApi } from '../services/api';
import {
  UserProfile,
  PPGMeasurementResult,
  HeartSoundResult,
  CoughResult,
  GaitResult,
  CameraGaitResult,
  BMIResult,
  HealthStatus,
  DemoScenario
} from '../types';

interface Props {
  profile?: UserProfile;
  userProfile?: UserProfile;
  currentScenario?: DemoScenario;
  onFinishCheckup?: () => void;
  onNavigateToFollowUp?: () => void;
  onNavigateToReports?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

type CheckupStep = 'overview' | 'ppg' | 'heart_sound' | 'cough' | 'gait' | 'bmi' | 'summary';

export const CheckupFlow: React.FC<Props> = ({
  profile: propProfile,
  userProfile,
  currentScenario = 'normal',
  onFinishCheckup,
  onNavigateToFollowUp,
  onNavigateToReports,
  onComplete,
  onCancel
}) => {
  const activeProfile: UserProfile = propProfile || userProfile || {
    id: 'guest',
    name: 'Patient User',
    email: '',
    role: 'USER',
    age: 30,
    sex: 'male',
    height: 170,
    weight: 70,
    existingConditions: [],
    medications: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profileCompleted: true
  };

  const handleFinishAction = () => {
    if (onFinishCheckup) onFinishCheckup();
    else if (onComplete) onComplete();
  };

  const [currentStep, setCurrentStep] = useState<CheckupStep>('overview');
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'comprehensive'>('comprehensive');
  const [shimmerComprehensive, setShimmerComprehensive] = useState(true);
  const [shimmerReport, setShimmerReport] = useState(true);
  const [completedModules, setCompletedModules] = useState<{
    ppg?: PPGMeasurementResult;
    heartSound?: HeartSoundResult;
    cough?: CoughResult;
    gait?: GaitResult | CameraGaitResult;
    bmi?: BMIResult;
  }>({});
  const [overallStatus, setOverallStatus] = useState<HealthStatus>('normal');
  const [isFinalizing, setIsFinalizing] = useState(false);

  const startModule = async (step: CheckupStep) => {
    setShimmerComprehensive(false);
    try {
      await checkupApi.create(cadence);
    } catch (e) {
      console.warn('Checkup session created locally / existing used', e);
    }
    setCurrentStep(step);
  };

  const handlePPGComplete = (res: PPGMeasurementResult) => {
    setCompletedModules(prev => ({ ...prev, ppg: res }));
    if (cadence === 'daily') {
      setCurrentStep('cough');
    } else {
      setCurrentStep('heart_sound');
    }
  };

  const handleHeartSoundComplete = (res: HeartSoundResult) => {
    setCompletedModules(prev => ({ ...prev, heartSound: res }));
    setCurrentStep('cough');
  };

  const handleCoughComplete = (res: CoughResult) => {
    setCompletedModules(prev => ({ ...prev, cough: res }));
    if (cadence === 'daily') {
      finalizeCheckup();
    } else {
      setCurrentStep('gait');
    }
  };

  const handleGaitComplete = (res: GaitResult | CameraGaitResult) => {
    console.log('[CHECKUP:GaitComplete]', {
      stepBefore: currentStep,
      hasResult: !!res,
      resultStatus: res?.status,
      resultType: (res as any)?.source || 'unknown'
    });
    if (res) {
      setCompletedModules(prev => ({ ...prev, gait: res }));
    }
    setCurrentStep('bmi');
    console.log('[CHECKUP:BMI]', {
      stepAfter: 'bmi',
      hasProfile: !!activeProfile,
      profileHeight: activeProfile?.height,
      profileWeight: activeProfile?.weight
    });
  };

  const handleBMIComplete = (res: BMIResult) => {
    setCompletedModules(prev => ({ ...prev, bmi: res }));
    finalizeCheckup();
  };

  const finalizeCheckup = async () => {
    setIsFinalizing(true);
    setCurrentStep('summary');

    try {
      const currentRes = await checkupApi.getCurrent();
      const currentCheckup = currentRes?.checkup;
      if (currentCheckup?.id) {
        await checkupApi.complete(currentCheckup.id);
      } else {
        await checkupApi.create(cadence);
      }
      const riskRes = await riskApi.getSummary();
      setOverallStatus(riskRes.risk.overallStatus);
    } catch (e) {
      console.warn('Finalized checkup locally', e);
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-24 animate-fade-in">
      {/* 1. OVERVIEW SCREEN */}
      {currentStep === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#EAE7DE] bg-white p-6 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#15803D]">
              <Activity className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-[#1F2421]">Routine Health Check-in</h2>
            <p className="mt-1 text-xs text-[#5C645D] leading-relaxed">
              A 5–7 minute non-invasive screening protocol capturing cardiovascular, respiratory, and biomechanical signals.
            </p>

            {/* Cadence Selector */}
            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Select Checkup Mode
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setCadence('daily')}
                  className={`p-3 rounded-2xl border transition-all ${
                    cadence === 'daily'
                      ? 'border-[#15803D] bg-[#E8F5E9] text-[#166534] font-bold shadow-2xs'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div>Daily Quick</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">2 min • PPG & Cough</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCadence('weekly')}
                  className={`p-3 rounded-2xl border transition-all ${
                    cadence === 'weekly'
                      ? 'border-[#15803D] bg-[#E8F5E9] text-[#166534] font-bold shadow-2xs'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div>Weekly Routine</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">5 min • PPG, Sound, Gait</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCadence('comprehensive');
                    setShimmerComprehensive(false);
                  }}
                  className={`p-3 rounded-2xl border transition-all ${
                    cadence === 'comprehensive'
                      ? `border-[#15803D] bg-[#E8F5E9] text-[#166534] font-bold shadow-2xs ${shimmerComprehensive ? 'swasth-shimmer' : ''}`
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Comprehensive</span>
                    <span className="rounded-md bg-[#15803D] text-white px-1 py-0.2 text-[8px] font-black uppercase">Rec</span>
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">7 min • All 5 Modules</div>
                </button>
              </div>
            </div>

            {/* Modules Included Checklist */}
            <div className="mt-5 space-y-2.5 rounded-2xl bg-[#FAF9F6] p-4 text-xs border border-gray-200">
              <span className="font-bold text-gray-900 block mb-1">Checkup Sequence:</span>
              <div className="flex items-center gap-2.5 text-gray-700">
                <Heart className="h-4 w-4 text-red-500 shrink-0" />
                <span>Camera PPG (Resting Heart Rate, HRV RMSSD, Est. SpO₂)</span>
              </div>

              {(cadence === 'weekly' || cadence === 'comprehensive') && (
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Mic className="h-4 w-4 text-purple-600 shrink-0" />
                  <span>Acoustic Heart Sound Rhythm Check (25s)</span>
                </div>
              )}

              <div className="flex items-center gap-2.5 text-gray-700">
                <Wind className="h-4 w-4 text-teal-600 shrink-0" />
                <span>Cough & Respiratory Acoustic Screening (15s)</span>
              </div>

              {(cadence === 'weekly' || cadence === 'comprehensive') && (
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Footprints className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Guided 30-Second Walking Gait Test</span>
                </div>
              )}

              {cadence === 'comprehensive' && (
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Scale className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Anthropometric BMI & Weight Log</span>
                </div>
              )}
            </div>

            <button
              onClick={() => startModule('ppg')}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-4 px-6 text-sm font-bold text-white shadow-sm hover:bg-[#166534] transition-all"
            >
              <span>Begin Step 1: Camera PPG</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. PPG SCREEN */}
      {currentStep === 'ppg' && (
        <PPGScreen
          currentScenario={currentScenario}
          onBack={() => setCurrentStep('overview')}
          onComplete={handlePPGComplete}
        />
      )}

      {/* 3. HEART SOUND SCREEN */}
      {currentStep === 'heart_sound' && (
        <HeartSoundScreen
          currentScenario={currentScenario}
          onBack={() => setCurrentStep('ppg')}
          onComplete={handleHeartSoundComplete}
        />
      )}

      {/* 4. COUGH SCREEN */}
      {currentStep === 'cough' && (
        <CoughScreen
          currentScenario={currentScenario}
          onBack={() => setCurrentStep(cadence === 'daily' ? 'ppg' : 'heart_sound')}
          onComplete={handleCoughComplete}
        />
      )}

      {/* 5. GAIT SCREEN */}
      {currentStep === 'gait' && (
        <GaitScreen
          currentScenario={currentScenario}
          onBack={() => setCurrentStep('cough')}
          onComplete={handleGaitComplete}
        />
      )}

      {/* 6. BMI SCREEN */}
      {currentStep === 'bmi' && (
        <BMIScreen
          profile={activeProfile}
          onBack={() => setCurrentStep('gait')}
          onComplete={handleBMIComplete}
        />
      )}

      {/* 7. CHECKUP SUMMARY */}
      {currentStep === 'summary' && (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-3xl border border-[#EAE7DE] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Checkup Completed
                </span>
                <h2 className="text-xl font-extrabold text-[#1F2421]">Session Summary</h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  overallStatus === 'normal'
                    ? 'bg-green-100 text-green-800'
                    : overallStatus === 'monitor'
                    ? 'bg-amber-100 text-amber-800'
                    : overallStatus === 'no_valid_results'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {overallStatus === 'normal'
                  ? 'Normal Range'
                  : overallStatus === 'monitor'
                  ? 'Monitor Trend'
                  : overallStatus === 'no_valid_results'
                  ? 'No Valid Results'
                  : 'Follow-up Recommended'}
              </span>
            </div>

            {/* Meaningful progress notice */}
            {isFinalizing ? (
              <div className="py-8 text-center text-xs text-gray-500">
                Cleaning signal... Checking measurement quality... Analyzing current session readings...
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Module Completion Breakdown */}
                <div className="rounded-2xl border border-gray-200 bg-[#F8F7F2] p-4">
                  <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Current Checkup Modules Status
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Camera PPG:</span>
                      <span className={completedModules.ppg ? "font-bold text-green-700" : "text-gray-400 font-medium"}>
                        {completedModules.ppg ? `✓ Completed (${completedModules.ppg.heartRate} BPM)` : '○ Not Tested'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Heart Sound:</span>
                      <span className={completedModules.heartSound ? "font-bold text-green-700" : "text-gray-400 font-medium"}>
                        {completedModules.heartSound ? `✓ Completed (${completedModules.heartSound.heartSoundPattern || completedModules.heartSound.status})` : '○ Not Tested'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Cough Screening:</span>
                      <span className={completedModules.cough ? "font-bold text-green-700" : "text-gray-400 font-medium"}>
                        {completedModules.cough ? `✓ Completed (${completedModules.cough.coughPattern || completedModules.cough.status})` : '○ Not Tested'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Gait Kinematics:</span>
                      <span className={completedModules.gait ? "font-bold text-green-700" : "text-gray-400 font-medium"}>
                        {completedModules.gait ? `✓ Completed` : '○ Not Tested'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">BMI Assessment:</span>
                      <span className={completedModules.bmi ? "font-bold text-green-700" : "text-gray-400 font-medium"}>
                        {completedModules.bmi ? `✓ Completed (${completedModules.bmi.bmi} BMI)` : '○ Not Tested'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F8F7F2] p-4 text-xs text-gray-700 leading-relaxed border border-gray-200">
                  {overallStatus === 'no_valid_results'
                    ? 'No valid screening measurements were completed in this session. Untested modules do not contribute to risk score.'
                    : overallStatus === 'normal'
                    ? 'Your recorded signals in this session are within expected physiological reference targets.'
                    : overallStatus === 'monitor'
                    ? 'Minor variances were detected in completed screening modules. Continue monitoring trends across future sessions.'
                    : 'One or more completed screening patterns differed noticeably from reference targets. Consider discussing these observations with a qualified physician.'}
                </div>

                {/* Primary CTA conditional on status */}
                {overallStatus === 'follow_up' && (
                  <button
                    onClick={onNavigateToFollowUp}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 px-6 text-sm font-bold text-white shadow hover:bg-red-700 transition-all"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>View Follow-up Guidance & Doctor Consultation</span>
                  </button>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShimmerReport(false);
                      onNavigateToReports();
                    }}
                    className={`flex-1 rounded-2xl border border-gray-300 bg-white py-3 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs flex items-center justify-center gap-1.5 ${
                      shimmerReport ? 'swasth-shimmer' : ''
                    }`}
                  >
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span>Download Report (PDF)</span>
                  </button>

                  <button
                    onClick={onFinishCheckup}
                    className="flex-1 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white hover:bg-[#166534] shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Back to Dashboard</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
